-- Gerado de docs/TIME_02_BANCO_DE_DADOS.md (linha 1505) — NAO EDITAR O SQL.
-- O SQL deste arquivo foi testado em PostgreSQL 16. Mudanca de banco vira
-- migration NOVA; nunca editar uma migration ja aplicada.

-- =====================================================================
-- T.I.M.E. Seguro — 0004_time_rpc_tecnico.sql
-- RPCs do PAINEL DO TÉCNICO (role authenticated / Supabase Auth).
-- CRUD simples (setores, locais, perguntas, lições, eventos...) é feito
-- direto nas tabelas via RLS. Aqui ficam as operações que mexem em
-- PIN, pontuação ou regras de negócio.
-- =====================================================================

-- Gera PIN provisório (6 dígitos) para colaboradores. O PIN puro só é
-- devolvido AQUI, uma única vez, para impressão dos cartões de acesso.
create or replace function public.tecnico_gerar_pins(p_colaboradores uuid[])
returns table (colaborador_id uuid, matricula text, nome text, setor text, pin text)
language plpgsql security definer set search_path = public, extensions as $$
declare v_emp uuid := _exigir_tecnico(); r record; v_pin text;
begin
  for r in
    select c.id, c.matricula, c.nome, s.nome as setor_nome
      from colaboradores c left join setores s on s.id = c.setor_id
     where c.empresa_id = v_emp and c.id = any(p_colaboradores) and c.ativo and not c.anonimizado
     order by s.nome, c.nome
  loop
    v_pin := _pin_aleatorio();
    update colaboradores
       set pin_hash = crypt(v_pin, gen_salt('bf', 8)), pin_provisorio = true,
           tentativas_falhas = 0, bloqueado_ate = null
     where id = r.id;
    update sessoes_colaborador set revogada = true where sessoes_colaborador.colaborador_id = r.id;
    colaborador_id := r.id; matricula := r.matricula; nome := r.nome; setor := r.setor_nome; pin := v_pin;
    return next;
  end loop;
end $$;

-- Importação em lote (CSV já convertido em JSON pelo front):
-- [{ "matricula": "123", "nome": "Fulano", "setor": "Manutenção", "turno": "A" }]
-- Cria setores inexistentes. Devolve os ids NOVOS (para gerar PIN em seguida).
create or replace function public.tecnico_importar_colaboradores(p_linhas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp uuid := _exigir_tecnico(); r jsonb; v_setor uuid; v_id uuid; v_novo boolean;
        v_novos uuid[] := '{}'; v_atualizados int := 0; v_erros jsonb := '[]'::jsonb; v_linha int := 0;
begin
  for r in select * from jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) loop
    v_linha := v_linha + 1;
    if coalesce(trim(r ->> 'matricula'), '') = '' or coalesce(trim(r ->> 'nome'), '') = '' then
      v_erros := v_erros || jsonb_build_object('linha', v_linha, 'erro', 'matricula_ou_nome_vazio');
      continue;
    end if;
    v_setor := null;
    if coalesce(trim(r ->> 'setor'), '') <> '' then
      insert into setores (empresa_id, nome) values (v_emp, trim(r ->> 'setor'))
      on conflict (empresa_id, nome) do update set nome = excluded.nome
      returning id into v_setor;
    end if;
    insert into colaboradores (empresa_id, matricula, nome, setor_id, turno)
    values (v_emp, trim(r ->> 'matricula'), trim(r ->> 'nome'), v_setor, nullif(trim(r ->> 'turno'), ''))
    on conflict (empresa_id, matricula) do update
      set nome = excluded.nome,
          setor_id = coalesce(excluded.setor_id, colaboradores.setor_id),
          turno = coalesce(excluded.turno, colaboradores.turno),
          ativo = true
    returning id, (xmax = 0) into v_id, v_novo;
    if v_novo then v_novos := v_novos || v_id; else v_atualizados := v_atualizados + 1; end if;
  end loop;
  return jsonb_build_object('ok', true, 'novos', to_jsonb(v_novos), 'atualizados', v_atualizados, 'erros', v_erros);
end $$;

