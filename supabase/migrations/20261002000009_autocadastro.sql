-- =====================================================================
-- T.I.M.E. Seguro — 0009_autocadastro.sql
--
-- O colaborador pede o próprio cadastro (nome, matrícula, setor, e-mail da
-- empresa) e fica PENDENTE, sem nenhum acesso. Admin, técnico ou CIPA aprovam ou
-- recusam. Aprovado, nasce o colaborador (a trigger da 0008 já dá o PIN fixo) e
-- o gestor entrega o PIN. Envio por e-mail fica para uma etapa seguinte.
--
-- Padrão do Canal de Respeito: a tela pública só executa RPC. `anon` não lê
-- nem escreve tabela nenhuma (CLAUDE.md regra 4).
--
-- Migration NOVA: as anteriores já foram aplicadas e não se editam.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) E-mail do colaborador (necessário para a etapa de envio por e-mail)
-- ---------------------------------------------------------------------
alter table public.colaboradores add column if not exists email text;

create unique index colaboradores_email_unico
  on public.colaboradores (empresa_id, lower(email))
  where email is not null;

-- O painel lê o e-mail como lê a matrícula. Escrita só por RPC.
grant select (email) on public.colaboradores to authenticated;

-- ---------------------------------------------------------------------
-- 2) Solicitações de cadastro
-- ---------------------------------------------------------------------
create table public.solicitacoes_cadastro (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  nome          text not null check (char_length(trim(nome)) between 2 and 120),
  matricula     text not null check (char_length(trim(matricula)) between 1 and 40),
  email         text not null check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  setor_id      uuid references public.setores(id) on delete set null,
  status        text not null default 'pendente' check (status in ('pendente','aprovada','recusada')),
  motivo        text,
  decidido_por  uuid references auth.users(id) on delete set null,
  decidido_em   timestamptz,
  colaborador_id uuid references public.colaboradores(id) on delete set null,
  criado_em     timestamptz not null default now()
);

-- Uma pendente por matrícula e uma por e-mail: o mesmo pedido repetido não
-- enche a fila do gestor.
create unique index solicitacoes_matricula_pendente
  on public.solicitacoes_cadastro (empresa_id, matricula) where status = 'pendente';
create unique index solicitacoes_email_pendente
  on public.solicitacoes_cadastro (empresa_id, lower(email)) where status = 'pendente';
create index solicitacoes_empresa_status
  on public.solicitacoes_cadastro (empresa_id, status, criado_em desc);

alter table public.solicitacoes_cadastro enable row level security;
-- Tabela nova nasce com GRANT amplo no Supabase: tranca explicitamente.
revoke all on public.solicitacoes_cadastro from anon, authenticated;
grant select on public.solicitacoes_cadastro to authenticated;
create policy solicitacoes_ler on public.solicitacoes_cadastro for select to authenticated
  using (empresa_id = minha_empresa() and meu_papel() in ('admin','tecnico','cipa'));

-- ---------------------------------------------------------------------
-- 3) Públicas (anon): setores da empresa e pedido de cadastro
-- ---------------------------------------------------------------------
create or replace function public.publico_setores_da_empresa(p_empresa_codigo text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_emp uuid;
begin
  select id into v_emp from empresas where codigo = lower(trim(coalesce(p_empresa_codigo, '')));
  if v_emp is null then
    return jsonb_build_object('ok', false, 'motivo', 'empresa_nao_encontrada');
  end if;
  -- Empresa sem setor ainda devolve lista vazia, nao "nao encontrada".
  return jsonb_build_object('ok', true, 'setores', coalesce(
    (select jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome) order by s.nome)
       from setores s where s.empresa_id = v_emp and s.ativo),
    '[]'::jsonb));
end $$;

