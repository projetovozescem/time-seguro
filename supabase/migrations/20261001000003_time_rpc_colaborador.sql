-- Gerado de docs/TIME_02_BANCO_DE_DADOS.md (linha 817) — NAO EDITAR O SQL.
-- O SQL deste arquivo foi testado em PostgreSQL 16. Mudanca de banco vira
-- migration NOVA; nunca editar uma migration ja aplicada.

-- =====================================================================
-- T.I.M.E. Seguro — 0003_time_rpc_colaborador.sql
-- RPCs chamadas pelo APP DO COLABORADOR (role anon + token de sessão)
-- e RPCs PÚBLICAS (Canal de Respeito, verificação de certificado).
-- Toda função devolve jsonb { ok: bool, motivo?: text, ... }.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PÚBLICO: dados mínimos da empresa (tela de login / Canal de Respeito)
-- ---------------------------------------------------------------------
create or replace function public.empresa_publica(p_codigo text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('ok', true, 'nome', nome, 'codigo', codigo, 'logo_url', logo_url)
       from empresas where codigo = lower(trim(p_codigo))),
    jsonb_build_object('ok', false, 'motivo', 'empresa_nao_encontrada'))
$$;

-- ---------------------------------------------------------------------
-- LOGIN: código da empresa + matrícula + PIN (6 dígitos)
-- 5 erros seguidos = bloqueio de 15 min. Mensagem de erro sempre igual
-- (não revela se a matrícula existe).
-- ---------------------------------------------------------------------
create or replace function public.colaborador_login(p_empresa_codigo text, p_matricula text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v public.colaboradores; v_token text; v_versao int;
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

  if v.pin_hash is null or v.pin_hash <> crypt(coalesce(p_pin, ''), v.pin_hash) then
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

  select termo_lgpd_versao into v_versao from empresas where id = v.empresa_id;

  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'nome', v.nome,
    'pendencia', _pendencia(v)
  );
end $$;

