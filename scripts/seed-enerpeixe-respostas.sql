-- =====================================================================
-- T.I.M.E. Seguro — Enerpeixe, parte 2: respostas, atividade, trilha e pontos.
--
-- Roda DEPOIS de seed-enerpeixe.sql e da importação de perguntas-nr1.txt
-- (com as perguntas já ligadas às lições). `scripts/seed-enerpeixe.mjs` põe
-- na ordem.
--
-- Pontuação só por `_lancar_pontos`, com o mesmo `origem_id` das RPCs reais:
-- quiz usa o id da RESPOSTA, presença usa md5(colab || dia), lição usa o id
-- da lição.
--
-- Desenho para o painel ter o que mostrar: a Manutenção Mecânica acerta
-- menos (lacuna visível), e o engajamento cai conforme a matrícula.
-- =====================================================================

do $$
declare
  v_emp      uuid;
  v_camp     uuid;
  v_inicio   date;
  v_dia      date;
  v_col      record;
  v_licao    record;
  v_pergunta record;
  v_resposta uuid;
  v_acertou  boolean;
  v_fraco    boolean;
  v_nota     int;
  i          int;
  j          int;
begin
  select id into v_emp from public.empresas where codigo = 'enerpeixe';
  if v_emp is null then
    raise exception 'Empresa enerpeixe não existe. Rode scripts/seed-enerpeixe.sql primeiro.';
  end if;

  select id, inicio into v_camp, v_inicio
    from public.campanhas where empresa_id = v_emp and status = 'ativa';

  i := 0;
  for v_col in
    select c.id, c.setor_id, s.nome as setor
      from public.colaboradores c join public.setores s on s.id = c.setor_id
     where c.empresa_id = v_emp
     order by c.matricula
  loop
    i := i + 1;
    v_fraco := v_col.setor = 'Manutenção Mecânica';

    -- ----------------------------------------------------------------
    -- Quiz diário do início da campanha até ontem.
    -- ----------------------------------------------------------------
    for j in 0..(current_date - v_inicio - 1) loop
      v_dia := v_inicio + j;
      continue when (i + j) % greatest(1, (i / 8) + 1) <> 0;

      insert into public.atividade_diaria (empresa_id, colaborador_id, campanha_id, dia)
      values (v_emp, v_col.id, v_camp, v_dia)
      on conflict do nothing;

      for v_pergunta in
        select p.id, p.correta, array_length(p.alternativas, 1) as quantas
          from public.perguntas p
         where p.empresa_id = v_emp and p.status = 'ativa'
         order by md5(p.id::text || v_dia::text || v_col.id::text)
         limit 3
      loop
        v_acertou := case when v_fraco then (i + j) % 5 in (0, 2) else (i + j) % 5 <> 0 end;

        v_resposta := null;
        insert into public.respostas (
          empresa_id, campanha_id, colaborador_id, pergunta_id, origem,
          alternativa, acertou, tempo_ms, dia, criado_em)
        values (
          v_emp, v_camp, v_col.id, v_pergunta.id, 'diario',
          case when v_acertou then v_pergunta.correta
               else (v_pergunta.correta + 1) % v_pergunta.quantas end,
          v_acertou, 4000 + (i * 137 + j * 29) % 9000, v_dia,
          v_dia + time '06:40' + ((i * 7 + j * 11) % 240 || ' minutes')::interval)
        on conflict do nothing
        returning id into v_resposta;

        if v_acertou and v_resposta is not null then
          perform public._lancar_pontos(
            v_camp, v_col.id, v_col.setor_id, 'conhecimento', 'quiz_diario', v_resposta, 10);
        end if;
      end loop;

      perform public._lancar_pontos(
        v_camp, v_col.id, v_col.setor_id, 'engajamento', 'presenca_diaria',
        md5(v_col.id::text || v_dia::text)::uuid, 2);
    end loop;

    -- ----------------------------------------------------------------
    -- Trilha: os mais engajados avançam mais lições.
    -- ----------------------------------------------------------------
    for v_licao in
      select l.id, l.ordem, l.nota_minima from public.licoes l
       where l.campanha_id = v_camp and l.publicada
         and l.ordem <= greatest(0, 6 - i / 6)
       order by l.ordem
    loop
      v_nota := case when v_fraco then 50 + ((i + v_licao.ordem) % 3) * 20
                     else 60 + ((i * 3 + v_licao.ordem) % 3) * 20 end;

      insert into public.progresso_licoes (
        empresa_id, licao_id, colaborador_id, conteudo_concluido_em, melhor_nota,
        tentativas, tentativas_hoje, ultima_tentativa_dia, aprovado_em)
      values (
        v_emp, v_licao.id, v_col.id,
        (v_inicio + v_licao.ordem % 4) + time '12:10',
        v_nota, 1, 1, v_inicio + v_licao.ordem % 4,
        case when v_nota >= v_licao.nota_minima then (v_inicio + v_licao.ordem % 4) + time '12:25' end)
      on conflict (licao_id, colaborador_id) do nothing;

      perform public._lancar_pontos(
        v_camp, v_col.id, v_col.setor_id, 'conhecimento', 'licao_conteudo', v_licao.id, 20);
      if v_nota >= v_licao.nota_minima then
        perform public._lancar_pontos(
          v_camp, v_col.id, v_col.setor_id, 'conhecimento', 'licao_aprovada', v_licao.id, 30);
        if v_nota = 100 then
          perform public._lancar_pontos(
            v_camp, v_col.id, v_col.setor_id, 'conhecimento', 'licao_nota_maxima', v_licao.id, 10);
        end if;
      end if;
    end loop;
  end loop;

  raise notice 'respostas: %', (select count(*) from public.respostas where empresa_id = v_emp);
  raise notice 'pontos:    %', (select coalesce(sum(pontos), 0) from public.pontos_lancamentos where empresa_id = v_emp);
end $$;