-- Pedido de cadastro. Resposta SEMPRE a mesma quando o pedido é aceito OU quando
-- a matrícula/e-mail já existe: quem está de fora não descobre quem trabalha ali.
create or replace function public.publico_solicitar_cadastro(
  p_empresa_codigo text, p_nome text, p_matricula text, p_email text, p_setor uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e public.empresas; v_nome text := trim(coalesce(p_nome, ''));
  v_mat text := trim(coalesce(p_matricula, '')); v_email text := lower(trim(coalesce(p_email, '')));
  v_setor uuid := null; v_dominios jsonb; v_dominio text;
begin
  select * into e from empresas where codigo = lower(trim(coalesce(p_empresa_codigo, '')));
  if not found then return jsonb_build_object('ok', false, 'motivo', 'empresa_nao_encontrada'); end if;

  if char_length(v_nome) < 2 or char_length(v_nome) > 120 then
    return jsonb_build_object('ok', false, 'motivo', 'nome_invalido');
  end if;
  if char_length(v_mat) < 1 or char_length(v_mat) > 40 then
    return jsonb_build_object('ok', false, 'motivo', 'matricula_invalida');
  end if;
  if v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(v_email) > 200 then
    return jsonb_build_object('ok', false, 'motivo', 'email_invalido');
  end if;

  -- Domínio do e-mail da empresa, se o admin configurou (empresas.config).
  v_dominios := e.config -> 'dominios_email';
  if jsonb_typeof(v_dominios) = 'array' and jsonb_array_length(v_dominios) > 0 then
    v_dominio := split_part(v_email, '@', 2);
    if not exists (select 1 from jsonb_array_elements_text(v_dominios) d where lower(trim(d)) = v_dominio) then
      return jsonb_build_object('ok', false, 'motivo', 'email_fora_do_dominio');
    end if;
  end if;

  -- Contra spam: teto de pendentes na hora e no total.
  if (select count(*) from solicitacoes_cadastro
       where empresa_id = e.id and criado_em > now() - interval '1 hour') >= 30
     or (select count(*) from solicitacoes_cadastro
          where empresa_id = e.id and status = 'pendente') >= 200 then
    return jsonb_build_object('ok', false, 'motivo', 'muitas_solicitacoes');
  end if;

  -- Já cadastrado ou já pendente: responde igual a sucesso, sem gravar.
  if exists (select 1 from colaboradores where empresa_id = e.id
              and (matricula = v_mat or lower(email) = v_email))
     or exists (select 1 from solicitacoes_cadastro where empresa_id = e.id and status = 'pendente'
                 and (matricula = v_mat or lower(email) = v_email)) then
    return jsonb_build_object('ok', true);
  end if;

  if p_setor is not null and exists (select 1 from setores where id = p_setor and empresa_id = e.id and ativo) then
    v_setor := p_setor;
  end if;

  insert into solicitacoes_cadastro (empresa_id, nome, matricula, email, setor_id)
  values (e.id, v_nome, v_mat, v_email, v_setor);
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------
-- 4) Decidir (admin, técnico e CIPA)
-- ---------------------------------------------------------------------
create or replace function public.tecnico_decidir_solicitacao(
  p_id uuid, p_aprovar boolean, p_setor uuid default null, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_emp uuid := _exigir_tecnico(array['admin','tecnico','cipa']); s public.solicitacoes_cadastro;
        v_setor uuid; v_colab uuid;
begin
  select * into s from solicitacoes_cadastro where id = p_id and empresa_id = v_emp for update;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'solicitacao_nao_encontrada'); end if;
  if s.status <> 'pendente' then return jsonb_build_object('ok', false, 'motivo', 'ja_decidida'); end if;

  if not coalesce(p_aprovar, false) then
    update solicitacoes_cadastro
       set status = 'recusada', motivo = nullif(trim(coalesce(p_motivo, '')), ''),
           decidido_por = auth.uid(), decidido_em = now()
     where id = s.id;
    return jsonb_build_object('ok', true);
  end if;

  -- O gestor pode corrigir o setor na hora de aprovar; precisa ser da empresa.
  v_setor := coalesce(p_setor, s.setor_id);
  if v_setor is not null and not exists (select 1 from setores where id = v_setor and empresa_id = v_emp) then
    v_setor := null;
  end if;

  if exists (select 1 from colaboradores where empresa_id = v_emp and matricula = s.matricula) then
    return jsonb_build_object('ok', false, 'motivo', 'matricula_ja_cadastrada');
  end if;

  -- A trigger da 0008 dá o PIN fixo e único.
  insert into colaboradores (empresa_id, matricula, nome, email, setor_id)
  values (v_emp, s.matricula, s.nome, s.email, v_setor)
  returning id into v_colab;

  update solicitacoes_cadastro
     set status = 'aprovada', setor_id = v_setor, colaborador_id = v_colab,
         decidido_por = auth.uid(), decidido_em = now()
   where id = s.id;
  return jsonb_build_object('ok', true, 'colaborador_id', v_colab);
end $$;

grant execute on function
  public.publico_setores_da_empresa(text),
  public.publico_solicitar_cadastro(text, text, text, text, uuid)
to anon, authenticated;

grant execute on function public.tecnico_decidir_solicitacao(uuid, boolean, uuid, text)
to authenticated;