create or replace function public.tecnico_desbloquear_colaborador(p_colaborador uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp uuid := _exigir_tecnico();
begin
  update colaboradores set tentativas_falhas = 0, bloqueado_ate = null
   where id = p_colaborador and empresa_id = v_emp;
  return jsonb_build_object('ok', true);
end $$;

-- LGPD: direito de exclusão. Mantém os fatos (relatos, pontos) mas remove a identificação.
create or replace function public.tecnico_anonimizar_colaborador(p_colaborador uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp uuid := _exigir_tecnico(array['admin']);
begin
  update colaboradores
     set nome = 'Colaborador anonimizado',
         matricula = 'anon-' || left(id::text, 8),
         pin_hash = null, ativo = false, anonimizado = true, turno = null
   where id = p_colaborador and empresa_id = v_emp;
  delete from sessoes_colaborador where colaborador_id = p_colaborador;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------
-- RELATOS
-- p_decisao: 'validar' | 'rejeitar' | 'duplicado'
-- Só relato VALIDADO pontua. Limite semanal de relatos pontuados.
-- ---------------------------------------------------------------------
create or replace function public.tecnico_validar_relato(
  p_relato uuid, p_decisao text, p_gravidade text default null,
  p_comentario text default null, p_duplicado_de uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid := _exigir_tecnico(); r public.relatos; c public.campanhas; co public.colaboradores;
  v_pts int := 0; v_semana int; v_status text; v_msg text;
begin
  select * into r from relatos where id = p_relato and empresa_id = v_emp for update;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'relato_invalido'); end if;
  if r.validado or r.status in ('rejeitado','duplicado') then
    return jsonb_build_object('ok', false, 'motivo', 'ja_decidido');
  end if;

  if p_decisao = 'validar' then
    if p_gravidade not in ('baixa','media','alta') then
      return jsonb_build_object('ok', false, 'motivo', 'gravidade_obrigatoria');
    end if;
    update relatos set validado = true, gravidade = p_gravidade, validado_por = auth.uid(), validado_em = now(),
                       status = case when status = 'aberto' then 'em_analise' else status end
     where id = r.id;
    v_status := case when r.status = 'aberto' then 'em_analise' else r.status end;
    v_msg := coalesce(p_comentario, 'Relato validado pelo técnico de SST. Obrigado por cuidar de todos!');

    select * into c from campanhas where id = r.campanha_id and status = 'ativa';
    select * into co from colaboradores where id = r.colaborador_id;
    if c.id is not null and co.id is not null then
      select count(*) into v_semana from pontos_lancamentos
       where colaborador_id = co.id and campanha_id = c.id and origem = 'relato_validado'
         and date_trunc('week', criado_em) = date_trunc('week', now());
      if v_semana < _cfg(c, 'max_relatos_pontuados_semana', 5) then
        v_pts := _lancar_pontos(c.id, co.id, co.setor_id, 'relatos', 'relato_validado', r.id,
                   case p_gravidade
                     when 'alta'  then _cfg(c, 'pontos_relato_alta', 50)
                     when 'media' then _cfg(c, 'pontos_relato_media', 40)
                     else              _cfg(c, 'pontos_relato_baixa', 30) end);
      end if;
      perform _avaliar_selos(co.id, c.id);
    end if;

  elsif p_decisao = 'rejeitar' then
    update relatos set status = 'rejeitado' where id = r.id;
    v_status := 'rejeitado';
    v_msg := coalesce(p_comentario, 'Relato não validado.');

  elsif p_decisao = 'duplicado' then
    update relatos set status = 'duplicado', duplicado_de = coalesce(p_duplicado_de, r.possivel_duplicado_de) where id = r.id;
    v_status := 'duplicado';
    v_msg := coalesce(p_comentario, 'Este problema já tinha sido relatado por outro colega e está sendo tratado.');
  else
    return jsonb_build_object('ok', false, 'motivo', 'decisao_invalida');
  end if;

  insert into relato_historico (empresa_id, relato_id, status, comentario, autor_user_id)
  values (v_emp, r.id, v_status, v_msg, auth.uid());
  return jsonb_build_object('ok', true, 'status', v_status, 'pontos', v_pts);
end $$;

-- Andamento: em_analise -> em_correcao -> resolvido. Resolvido dá bônus ao relator.
create or replace function public.tecnico_atualizar_relato(
  p_relato uuid, p_status text, p_comentario text default null, p_visivel boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp uuid := _exigir_tecnico(); r public.relatos; c public.campanhas; co public.colaboradores; v_pts int := 0;
begin
  if p_status not in ('em_analise','em_correcao','resolvido') then
    return jsonb_build_object('ok', false, 'motivo', 'status_invalido');
  end if;
  select * into r from relatos where id = p_relato and empresa_id = v_emp for update;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'relato_invalido'); end if;
  if not r.validado then return jsonb_build_object('ok', false, 'motivo', 'valide_primeiro'); end if;

  update relatos set status = p_status where id = r.id;
  insert into relato_historico (empresa_id, relato_id, status, comentario, autor_user_id, visivel_colaborador)
  values (v_emp, r.id, p_status, p_comentario, auth.uid(), coalesce(p_visivel, true));

  if p_status = 'resolvido' then
    select * into c from campanhas where id = r.campanha_id and status = 'ativa';
    select * into co from colaboradores where id = r.colaborador_id;
    if c.id is not null and co.id is not null then
      v_pts := _lancar_pontos(c.id, co.id, co.setor_id, 'relatos', 'relato_resolvido', r.id, _cfg(c, 'pontos_relato_resolvido', 10));
    end if;
  end if;
  return jsonb_build_object('ok', true, 'pontos', v_pts);
end $$;

-- ---------------------------------------------------------------------
-- EVENTOS: código de check-in rotativo (a tela da TV chama a cada 60 s)
-- ---------------------------------------------------------------------
create or replace function public.tecnico_rotacionar_codigo(p_evento uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_emp uuid := _exigir_tecnico(); v_novo text;
begin
  -- 5 caracteres sem ambiguidades (sem 0/O, 1/I)
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 32), 1), '')
    into v_novo
    from (select gen_random_bytes(5) as b) x, generate_series(0, 4) as i;
  update eventos
     set codigo_anterior = codigo_checkin, codigo_checkin = v_novo, codigo_atualizado_em = now()
   where id = p_evento and empresa_id = v_emp;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'evento_invalido'); end if;
  return jsonb_build_object('ok', true, 'codigo', v_novo);
