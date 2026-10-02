-- =====================================================================
-- T.I.M.E. Seguro — 0008_pin_fixo.sql
--
-- Decisão do usuário (02/10/2026): o PIN do colaborador é um número FIXO, ÚNICO
-- na empresa, que o colaborador NÃO troca, e que o gestor consegue consultar
-- para entregar a ele.
--
-- ⚠️ Isto contradiz docs/TIME_03 §5 ("o PIN não fica salvo em lugar nenhum").
-- É consequência direta do pedido, e vai registrado em memory/decisoes.md.
-- Mitigações:
--   • `pin_fixo` fica FORA do GRANT por coluna: o painel não o lê por SELECT;
--   • só RPC SECURITY DEFINER devolve o PIN, e só para admin e técnico;
--   • TODA consulta e TODA reemissão ficam em `acessos_pin`;
--   • o admin pode reemitir um PIN que vazou (o colaborador continua sem poder
--     trocar). Um PIN fixo que vazou, sem isso, valeria para sempre.
--   • o bloqueio (5 erros = 15 min) e a mensagem genérica de erro continuam.
--
-- Migration NOVA: as sete anteriores já foram aplicadas e não se editam.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Coluna e unicidade
-- ---------------------------------------------------------------------
alter table public.colaboradores add column if not exists pin_fixo text;

alter table public.colaboradores
  add constraint colaboradores_pin_fixo_formato
  check (pin_fixo is null or pin_fixo ~ '^[0-9]{6}$');

-- Único dentro da empresa. Parcial: anonimizado fica sem PIN.
create unique index colaboradores_pin_fixo_unico
  on public.colaboradores (empresa_id, pin_fixo)
  where pin_fixo is not null;

comment on column public.colaboradores.pin_fixo is
  'PIN de 6 digitos, fixo e unico por empresa. Fora do GRANT: so as RPCs tecnico_ver_pin/tecnico_gerar_pins/tecnico_reemitir_pin o devolvem.';

-- ---------------------------------------------------------------------
-- 2) Gerador de PIN único na empresa
--    `_pin_aleatorio()` já existe (criptograficamente seguro). Aqui só se
--    repete até não colidir. Com 1.000.000 de combinações e centenas de
--    colaboradores a colisão é rara; o teto de tentativas evita laço infinito.
-- ---------------------------------------------------------------------
create or replace function public._pin_unico(p_empresa uuid)
returns text language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_pin text; v_tentativas int := 0;
begin
  loop
    v_pin := _pin_aleatorio();
    -- Sem PIN trivial: 000000, 111111 ... e as sequências óbvias. O colaborador
    -- não escolhe mais o PIN, então a proteção que a troca dava vem daqui.
    continue when v_pin ~ '^(.)\1{5}$'
               or v_pin in ('012345','123456','234567','345678','456789',
                            '987654','876543','765432','654321','543210');
    exit when not exists (
      select 1 from colaboradores where empresa_id = p_empresa and pin_fixo = v_pin);
    v_tentativas := v_tentativas + 1;
    if v_tentativas > 200 then
      raise exception 'pin_indisponivel' using errcode = 'P0001';
    end if;
  end loop;
  return v_pin;
end $$;

-- ---------------------------------------------------------------------
-- 3) Todo colaborador novo já nasce com PIN
--    Cobre o cadastro manual, a importação em lote e a aprovação de
--    autocadastro, sem cada um precisar lembrar de gerar o PIN.
-- ---------------------------------------------------------------------
create or replace function public._colaborador_define_pin()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.pin_fixo is null and not new.anonimizado then
    new.pin_fixo := _pin_unico(new.empresa_id);
  end if;
  -- Não há mais "PIN provisório" nem troca no primeiro acesso.
  new.pin_provisorio := false;
  return new;
end $$;

create trigger colaboradores_define_pin
  before insert on public.colaboradores
  for each row execute function public._colaborador_define_pin();

-- ---------------------------------------------------------------------
-- 4) Quem consultou ou reemitiu um PIN
-- ---------------------------------------------------------------------
create table public.acessos_pin (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,
  acao            text not null check (acao in ('ver','reemitir')),
  criado_em       timestamptz not null default now()
);
create index acessos_pin_colab on public.acessos_pin (colaborador_id, criado_em desc);

alter table public.acessos_pin enable row level security;
-- Tabelas novas nascem com GRANT amplo para anon/authenticated no Supabase.
-- A 0005 trancou as que existiam; esta precisa ser trancada explicitamente.
revoke all on public.acessos_pin from anon, authenticated;
grant select on public.acessos_pin to authenticated;
create policy acessos_pin_admin on public.acessos_pin for select to authenticated
  using (empresa_id = minha_empresa() and meu_papel() = 'admin');

-- ---------------------------------------------------------------------
-- 5) Backfill: quem já existe recebe um PIN fixo
--    Os PINs antigos eram só hash e NÃO são recuperáveis. Todos os que existem
--    hoje deixam de valer, e os cartões precisam ser reimpressos.
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select id, empresa_id from public.colaboradores
            where pin_fixo is null and not anonimizado
  loop
    update public.colaboradores
       set pin_fixo = public._pin_unico(r.empresa_id),
           pin_provisorio = false,
           pin_hash = null
     where id = r.id;
  end loop;
  update public.colaboradores set pin_provisorio = false where pin_provisorio;
