-- Gerado de docs/TIME_02_BANCO_DE_DADOS.md (linha 517) — NAO EDITAR O SQL.
-- O SQL deste arquivo foi testado em PostgreSQL 16. Mudanca de banco vira
-- migration NOVA; nunca editar uma migration ja aplicada.

-- =====================================================================
-- T.I.M.E. Seguro — 0002_time_funcoes_internas.sql
-- Funções auxiliares (prefixo "_" = interna, nunca exposta ao cliente)
-- e views de ranking / lacunas.
-- IMPORTANTE (Supabase): pgcrypto fica no schema "extensions",
-- por isso as funções usam  search_path = public, extensions
-- =====================================================================

-- "Dia operacional": o dia vira às 05h (Brasília), não à meia-noite,
-- para o turno da noite não ter o dia "partido" no meio do expediente.
create or replace function public.dia_operacional() returns date
language sql stable set search_path = public as $$
  select ((now() at time zone 'America/Sao_Paulo') - interval '5 hours')::date
$$;

-- Contexto do técnico logado (Supabase Auth)
create or replace function public.minha_empresa() returns uuid
language sql stable security definer set search_path = public as $$
  select empresa_id from perfis_tecnicos where user_id = auth.uid()
$$;

create or replace function public.meu_papel() returns text
language sql stable security definer set search_path = public as $$
  select papel from perfis_tecnicos where user_id = auth.uid()
$$;

create or replace function public.sou_comite_assedio() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select comite_assedio from perfis_tecnicos where user_id = auth.uid()), false)
$$;

create or replace function public._exigir_tecnico(p_papeis text[] default array['admin','tecnico'])
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_emp uuid;
begin
  select empresa_id into v_emp from perfis_tecnicos where user_id = auth.uid() and papel = any(p_papeis);
  if v_emp is null then
    raise exception 'acesso_negado' using errcode = 'P0001';
  end if;
  return v_emp;
end $$;

-- Lê um número da config da campanha, com valor padrão
create or replace function public._cfg(p_camp public.campanhas, p_chave text, p_padrao int)
returns int language sql immutable as $$
  select coalesce((p_camp.config ->> p_chave)::int, p_padrao)
$$;

-- Valida o token do app do colaborador e devolve o colaborador
create or replace function public._colaborador_da_sessao(p_token text)
returns public.colaboradores
language plpgsql stable security definer set search_path = public, extensions as $$
declare v public.colaboradores;
begin
  select c.* into v
    from sessoes_colaborador s
    join colaboradores c on c.id = s.colaborador_id
   where s.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
     and not s.revogada
     and s.expira_em > now()
     and c.ativo and not c.anonimizado;
  if not found then
    raise exception 'sessao_invalida' using errcode = 'P0001';
  end if;
  return v;
end $$;

-- Motivo pelo qual o colaborador ainda não pode usar o app (null = liberado)
create or replace function public._pendencia(p_colab public.colaboradores)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p_colab.pin_provisorio then 'trocar_pin'
    when coalesce(p_colab.lgpd_aceite_versao, 0) < (select termo_lgpd_versao from empresas where id = p_colab.empresa_id) then 'aceitar_lgpd'
    else null end
$$;

create or replace function public._campanha_ativa(p_empresa uuid)
returns public.campanhas language sql stable security definer set search_path = public as $$
  select * from campanhas
   where empresa_id = p_empresa and status = 'ativa'
     and dia_operacional() between inicio and fim
   limit 1
$$;

-- PIN aleatório de 6 dígitos (criptograficamente seguro)
create or replace function public._pin_aleatorio() returns text
language plpgsql volatile set search_path = public, extensions as $$
declare b bytea := gen_random_bytes(3);
begin
  return lpad((((get_byte(b,0) << 16) | (get_byte(b,1) << 8) | get_byte(b,2)) % 1000000)::text, 6, '0');
end $$;

-- Lança pontos no livro-razão. Idempotente: o mesmo fato nunca pontua 2x.
create or replace function public._lancar_pontos(
  p_campanha uuid, p_colaborador uuid, p_setor uuid,
  p_pilar text, p_origem text, p_origem_id uuid, p_pontos int)
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if p_pontos is null or p_pontos <= 0 then return 0; end if;
  insert into pontos_lancamentos (empresa_id, campanha_id, colaborador_id, setor_id, pilar, origem, origem_id, pontos, dia)
  select c.empresa_id, c.id, p_colaborador, p_setor, p_pilar, p_origem, p_origem_id, p_pontos, dia_operacional()
    from campanhas c where c.id = p_campanha
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return case when v_n > 0 then p_pontos else 0 end;
end $$;