end $$;

-- ---------------------------------------------------------------------
-- MODO TV: salva a sessão (1 sessão pontuada por evento).
-- p_equipes:   [{ "setor_id": uuid, "pontos": int }]
-- p_respostas: [{ "setor_id": uuid, "pergunta_id": uuid, "alternativa": int, "tempo_ms": int, "ordem": int }]
-- Modo 'classico': o servidor RECALCULA os pontos (acertos x 10).
-- Modos 'duelo'/'eliminacao': aceita os pontos do motor de jogo, com teto.
-- ---------------------------------------------------------------------
create or replace function public.tecnico_salvar_quiz_tv(
  p_evento uuid, p_modo text, p_duracao_ms int, p_equipes jsonb, p_respostas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid := _exigir_tecnico(); e public.eventos; c public.campanhas; v_sessao uuid;
  r jsonb; v_setor uuid; v_acertos int; v_erros int; v_pts int; v_teto int; v_res jsonb := '[]'::jsonb;
begin
  if p_modo not in ('classico','duelo','eliminacao') then return jsonb_build_object('ok', false, 'motivo', 'modo_invalido'); end if;
  select * into e from eventos where id = p_evento and empresa_id = v_emp;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'evento_invalido'); end if;
  if exists (select 1 from quiz_tv_sessoes where evento_id = e.id) then
    return jsonb_build_object('ok', false, 'motivo', 'evento_ja_tem_sessao');
  end if;

  insert into quiz_tv_sessoes (empresa_id, campanha_id, evento_id, modo, duracao_ms, criado_por)
  values (v_emp, e.campanha_id, e.id, p_modo, greatest(coalesce(p_duracao_ms, 0), 0), auth.uid())
  returning id into v_sessao;

  -- grava respostas, corrigindo pelo gabarito do banco
  insert into quiz_tv_respostas (empresa_id, sessao_id, setor_id, pergunta_id, alternativa, acertou, tempo_ms, ordem)
  select v_emp, v_sessao, (x ->> 'setor_id')::uuid, p.id, (x ->> 'alternativa')::int,
         (x ->> 'alternativa')::int = p.correta, coalesce((x ->> 'tempo_ms')::int, 0), coalesce((x ->> 'ordem')::int, 0)
    from jsonb_array_elements(coalesce(p_respostas, '[]'::jsonb)) x
    join perguntas p on p.id = (x ->> 'pergunta_id')::uuid
                    and (p.empresa_id = v_emp or p.empresa_id is null);

  select * into c from campanhas where id = e.campanha_id and status = 'ativa';

  for r in select * from jsonb_array_elements(coalesce(p_equipes, '[]'::jsonb)) loop
    v_setor := (r ->> 'setor_id')::uuid;
    if not exists (select 1 from setores where id = v_setor and empresa_id = v_emp) then continue; end if;
    select count(*) filter (where acertou), count(*) filter (where not acertou)
      into v_acertos, v_erros from quiz_tv_respostas where sessao_id = v_sessao and setor_id = v_setor;
    v_teto := (select count(*) from quiz_tv_respostas where sessao_id = v_sessao) * 10 + 100;
    v_pts := case when p_modo = 'classico' then v_acertos * 10
                  else least(greatest(coalesce((r ->> 'pontos')::int, 0), 0), v_teto) end;

    insert into quiz_tv_equipes (sessao_id, empresa_id, setor_id, pontos, acertos, erros)
    values (v_sessao, v_emp, v_setor, v_pts, v_acertos, v_erros);

    if c.id is not null then
      perform _lancar_pontos(c.id, null, v_setor, 'quiz_tv', 'quiz_tv', v_sessao, v_pts);
    end if;
    v_res := v_res || jsonb_build_object('setor_id', v_setor, 'pontos', v_pts, 'acertos', v_acertos, 'erros', v_erros);
  end loop;

  update eventos set status = 'realizado' where id = e.id;
  return jsonb_build_object('ok', true, 'sessao_id', v_sessao, 'equipes', v_res);