create or replace function public.colaborador_logout(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  update sessoes_colaborador set revogada = true
   where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  return jsonb_build_object('ok', true);
end $$;

-- Troca de PIN (obrigatória no 1º acesso). PIN: 6 dígitos, sem repetição
-- (111111) e sem sequência (123456 / 654321).
create or replace function public.colaborador_trocar_pin(p_token text, p_pin_atual text, p_pin_novo text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v public.colaboradores;
begin
  v := _colaborador_da_sessao(p_token);
  if v.pin_hash <> crypt(coalesce(p_pin_atual, ''), v.pin_hash) then
    return jsonb_build_object('ok', false, 'motivo', 'pin_atual_incorreto');
  end if;
  if p_pin_novo !~ '^\d{6}$'
     or p_pin_novo ~ '^(\d)\1{5}$'
     or p_pin_novo in ('012345','123456','234567','345678','456789','987654','876543','765432','654321','543210')
     or p_pin_novo = p_pin_atual then
    return jsonb_build_object('ok', false, 'motivo', 'pin_fraco');
  end if;
  update colaboradores
     set pin_hash = crypt(p_pin_novo, gen_salt('bf', 8)), pin_provisorio = false
   where id = v.id;
  select * into v from colaboradores where id = v.id;
  return jsonb_build_object('ok', true, 'pendencia', _pendencia(v));
end $$;

create or replace function public.colaborador_termo_lgpd(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v public.colaboradores; e public.empresas;
begin
  v := _colaborador_da_sessao(p_token);
  select * into e from empresas where id = v.empresa_id;
  return jsonb_build_object('ok', true, 'empresa', e.nome, 'versao', e.termo_lgpd_versao, 'texto', e.termo_lgpd_texto);
end $$;

create or replace function public.colaborador_aceitar_lgpd(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.colaboradores; v_versao int;
begin
  v := _colaborador_da_sessao(p_token);
  select termo_lgpd_versao into v_versao from empresas where id = v.empresa_id;
  update colaboradores set lgpd_aceite_versao = v_versao, lgpd_aceite_em = now() where id = v.id;
  insert into consentimentos_lgpd (empresa_id, colaborador_id, versao) values (v.empresa_id, v.id, v_versao);
  select * into v from colaboradores where id = v.id;
  return jsonb_build_object('ok', true, 'pendencia', _pendencia(v));
end $$;

-- ---------------------------------------------------------------------
-- HOME DO APP
-- ---------------------------------------------------------------------
create or replace function public.colaborador_resumo(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v public.colaboradores; c public.campanhas; v_dia date := dia_operacional();
  v_pts record; v_pos_ind int; v_pos_setor int; v_setor text;
  v_quiz_resp int; v_quiz_total int; v_lic_aprov int; v_lic_total int;
  v_rel_abertos int; v_rel_valid int;
begin
  v := _colaborador_da_sessao(p_token);
  select nome into v_setor from setores where id = v.setor_id;
  c := _campanha_ativa(v.empresa_id);

  if c.id is null then
    return jsonb_build_object('ok', true, 'nome', v.nome, 'setor', v_setor, 'pendencia', _pendencia(v), 'campanha', null);
  end if;

  select coalesce(sum(pontos), 0)::int as total,
         coalesce(sum(pontos) filter (where pilar = 'conhecimento'), 0)::int as conhecimento,
         coalesce(sum(pontos) filter (where pilar = 'relatos'), 0)::int as relatos,
         coalesce(sum(pontos) filter (where pilar = 'engajamento'), 0)::int as engajamento,
         coalesce(sum(pontos) filter (where dia = v_dia), 0)::int as hoje
    into v_pts
    from pontos_lancamentos where campanha_id = c.id and colaborador_id = v.id;

  if c.ranking_visivel then
    select pos into v_pos_ind from (
      select colaborador_id, rank() over (order by total desc) as pos
        from v_ranking_individual where campanha_id = c.id) x
     where colaborador_id = v.id;
    select pos into v_pos_setor from (
      select setor_id, rank() over (order by total desc) as pos
        from v_ranking_setor where campanha_id = c.id) x
     where setor_id = v.setor_id;
  end if;

  select count(*) into v_quiz_resp from respostas
   where colaborador_id = v.id and dia = v_dia and origem = 'diario';
  select count(*) into v_quiz_total from _perguntas_do_dia(v.id, c, v_dia);

  select count(*) filter (where pl.aprovado_em is not null), count(*)
    into v_lic_aprov, v_lic_total
    from licoes l left join progresso_licoes pl on pl.licao_id = l.id and pl.colaborador_id = v.id
   where l.campanha_id = c.id and l.publicada;

  select count(*) filter (where status in ('aberto','em_analise','em_correcao')),
         count(*) filter (where validado)
    into v_rel_abertos, v_rel_valid
    from relatos where colaborador_id = v.id and campanha_id = c.id;

  return jsonb_build_object(
    'ok', true,
    'nome', v.nome,
    'setor', v_setor,
    'pendencia', _pendencia(v),
    'campanha', jsonb_build_object(
      'id', c.id, 'nome', c.nome, 'inicio', c.inicio, 'fim', c.fim,
      'dias_restantes', greatest(c.fim - v_dia, 0),
      'premiacao', c.premiacao, 'ranking_visivel', c.ranking_visivel),
    'pontos', to_jsonb(v_pts),
    'streak', _streak(v.id, c.id, v_dia, coalesce((c.config ->> 'streak_ignora_fds')::boolean, true)),
    'posicao_individual', v_pos_ind,
    'posicao_setor', v_pos_setor,
    'quiz_hoje', jsonb_build_object('respondidas', v_quiz_resp, 'total', v_quiz_total),
    'licoes', jsonb_build_object('aprovadas', v_lic_aprov, 'total', v_lic_total),
    'relatos', jsonb_build_object('em_andamento', v_rel_abertos, 'validados', v_rel_valid)
  );
end $$;

-- ---------------------------------------------------------------------
-- QUIZ DIÁRIO (o gabarito só volta DEPOIS de responder)
-- ---------------------------------------------------------------------
create or replace function public.colaborador_perguntas_do_dia(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v public.colaboradores; c public.campanhas; v_dia date := dia_operacional(); v_lista jsonb;
begin
  v := _colaborador_da_sessao(p_token);
  if _pendencia(v) is not null then return jsonb_build_object('ok', false, 'motivo', _pendencia(v)); end if;
  c := _campanha_ativa(v.empresa_id);
  if c.id is null then return jsonb_build_object('ok', false, 'motivo', 'sem_campanha'); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', q.id, 'enunciado', q.enunciado, 'alternativas', q.alternativas,
           'tema', t.nome, 'tema_icone', t.icone,
           'respondida', r.id is not null,
           'acertou', r.acertou,
           'alternativa_escolhida', r.alternativa,
           'correta',    case when r.id is not null then q.correta end,
           'explicacao', case when r.id is not null then q.explicacao end
         ) order by q.ordinality), '[]'::jsonb)
    into v_lista
    from _perguntas_do_dia(v.id, c, v_dia) with ordinality as q
    join temas t on t.id = q.tema_id
    left join respostas r on r.colaborador_id = v.id and r.pergunta_id = q.id
                         and r.dia = v_dia and r.origem = 'diario';

  return jsonb_build_object('ok', true, 'dia', v_dia, 'perguntas', v_lista,
                            'pontos_por_acerto', _cfg(c, 'pontos_acerto_diario', 10));
end $$;

create or replace function public.colaborador_responder_pergunta(
  p_token text, p_pergunta_id uuid, p_alternativa int, p_tempo_ms int default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v public.colaboradores; c public.campanhas; p public.perguntas;
  v_dia date := dia_operacional(); v_ok boolean; v_resp_id uuid; v_pts int := 0;
  v_ativ jsonb; v_selos text[];
begin
  v := _colaborador_da_sessao(p_token);
  if _pendencia(v) is not null then return jsonb_build_object('ok', false, 'motivo', _pendencia(v)); end if;
  c := _campanha_ativa(v.empresa_id);
  if c.id is null then return jsonb_build_object('ok', false, 'motivo', 'sem_campanha'); end if;

  if not exists (select 1 from _perguntas_do_dia(v.id, c, v_dia) q where q.id = p_pergunta_id) then
    return jsonb_build_object('ok', false, 'motivo', 'pergunta_invalida');
  end if;
  select * into p from perguntas where id = p_pergunta_id;
  if p_alternativa is null or p_alternativa < 0 or p_alternativa >= array_length(p.alternativas, 1) then
    return jsonb_build_object('ok', false, 'motivo', 'alternativa_invalida');
  end if;

  v_ok := (p_alternativa = p.correta);
  insert into respostas (empresa_id, campanha_id, colaborador_id, pergunta_id, origem, alternativa, acertou, tempo_ms, dia)
  values (v.empresa_id, c.id, v.id, p.id, 'diario', p_alternativa, v_ok, greatest(coalesce(p_tempo_ms, 0), 0), v_dia)
  on conflict (colaborador_id, pergunta_id, dia) where origem = 'diario' do nothing
  returning id into v_resp_id;

  if v_resp_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'ja_respondida', 'correta', p.correta, 'explicacao', p.explicacao);
  end if;

  v_ativ := _registrar_atividade(v, c);
  if v_ok then
    v_pts := _lancar_pontos(c.id, v.id, v.setor_id, 'conhecimento', 'quiz_diario', v_resp_id,
                            _cfg(c, 'pontos_acerto_diario', 10));
  end if;
  v_selos := _avaliar_selos(v.id, c.id);

  return jsonb_build_object('ok', true, 'acertou', v_ok, 'correta', p.correta, 'explicacao', p.explicacao,
                            'pontos', v_pts, 'atividade', v_ativ, 'novos_selos', to_jsonb(v_selos));
end $$;

-- ---------------------------------------------------------------------
-- TRILHA DE TREINAMENTOS (lições + avaliação)
-- ---------------------------------------------------------------------
create or replace function public.colaborador_trilha(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v public.colaboradores; c public.campanhas; v_lista jsonb;
begin
  v := _colaborador_da_sessao(p_token);
  if _pendencia(v) is not null then return jsonb_build_object('ok', false, 'motivo', _pendencia(v)); end if;
  c := _campanha_ativa(v.empresa_id);
  if c.id is null then return jsonb_build_object('ok', false, 'motivo', 'sem_campanha'); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', l.id, 'titulo', l.titulo, 'tema', t.nome, 'tema_icone', t.icone,
           'carga_minutos', l.carga_minutos, 'obrigatoria', l.obrigatoria, 'nota_minima', l.nota_minima,
           'conteudo_concluido', pl.conteudo_concluido_em is not null,
           'melhor_nota', pl.melhor_nota,
           'aprovado', pl.aprovado_em is not null
         ) order by l.ordem, l.criado_em), '[]'::jsonb)
    into v_lista
    from licoes l
    left join temas t on t.id = l.tema_id
    left join progresso_licoes pl on pl.licao_id = l.id and pl.colaborador_id = v.id
   where l.campanha_id = c.id and l.publicada;

  return jsonb_build_object('ok', true, 'licoes', v_lista);
end $$;

create or replace function public.colaborador_licao(p_token text, p_licao uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v public.colaboradores; c public.campanhas; l public.licoes; pl public.progresso_licoes; v_perg jsonb;
begin
  v := _colaborador_da_sessao(p_token);
  if _pendencia(v) is not null then return jsonb_build_object('ok', false, 'motivo', _pendencia(v)); end if;
  c := _campanha_ativa(v.empresa_id);
  select * into l from licoes where id = p_licao and campanha_id = c.id and publicada;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'licao_invalida'); end if;
  select * into pl from progresso_licoes where licao_id = l.id and colaborador_id = v.id;

  -- perguntas da avaliação, SEM gabarito, só depois de concluir o conteúdo
  if pl.conteudo_concluido_em is not null then
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'enunciado', p.enunciado, 'alternativas', p.alternativas)
                              order by lp.ordem), '[]'::jsonb)
      into v_perg
      from licao_perguntas lp join perguntas p on p.id = lp.pergunta_id
     where lp.licao_id = l.id and p.status = 'ativa';
  end if;

  return jsonb_build_object('ok', true,
    'licao', jsonb_build_object('id', l.id, 'titulo', l.titulo, 'conteudo_md', l.conteudo_md,
                                'video_url', l.video_url, 'carga_minutos', l.carga_minutos,
                                'nota_minima', l.nota_minima),
    'progresso', jsonb_build_object('conteudo_concluido', pl.conteudo_concluido_em is not null,
                                    'melhor_nota', pl.melhor_nota, 'aprovado', pl.aprovado_em is not null,
                                    'tentativas_hoje', case when pl.ultima_tentativa_dia = dia_operacional() then pl.tentativas_hoje else 0 end),
    'avaliacao', v_perg);