-- Sequência de dias com atividade (fim de semana sem atividade não quebra a sequência)
create or replace function public._streak(p_colab uuid, p_camp uuid, p_dia date, p_ignora_fds boolean)
returns int language plpgsql stable security definer set search_path = public as $$
declare v_d date := p_dia; v_n int := 0; v_guard int := 0; v_tem boolean;
begin
  loop
    v_guard := v_guard + 1;
    exit when v_guard > 400;
    select exists (select 1 from atividade_diaria where colaborador_id = p_colab and campanha_id = p_camp and dia = v_d) into v_tem;
    if not v_tem and p_ignora_fds and extract(isodow from v_d) in (6, 7) then
      v_d := v_d - 1;
      continue;
    end if;
    exit when not v_tem;
    v_n := v_n + 1;
    v_d := v_d - 1;
  end loop;
  return v_n;
end $$;

-- Registra atividade do dia: presença diária + bônus de sequência (7/15/30 dias)
create or replace function public._registrar_atividade(p_colab public.colaboradores, p_camp public.campanhas)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dia date := dia_operacional();
  v_n int; v_streak int; v_bonus int := 0; v_marco int;
begin
  insert into atividade_diaria (empresa_id, colaborador_id, campanha_id, dia)
  values (p_colab.empresa_id, p_colab.id, p_camp.id, v_dia)
  on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('novo_dia', false);
  end if;

  perform _lancar_pontos(p_camp.id, p_colab.id, p_colab.setor_id, 'engajamento', 'presenca_diaria',
                         md5(p_colab.id::text || v_dia::text)::uuid, _cfg(p_camp, 'pontos_presenca', 2));

  v_streak := _streak(p_colab.id, p_camp.id, v_dia, coalesce((p_camp.config ->> 'streak_ignora_fds')::boolean, true));
  foreach v_marco in array array[7, 15, 30] loop
    if v_streak >= v_marco then
      v_bonus := v_bonus + _lancar_pontos(p_camp.id, p_colab.id, p_colab.setor_id, 'engajamento',
                   'streak_' || v_marco, p_camp.id,
                   _cfg(p_camp, 'pontos_streak_' || v_marco, case v_marco when 7 then 20 when 15 then 50 else 100 end));
    end if;
  end loop;
  return jsonb_build_object('novo_dia', true, 'streak', v_streak, 'bonus', v_bonus);
end $$;

-- Avalia e concede selos da campanha. Devolve os slugs recém-conquistados.
create or replace function public._avaliar_selos(p_colab uuid, p_camp uuid)
returns text[] language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid; v_novos text[] := '{}'; r record;
  v_resp int; v_acertos int; v_relatos int; v_dds int; v_streak int;
  v_obrig int; v_aprov int; v_media numeric; v_mestre boolean; v_respeito boolean;
begin
  select empresa_id into v_emp from campanhas where id = p_camp;

  select count(*), count(*) filter (where acertou and origem = 'diario')
    into v_resp, v_acertos
    from respostas where colaborador_id = p_colab and campanha_id = p_camp;

  select count(*) into v_relatos from relatos
   where colaborador_id = p_colab and campanha_id = p_camp and validado;

  select count(*) into v_dds from checkins ch join eventos e on e.id = ch.evento_id
   where ch.colaborador_id = p_colab and e.campanha_id = p_camp and e.tipo = 'dds';

  v_streak := _streak(p_colab, p_camp, dia_operacional(), true);

  select count(*), count(pl.aprovado_em), avg(pl.melhor_nota)
    into v_obrig, v_aprov, v_media
    from licoes l
    left join progresso_licoes pl on pl.licao_id = l.id and pl.colaborador_id = p_colab
   where l.campanha_id = p_camp and l.obrigatoria and l.publicada;
  v_mestre := v_obrig > 0 and v_aprov = v_obrig and coalesce(v_media, 0) >= 90;

  select exists (
    select 1 from progresso_licoes pl
      join licoes l on l.id = pl.licao_id
      join temas t on t.id = l.tema_id
     where pl.colaborador_id = p_colab and l.campanha_id = p_camp
       and pl.aprovado_em is not null and t.slug = 'assedio'
  ) into v_respeito;

  for r in
    select * from (values
      ('primeiro-passo',  v_resp >= 1),
      ('olho-vivo',       v_relatos >= 3),
      ('sentinela',       v_relatos >= 10),
      ('maratonista',     v_acertos >= 100),
      ('dds-em-dia',      v_dds >= 10),
      ('presenca-firme',  v_streak >= 10),
      ('mestre-das-nrs',  v_mestre),
      ('voz-do-respeito', v_respeito)
    ) as t(slug, ok)
  loop
    if r.ok then
      insert into selos_conquistados (empresa_id, selo_id, colaborador_id, campanha_id)
      select v_emp, s.id, p_colab, p_camp from selos s where s.slug = r.slug
      on conflict do nothing;
      if found then v_novos := v_novos || r.slug; end if;
    end if;
  end loop;
  return v_novos;