end $$;

-- ---------------------------------------------------------------------
-- CAMPANHAS
-- ---------------------------------------------------------------------
create or replace function public.tecnico_ativar_campanha(p_campanha uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp uuid := _exigir_tecnico();
begin
  if exists (select 1 from campanhas where empresa_id = v_emp and status = 'ativa' and id <> p_campanha) then
    return jsonb_build_object('ok', false, 'motivo', 'ja_existe_campanha_ativa');
  end if;
  if not exists (select 1 from campanha_temas where campanha_id = p_campanha) then
    return jsonb_build_object('ok', false, 'motivo', 'campanha_sem_temas');
  end if;
  update campanhas set status = 'ativa' where id = p_campanha and empresa_id = v_emp and status = 'rascunho';
  if not found then return jsonb_build_object('ok', false, 'motivo', 'campanha_invalida'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- Encerra o trimestre: congela o ranking, concede selos finais e emite certificados.
-- p_top_n: quantos destaques gerais recebem certificado (o 1º de cada setor sempre recebe).
create or replace function public.tecnico_encerrar_campanha(p_campanha uuid, p_top_n int default 3)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_emp uuid := _exigir_tecnico(); c public.campanhas; r record; v_carga int;
  v_dest int := 0; v_trilha int := 0;
begin
  select * into c from campanhas where id = p_campanha and empresa_id = v_emp and status = 'ativa' for update;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'campanha_invalida'); end if;

  update campanhas set status = 'encerrada', encerrada_em = now() where id = c.id;

  -- 1) foto do ranking individual (desempate: mais relatos, depois conhecimento, depois quem chegou primeiro)
  insert into campanha_resultados (empresa_id, campanha_id, tipo, colaborador_id, setor_id, posicao, pontos, detalhes)
  select v_emp, c.id, 'individual', colaborador_id, setor_id,
         row_number() over (order by total desc, relatos desc, conhecimento desc, ultimo_ponto_em asc),
         total, jsonb_build_object('conhecimento', conhecimento, 'relatos', relatos, 'engajamento', engajamento)
    from v_ranking_individual where campanha_id = c.id;

  -- 2) foto do ranking de setores
  insert into campanha_resultados (empresa_id, campanha_id, tipo, setor_id, posicao, pontos, detalhes)
  select v_emp, c.id, 'setor', setor_id, row_number() over (order by total desc), total,
         jsonb_build_object('media_individual', total - pontos_quiz_tv, 'quiz_tv', pontos_quiz_tv, 'colaboradores', colaboradores_ativos)
    from v_ranking_setor where campanha_id = c.id;

  -- 3) selos finais
  insert into selos_conquistados (empresa_id, selo_id, colaborador_id, campanha_id)
  select v_emp, s.id, cr.colaborador_id, c.id from campanha_resultados cr, selos s
   where cr.campanha_id = c.id and cr.tipo = 'individual' and cr.posicao <= 3 and s.slug = 'podio'
  on conflict do nothing;

  insert into selos_conquistados (empresa_id, selo_id, colaborador_id, campanha_id)
  select v_emp, s.id, x.colaborador_id, c.id
    from (select distinct on (setor_id) colaborador_id from campanha_resultados
           where campanha_id = c.id and tipo = 'individual' and setor_id is not null and pontos > 0
           order by setor_id, posicao) x, selos s
   where s.slug = 'guardiao-do-setor'
  on conflict do nothing;

  -- 4) certificados de DESTAQUE (top N geral + 1º de cada setor)
  for r in
    select cr.colaborador_id, min(cr.posicao) as posicao, bool_or(cr.posicao <= p_top_n) as top_geral,
           (array_agg(s.nome))[1] as setor_nome
      from campanha_resultados cr left join setores s on s.id = cr.setor_id
     where cr.campanha_id = c.id and cr.tipo = 'individual' and cr.pontos > 0
       and (cr.posicao <= p_top_n or cr.colaborador_id in (
             select distinct on (setor_id) colaborador_id from campanha_resultados
              where campanha_id = c.id and tipo = 'individual' and setor_id is not null and pontos > 0
              order by setor_id, posicao))
     group by cr.colaborador_id
  loop
    insert into certificados (empresa_id, campanha_id, colaborador_id, tipo, titulo, codigo, dados)
    values (v_emp, c.id, r.colaborador_id, 'destaque',
            case when r.top_geral then r.posicao || 'º lugar geral — ' || c.nome
                 else 'Destaque do setor ' || coalesce(r.setor_nome, '') || ' — ' || c.nome end,
            'TIME-' || upper(encode(gen_random_bytes(5), 'hex')),
            jsonb_build_object('posicao', r.posicao, 'top_geral', r.top_geral, 'setor', r.setor_nome))
    on conflict do nothing;
    v_dest := v_dest + 1;
  end loop;

  -- 5) certificados de CONCLUSÃO DE TRILHA (aprovado em todas as obrigatórias)
  select coalesce(sum(carga_minutos), 0) into v_carga from licoes where campanha_id = c.id and publicada and obrigatoria;
  if v_carga > 0 then
    for r in
      select pl.colaborador_id
        from progresso_licoes pl join licoes l on l.id = pl.licao_id
       where l.campanha_id = c.id and l.publicada and l.obrigatoria and pl.aprovado_em is not null
       group by pl.colaborador_id
      having count(*) = (select count(*) from licoes where campanha_id = c.id and publicada and obrigatoria)
    loop
      insert into certificados (empresa_id, campanha_id, colaborador_id, tipo, titulo, carga_minutos, codigo)
      values (v_emp, c.id, r.colaborador_id, 'conclusao_trilha', 'Trilha de capacitação — ' || c.nome, v_carga,
              'TIME-' || upper(encode(gen_random_bytes(5), 'hex')))
      on conflict do nothing;
      v_trilha := v_trilha + 1;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'certificados_destaque', v_dest, 'certificados_trilha', v_trilha);
end $$;

-- ---------------------------------------------------------------------
-- COMITÊ DO CANAL DE RESPEITO (apenas perfis com comite_assedio = true)
-- ---------------------------------------------------------------------
create or replace function public.comite_responder_denuncia(p_denuncia uuid, p_mensagem text, p_status text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp uuid := minha_empresa();
begin
  if not sou_comite_assedio() then raise exception 'acesso_negado' using errcode = 'P0001'; end if;
  if not exists (select 1 from denuncias_assedio where id = p_denuncia and empresa_id = v_emp) then
    return jsonb_build_object('ok', false, 'motivo', 'denuncia_invalida');
  end if;
  if coalesce(trim(p_mensagem), '') <> '' then
    insert into denuncia_mensagens (empresa_id, denuncia_id, autor, mensagem) values (v_emp, p_denuncia, 'comite', trim(p_mensagem));
  end if;
  if p_status is not null then
    if p_status not in ('recebida','em_apuracao','concluida','arquivada') then
      return jsonb_build_object('ok', false, 'motivo', 'status_invalido');
    end if;
    update denuncias_assedio set status = p_status where id = p_denuncia;
  end if;
  return jsonb_build_object('ok', true);
end $$;