end $$;

create or replace function public.colaborador_concluir_conteudo(p_token text, p_licao uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.colaboradores; c public.campanhas; l public.licoes; v_pts int;
begin
  v := _colaborador_da_sessao(p_token);
  if _pendencia(v) is not null then return jsonb_build_object('ok', false, 'motivo', _pendencia(v)); end if;
  c := _campanha_ativa(v.empresa_id);
  select * into l from licoes where id = p_licao and campanha_id = c.id and publicada;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'licao_invalida'); end if;

  insert into progresso_licoes (empresa_id, licao_id, colaborador_id, conteudo_concluido_em)
  values (v.empresa_id, l.id, v.id, now())
  on conflict (licao_id, colaborador_id)
  do update set conteudo_concluido_em = coalesce(progresso_licoes.conteudo_concluido_em, excluded.conteudo_concluido_em);

  perform _registrar_atividade(v, c);
  v_pts := _lancar_pontos(c.id, v.id, v.setor_id, 'conhecimento', 'licao_conteudo', l.id, _cfg(c, 'pontos_licao_conteudo', 20));
  return jsonb_build_object('ok', true, 'pontos', v_pts, 'novos_selos', to_jsonb(_avaliar_selos(v.id, c.id)));
end $$;

-- p_respostas: [{ "pergunta_id": uuid, "alternativa": int, "tempo_ms": int }]
-- O servidor corrige. Máx. 3 tentativas por dia. Pontua só na 1ª aprovação.
create or replace function public.colaborador_enviar_avaliacao(p_token text, p_licao uuid, p_respostas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v public.colaboradores; c public.campanhas; l public.licoes; pl public.progresso_licoes;
  v_dia date := dia_operacional(); v_total int; v_acertos int := 0; v_nota int;
  v_aprovado boolean; v_pts int := 0; v_gabarito jsonb := '[]'::jsonb; r record; v_alt int; v_ok boolean;
begin
  v := _colaborador_da_sessao(p_token);
  if _pendencia(v) is not null then return jsonb_build_object('ok', false, 'motivo', _pendencia(v)); end if;
  c := _campanha_ativa(v.empresa_id);
  select * into l from licoes where id = p_licao and campanha_id = c.id and publicada;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'licao_invalida'); end if;

  select * into pl from progresso_licoes where licao_id = l.id and colaborador_id = v.id for update;
  if pl.conteudo_concluido_em is null then
    return jsonb_build_object('ok', false, 'motivo', 'conteudo_nao_concluido');
  end if;
  if pl.ultima_tentativa_dia = v_dia and pl.tentativas_hoje >= _cfg(c, 'tentativas_avaliacao_dia', 3) then
    return jsonb_build_object('ok', false, 'motivo', 'limite_tentativas');
  end if;

  select count(*) into v_total from licao_perguntas lp join perguntas p on p.id = lp.pergunta_id
   where lp.licao_id = l.id and p.status = 'ativa';
  if v_total = 0 then return jsonb_build_object('ok', false, 'motivo', 'sem_avaliacao'); end if;

  for r in
    select p.id, p.correta, p.explicacao from licao_perguntas lp join perguntas p on p.id = lp.pergunta_id
     where lp.licao_id = l.id and p.status = 'ativa' order by lp.ordem
  loop
    select (e ->> 'alternativa')::int into v_alt
      from jsonb_array_elements(coalesce(p_respostas, '[]'::jsonb)) e
     where (e ->> 'pergunta_id')::uuid = r.id limit 1;
    v_ok := v_alt is not null and v_alt = r.correta;
    if v_ok then v_acertos := v_acertos + 1; end if;
    if v_alt is not null then
      insert into respostas (empresa_id, campanha_id, colaborador_id, pergunta_id, origem, licao_id, alternativa, acertou, dia)
      values (v.empresa_id, c.id, v.id, r.id, 'licao', l.id, v_alt, v_ok, v_dia);
    end if;
    v_gabarito := v_gabarito || jsonb_build_object('pergunta_id', r.id, 'correta', r.correta,
                                                   'escolhida', v_alt, 'acertou', v_ok, 'explicacao', r.explicacao);
  end loop;

  v_nota := round(100.0 * v_acertos / v_total);
  v_aprovado := v_nota >= l.nota_minima;

  update progresso_licoes set
    tentativas = tentativas + 1,
    tentativas_hoje = case when ultima_tentativa_dia = v_dia then tentativas_hoje + 1 else 1 end,
    ultima_tentativa_dia = v_dia,
    melhor_nota = greatest(coalesce(melhor_nota, 0), v_nota),
    aprovado_em = case when v_aprovado and aprovado_em is null then now() else aprovado_em end
  where id = pl.id;

  perform _registrar_atividade(v, c);
  if v_aprovado then
    v_pts := _lancar_pontos(c.id, v.id, v.setor_id, 'conhecimento', 'licao_aprovada', l.id,
                            _cfg(c, 'pontos_licao_aprovada', 30));
    if v_nota = 100 then
      v_pts := v_pts + _lancar_pontos(c.id, v.id, v.setor_id, 'conhecimento', 'licao_nota_maxima', l.id,
                                      _cfg(c, 'pontos_licao_nota_maxima', 10));
    end if;
  end if;

  return jsonb_build_object('ok', true, 'nota', v_nota, 'aprovado', v_aprovado, 'pontos', v_pts,
                            'gabarito', v_gabarito, 'novos_selos', to_jsonb(_avaliar_selos(v.id, c.id)));