end $$;

-- ---------------------------------------------------------------------
-- 6) Login com o PIN fixo (mesma assinatura, mesmo contrato JSON)
-- ---------------------------------------------------------------------
create or replace function public.colaborador_login(p_empresa_codigo text, p_matricula text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v public.colaboradores; v_token text;
begin
  select c.* into v
    from colaboradores c join empresas e on e.id = c.empresa_id
   where e.codigo = lower(trim(p_empresa_codigo))
     and c.matricula = trim(p_matricula)
     and c.ativo and not c.anonimizado;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'credenciais_invalidas');
  end if;

  if v.bloqueado_ate is not null and v.bloqueado_ate > now() then
    return jsonb_build_object('ok', false, 'motivo', 'bloqueado', 'ate', v.bloqueado_ate);
  end if;

  if v.pin_fixo is null or v.pin_fixo <> trim(coalesce(p_pin, '')) then
    update colaboradores
       set tentativas_falhas = case when tentativas_falhas + 1 >= 5 then 0 else tentativas_falhas + 1 end,
           bloqueado_ate     = case when tentativas_falhas + 1 >= 5 then now() + interval '15 minutes' else null end
     where id = v.id;
    return jsonb_build_object('ok', false, 'motivo', 'credenciais_invalidas');
  end if;

  update colaboradores set tentativas_falhas = 0, bloqueado_ate = null where id = v.id;

  v_token := encode(gen_random_bytes(32), 'hex');
  insert into sessoes_colaborador (colaborador_id, token_hash, expira_em)
  values (v.id, encode(digest(v_token, 'sha256'), 'hex'), now() + interval '30 days');

  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'nome', v.nome,
    'pendencia', _pendencia(v)
  );
end $$;

-- O colaborador não troca mais o PIN. A função continua existindo (migration
-- antiga), mas ninguém de fora a executa.
revoke execute on function public.colaborador_trocar_pin(text, text, text) from anon, authenticated;

-- ---------------------------------------------------------------------
-- 7) Painel: entregar o PIN (cartões) — agora DEVOLVE o fixo, não gera outro.
--    Mesma assinatura da versão antiga. Não troca o PIN nem derruba sessões:
--    reimprimir um cartão não pode deslogar ninguém.
-- ---------------------------------------------------------------------
create or replace function public.tecnico_gerar_pins(p_colaboradores uuid[])
returns table (colaborador_id uuid, matricula text, nome text, setor text, pin text)
language plpgsql security definer set search_path = public, extensions as $$
declare v_emp uuid := _exigir_tecnico(); r record;
begin
  for r in
    select c.id, c.matricula, c.nome, c.pin_fixo, s.nome as setor_nome
      from colaboradores c left join setores s on s.id = c.setor_id
     where c.empresa_id = v_emp and c.id = any(p_colaboradores) and c.ativo and not c.anonimizado
     order by s.nome, c.nome
  loop
    insert into acessos_pin (empresa_id, colaborador_id, user_id, acao)
    values (v_emp, r.id, auth.uid(), 'ver');
    colaborador_id := r.id; matricula := r.matricula; nome := r.nome;
    setor := r.setor_nome; pin := r.pin_fixo;
    return next;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 8) Ver o PIN de um colaborador (admin e técnico)
-- ---------------------------------------------------------------------
create or replace function public.tecnico_ver_pin(p_colaborador uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_emp uuid := _exigir_tecnico(); c public.colaboradores;
begin
  select * into c from colaboradores
   where id = p_colaborador and empresa_id = v_emp and ativo and not anonimizado;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'colaborador_nao_encontrado');
  end if;
  insert into acessos_pin (empresa_id, colaborador_id, user_id, acao)
  values (v_emp, c.id, auth.uid(), 'ver');
  return jsonb_build_object('ok', true, 'pin', c.pin_fixo, 'nome', c.nome, 'matricula', c.matricula);
end $$;

-- ---------------------------------------------------------------------
-- 9) Reemitir (SÓ admin): troca o PIN por outro único, derruba as sessões e
--    desbloqueia. Para o caso de o PIN ter vazado.
-- ---------------------------------------------------------------------
create or replace function public.tecnico_reemitir_pin(p_colaborador uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_emp uuid := _exigir_tecnico(array['admin']); c public.colaboradores; v_novo text;
begin
  select * into c from colaboradores
   where id = p_colaborador and empresa_id = v_emp and ativo and not anonimizado;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'colaborador_nao_encontrado');
  end if;

  v_novo := _pin_unico(v_emp);
  update colaboradores
     set pin_fixo = v_novo, tentativas_falhas = 0, bloqueado_ate = null
   where id = c.id;
  update sessoes_colaborador set revogada = true where sessoes_colaborador.colaborador_id = c.id;

  insert into acessos_pin (empresa_id, colaborador_id, user_id, acao)
  values (v_emp, c.id, auth.uid(), 'reemitir');
  return jsonb_build_object('ok', true, 'pin', v_novo, 'nome', c.nome, 'matricula', c.matricula);
end $$;

grant execute on function
  public.tecnico_ver_pin(uuid),
  public.tecnico_reemitir_pin(uuid)
to authenticated;
-- tecnico_gerar_pins ja tem EXECUTE (create or replace preserva os grants).
-- _pin_unico e _colaborador_define_pin sao internas: sem EXECUTE para ninguem.