end $$;

-- Perguntas do dia de um colaborador: determinísticas no dia,
-- priorizando as que ele ainda NÃO acertou na campanha.
create or replace function public._perguntas_do_dia(p_colab uuid, p_camp public.campanhas, p_dia date)
returns setof public.perguntas language sql stable security definer set search_path = public as $$
  select p.* from perguntas p
   where p.status = 'ativa'
     and (p.empresa_id = p_camp.empresa_id or p.empresa_id is null)
     and p.tema_id in (select tema_id from campanha_temas where campanha_id = p_camp.id)
   order by
     exists (select 1 from respostas r
              where r.colaborador_id = p_colab and r.pergunta_id = p.id
                and r.campanha_id = p_camp.id and r.acertou and r.dia < p_dia),
     md5(p_colab::text || p_dia::text || p.id::text)
   limit p_camp.perguntas_por_dia
$$;

-- ---------------------------------------------------------------------
-- VIEWS (security_invoker: respeitam o RLS de quem consulta)
-- ---------------------------------------------------------------------
create or replace view public.v_ranking_individual with (security_invoker = on) as
select l.campanha_id,
       l.colaborador_id,
       c.nome,
       c.matricula,
       c.setor_id,
       sum(l.pontos)::int                                               as total,
       coalesce(sum(l.pontos) filter (where l.pilar = 'conhecimento'), 0)::int as conhecimento,
       coalesce(sum(l.pontos) filter (where l.pilar = 'relatos'), 0)::int      as relatos,
       coalesce(sum(l.pontos) filter (where l.pilar = 'engajamento'), 0)::int  as engajamento,
       max(l.criado_em)                                                  as ultimo_ponto_em
  from pontos_lancamentos l
  join colaboradores c on c.id = l.colaborador_id
 where l.colaborador_id is not null
 group by l.campanha_id, l.colaborador_id, c.nome, c.matricula, c.setor_id;

-- Setor = MÉDIA por colaborador ativo (setor grande não ganha só por tamanho) + pontos do Modo TV
create or replace view public.v_ranking_setor with (security_invoker = on) as
with base as (
  select camp.id as campanha_id, s.id as setor_id, s.nome, s.cor,
         (select count(*) from colaboradores c where c.setor_id = s.id and c.ativo)::int as colaboradores_ativos,
         coalesce((select sum(pontos) from pontos_lancamentos l
                    where l.campanha_id = camp.id and l.setor_id = s.id and l.colaborador_id is not null), 0)::int as pontos_individuais,
         coalesce((select sum(pontos) from pontos_lancamentos l
                    where l.campanha_id = camp.id and l.setor_id = s.id and l.colaborador_id is null), 0)::int as pontos_quiz_tv
    from campanhas camp
    join setores s on s.empresa_id = camp.empresa_id and s.ativo
)
select *, (round(pontos_individuais::numeric / greatest(colaboradores_ativos, 1)) + pontos_quiz_tv)::int as total
  from base;

-- Mapa de lacunas: taxa de acerto por SETOR x TEMA (app + Modo TV)
create or replace view public.v_lacunas with (security_invoker = on) as
with todas as (
  select r.empresa_id, r.campanha_id, c.setor_id, p.tema_id, r.acertou
    from respostas r
    join colaboradores c on c.id = r.colaborador_id
    join perguntas p on p.id = r.pergunta_id
  union all
  select qr.empresa_id, qs.campanha_id, qr.setor_id, p.tema_id, qr.acertou
    from quiz_tv_respostas qr
    join quiz_tv_sessoes qs on qs.id = qr.sessao_id
    join perguntas p on p.id = qr.pergunta_id
)
select empresa_id, campanha_id, setor_id, tema_id,
       count(*)::int                               as tentativas,
       count(*) filter (where acertou)::int        as acertos,
       round(100.0 * count(*) filter (where acertou) / count(*), 1) as taxa_acerto
  from todas
 where setor_id is not null
 group by empresa_id, campanha_id, setor_id, tema_id;

-- Desempenho por pergunta (para "perguntas mais erradas")
create or replace view public.v_desempenho_pergunta with (security_invoker = on) as
select r.empresa_id, r.campanha_id, r.pergunta_id, p.enunciado, p.tema_id,
       count(*)::int as tentativas,
       count(*) filter (where r.acertou)::int as acertos,
       round(100.0 * count(*) filter (where r.acertou) / count(*), 1) as taxa_acerto,
       mode() within group (order by r.alternativa) filter (where not r.acertou) as alternativa_errada_mais_comum
  from respostas r join perguntas p on p.id = r.pergunta_id
 group by r.empresa_id, r.campanha_id, r.pergunta_id, p.enunciado, p.tema_id;