end $$;

-- ---------------------------------------------------------------------
-- CHECK-IN EM DDS / SIPAT (QR Code com código que muda a cada 60 s na TV)
-- ---------------------------------------------------------------------
create or replace function public.colaborador_checkin(p_token text, p_evento uuid, p_codigo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.colaboradores; c public.campanhas; e public.eventos; v_id uuid; v_pts int := 0;
begin
  v := _colaborador_da_sessao(p_token);
  if _pendencia(v) is not null then return jsonb_build_object('ok', false, 'motivo', _pendencia(v)); end if;
  select * into e from eventos where id = p_evento and empresa_id = v.empresa_id and status <> 'cancelado';
  if not found then return jsonb_build_object('ok', false, 'motivo', 'evento_invalido'); end if;
  if now() not between e.inicio - interval '30 minutes' and e.fim + interval '30 minutes' then
    return jsonb_build_object('ok', false, 'motivo', 'fora_do_horario');
  end if;
  if e.setor_id is not null and e.setor_id is distinct from v.setor_id then
    return jsonb_build_object('ok', false, 'motivo', 'outro_setor');
  end if;
  if upper(trim(coalesce(p_codigo, ''))) is distinct from e.codigo_checkin
     and not coalesce(upper(trim(p_codigo)) = e.codigo_anterior
                      and e.codigo_atualizado_em > now() - interval '3 minutes', false) then
    return jsonb_build_object('ok', false, 'motivo', 'codigo_expirado');
  end if;

  insert into checkins (empresa_id, evento_id, colaborador_id) values (v.empresa_id, e.id, v.id)
  on conflict do nothing returning id into v_id;
  if v_id is null then return jsonb_build_object('ok', false, 'motivo', 'ja_fez_checkin'); end if;

  if e.campanha_id is not null then
    select * into c from campanhas where id = e.campanha_id and status = 'ativa';
    if c.id is not null then
      perform _registrar_atividade(v, c);
      v_pts := _lancar_pontos(c.id, v.id, v.setor_id, 'engajamento', 'checkin', e.id, e.pontos);
      perform _avaliar_selos(v.id, c.id);
    end if;
  end if;
  return jsonb_build_object('ok', true, 'evento', e.titulo, 'pontos', v_pts);
end $$;

-- ---------------------------------------------------------------------
-- RELATOS (a foto sobe depois, via Edge Function "relato-upload-url")
-- ---------------------------------------------------------------------
create or replace function public.colaborador_criar_relato(
  p_token text, p_categoria text, p_descricao text, p_local uuid default null, p_setor uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v public.colaboradores; c public.campanhas; v_setor uuid; v_dup uuid; v_id uuid; v_hoje int;
begin
  v := _colaborador_da_sessao(p_token);
  if _pendencia(v) is not null then return jsonb_build_object('ok', false, 'motivo', _pendencia(v)); end if;
  if p_categoria not in ('condicao_insegura','ato_inseguro','quase_acidente','melhoria') then
    return jsonb_build_object('ok', false, 'motivo', 'categoria_invalida');
  end if;
  if char_length(coalesce(trim(p_descricao), '')) < 10 then
    return jsonb_build_object('ok', false, 'motivo', 'descricao_curta');
  end if;

  select count(*) into v_hoje from relatos
   where colaborador_id = v.id and criado_em > now() - interval '24 hours';
  if v_hoje >= 10 then return jsonb_build_object('ok', false, 'motivo', 'limite_diario'); end if;

  if p_local is not null then
    select setor_id into v_setor from locais where id = p_local and empresa_id = v.empresa_id and ativo;
    if v_setor is null then return jsonb_build_object('ok', false, 'motivo', 'local_invalido'); end if;
  else
    select id into v_setor from setores where id = coalesce(p_setor, v.setor_id) and empresa_id = v.empresa_id;
  end if;

  -- possível duplicado: mesmo local (ou setor) + mesma categoria, últimos 7 dias, ainda não descartado
  select id into v_dup from relatos
   where empresa_id = v.empresa_id and categoria = p_categoria
     and criado_em > now() - interval '7 days'
     and status not in ('rejeitado','duplicado','resolvido')
     and ((p_local is not null and local_id = p_local) or (p_local is null and local_id is null and setor_id = v_setor))
   order by criado_em limit 1;

  c := _campanha_ativa(v.empresa_id);
  insert into relatos (empresa_id, campanha_id, colaborador_id, setor_id, local_id, categoria, descricao, possivel_duplicado_de)
  values (v.empresa_id, c.id, v.id, v_setor, p_local, p_categoria, trim(p_descricao), v_dup)
  returning id into v_id;

  insert into relato_historico (empresa_id, relato_id, status, comentario)
  values (v.empresa_id, v_id, 'aberto', 'Relato enviado pelo colaborador.');

  if c.id is not null then perform _registrar_atividade(v, c); end if;
  return jsonb_build_object('ok', true, 'relato_id', v_id);
end $$;

-- Usada SOMENTE pela Edge Function (service_role) para autorizar o upload da foto
create or replace function public._relato_caminho_foto(p_token text, p_relato uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v public.colaboradores; r public.relatos; v_path text;
begin
  v := _colaborador_da_sessao(p_token);
  select * into r from relatos where id = p_relato and colaborador_id = v.id;
  if not found or r.foto_path is not null or r.criado_em < now() - interval '30 minutes' then
    raise exception 'upload_nao_permitido' using errcode = 'P0001';
  end if;
  v_path := r.empresa_id::text || '/' || r.id::text || '.jpg';
  update relatos set foto_path = v_path where id = r.id;
  return v_path;
end $$;

create or replace function public.colaborador_meus_relatos(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v public.colaboradores; v_lista jsonb;
begin
  v := _colaborador_da_sessao(p_token);
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'categoria', r.categoria, 'descricao', r.descricao, 'status', r.status,
           'validado', r.validado, 'criado_em', r.criado_em, 'local', lo.nome, 'tem_foto', r.foto_path is not null,
           'historico', (select coalesce(jsonb_agg(jsonb_build_object('status', h.status, 'comentario', h.comentario, 'em', h.criado_em)
                                                   order by h.criado_em), '[]'::jsonb)
                           from relato_historico h where h.relato_id = r.id and h.visivel_colaborador)
         ) order by r.criado_em desc), '[]'::jsonb)
    into v_lista
    from relatos r left join locais lo on lo.id = r.local_id
   where r.colaborador_id = v.id;
  return jsonb_build_object('ok', true, 'relatos', v_lista);
end $$;

-- Ao escanear o QR de um LOCAL: dados para pré-preencher o relato
create or replace function public.colaborador_local(p_token text, p_local uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v public.colaboradores; v_res jsonb;
begin
  v := _colaborador_da_sessao(p_token);
  select jsonb_build_object('ok', true, 'id', l.id, 'nome', l.nome, 'descricao', l.descricao, 'setor', s.nome)
    into v_res
    from locais l join setores s on s.id = l.setor_id
   where l.id = p_local and l.empresa_id = v.empresa_id and l.ativo;
  return coalesce(v_res, jsonb_build_object('ok', false, 'motivo', 'local_invalido'));
end $$;

-- ---------------------------------------------------------------------
-- RANKING E PERFIL
-- ---------------------------------------------------------------------
-- Nome no ranking: "Primeiro nome + inicial" (ex.: "Carlos S.")
create or replace function public._nome_curto(p_nome text) returns text
language sql immutable as $$
  select split_part(trim(p_nome), ' ', 1)
         || case when position(' ' in trim(p_nome)) > 0
                 then ' ' || left(split_part(trim(p_nome), ' ', array_length(string_to_array(trim(p_nome), ' '), 1)), 1) || '.'
                 else '' end
$$;

create or replace function public.colaborador_ranking(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v public.colaboradores; c public.campanhas; v_ind jsonb; v_setor jsonb; v_meu jsonb;
begin
  v := _colaborador_da_sessao(p_token);
  c := _campanha_ativa(v.empresa_id);
  if c.id is null then return jsonb_build_object('ok', false, 'motivo', 'sem_campanha'); end if;
  if not c.ranking_visivel then return jsonb_build_object('ok', false, 'motivo', 'ranking_oculto'); end if;

  with rk as (
    select ri.*, rank() over (order by total desc) as pos from v_ranking_individual ri where campanha_id = c.id)
  select coalesce(jsonb_agg(jsonb_build_object('posicao', rk.pos, 'nome', _nome_curto(rk.nome), 'setor', s.nome,
                                               'total', rk.total, 'eu', rk.colaborador_id = v.id) order by rk.pos), '[]'::jsonb)
    into v_ind
    from (select * from rk order by pos limit 10) rk left join setores s on s.id = rk.setor_id;

  with rk as (
    select ri.*, rank() over (order by total desc) as pos from v_ranking_individual ri where campanha_id = c.id)
  select jsonb_build_object('posicao', pos, 'total', total) into v_meu from rk where colaborador_id = v.id;

  select coalesce(jsonb_agg(jsonb_build_object('posicao', pos, 'setor', nome, 'total', total,
                                               'meu_setor', setor_id = v.setor_id) order by pos), '[]'::jsonb)
    into v_setor
    from (select rs.*, rank() over (order by total desc) as pos from v_ranking_setor rs where campanha_id = c.id) x;

  return jsonb_build_object('ok', true, 'top10', v_ind, 'eu', v_meu, 'setores', v_setor);
end $$;

create or replace function public.colaborador_perfil(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v public.colaboradores; c public.campanhas; v_selos jsonb; v_extrato jsonb; v_cert jsonb;
begin
  v := _colaborador_da_sessao(p_token);
  c := _campanha_ativa(v.empresa_id);

  select coalesce(jsonb_agg(jsonb_build_object('slug', s.slug, 'nome', s.nome, 'descricao', s.descricao, 'icone', s.icone,
                                               'conquistado', sc.id is not null, 'em', sc.conquistado_em) order by s.ordem), '[]'::jsonb)
    into v_selos
    from selos s
    left join selos_conquistados sc on sc.selo_id = s.id and sc.colaborador_id = v.id and sc.campanha_id = c.id;

  select coalesce(jsonb_agg(x order by (x ->> 'em') desc), '[]'::jsonb) into v_extrato from (
    select jsonb_build_object('pilar', pilar, 'origem', origem, 'pontos', pontos, 'em', criado_em) as x
      from pontos_lancamentos where colaborador_id = v.id and campanha_id = c.id
     order by criado_em desc limit 50) t;

  select coalesce(jsonb_agg(jsonb_build_object('id', ce.id, 'tipo', ce.tipo, 'titulo', ce.titulo, 'codigo', ce.codigo,
                                               'emitido_em', ce.emitido_em, 'carga_minutos', ce.carga_minutos,
                                               'campanha', ca.nome, 'dados', ce.dados) order by ce.emitido_em desc), '[]'::jsonb)
    into v_cert
    from certificados ce join campanhas ca on ca.id = ce.campanha_id
   where ce.colaborador_id = v.id;

  return jsonb_build_object('ok', true, 'nome', v.nome, 'matricula', v.matricula,
                            'selos', v_selos, 'extrato', v_extrato, 'certificados', v_cert);
end $$;

-- ---------------------------------------------------------------------
-- CANAL DE RESPEITO (anônimo) — NÃO recebe token, NÃO pontua,
-- NÃO grava hora/IP/aparelho. Devolve protocolo + senha UMA vez.
-- ---------------------------------------------------------------------
create or replace function public.registrar_denuncia_assedio(
  p_empresa_codigo text, p_categoria text, p_descricao text,
  p_local text default null, p_periodo text default null, p_quer_retorno boolean default true)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_emp uuid; v_protocolo text; v_senha text;
begin
  select id into v_emp from empresas where codigo = lower(trim(p_empresa_codigo));
  if v_emp is null then return jsonb_build_object('ok', false, 'motivo', 'empresa_nao_encontrada'); end if;
  if p_categoria not in ('moral','sexual','discriminacao','outro') then
    return jsonb_build_object('ok', false, 'motivo', 'categoria_invalida');
  end if;
  if char_length(coalesce(trim(p_descricao), '')) < 20 then
    return jsonb_build_object('ok', false, 'motivo', 'descricao_curta');
  end if;

  loop
    v_protocolo := 'RS-' || upper(encode(gen_random_bytes(4), 'hex'));
    exit when not exists (select 1 from denuncias_assedio where protocolo = v_protocolo);
  end loop;
  v_senha := upper(encode(gen_random_bytes(4), 'hex'));

  insert into denuncias_assedio (empresa_id, protocolo, senha_hash, categoria, descricao, local_aproximado, periodo_aproximado, quer_retorno)
  values (v_emp, v_protocolo, crypt(v_senha, gen_salt('bf', 8)), p_categoria, trim(p_descricao),
          nullif(trim(p_local), ''), nullif(trim(p_periodo), ''), coalesce(p_quer_retorno, true));

  return jsonb_build_object('ok', true, 'protocolo', v_protocolo, 'senha', v_senha);
end $$;

create or replace function public.consultar_denuncia(p_protocolo text, p_senha text)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare d public.denuncias_assedio; v_msgs jsonb;
begin
  select * into d from denuncias_assedio where protocolo = upper(trim(p_protocolo));
  if not found or d.senha_hash <> crypt(upper(trim(coalesce(p_senha, ''))), d.senha_hash) then
    return jsonb_build_object('ok', false, 'motivo', 'protocolo_ou_senha_invalidos');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('autor', autor, 'mensagem', mensagem, 'em', enviada_em) order by ordem), '[]'::jsonb)
    into v_msgs from denuncia_mensagens where denuncia_id = d.id;
  return jsonb_build_object('ok', true, 'status', d.status, 'recebida_em', d.recebida_em, 'mensagens', v_msgs);
end $$;

create or replace function public.responder_denuncia_denunciante(p_protocolo text, p_senha text, p_mensagem text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare d public.denuncias_assedio;
begin
  select * into d from denuncias_assedio where protocolo = upper(trim(p_protocolo));
  if not found or d.senha_hash <> crypt(upper(trim(coalesce(p_senha, ''))), d.senha_hash) then
    return jsonb_build_object('ok', false, 'motivo', 'protocolo_ou_senha_invalidos');
  end if;
  if d.status in ('concluida','arquivada') then return jsonb_build_object('ok', false, 'motivo', 'denuncia_encerrada'); end if;
  insert into denuncia_mensagens (empresa_id, denuncia_id, autor, mensagem)
  values (d.empresa_id, d.id, 'denunciante', trim(p_mensagem));
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------
-- VERIFICAÇÃO PÚBLICA DE CERTIFICADO
-- ---------------------------------------------------------------------
create or replace function public.verificar_certificado(p_codigo text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('ok', true, 'titulo', ce.titulo, 'tipo', ce.tipo,
                               'colaborador', _nome_curto(co.nome), 'empresa', e.nome, 'campanha', ca.nome,
                               'carga_minutos', ce.carga_minutos, 'emitido_em', ce.emitido_em)
       from certificados ce
       join empresas e on e.id = ce.empresa_id
       join campanhas ca on ca.id = ce.campanha_id
       left join colaboradores co on co.id = ce.colaborador_id
      where ce.codigo = upper(trim(p_codigo))),
    jsonb_build_object('ok', false, 'motivo', 'certificado_nao_encontrado'))
$$;
