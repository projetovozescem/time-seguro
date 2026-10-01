-- =====================================================================
-- T.I.M.E. Seguro — parte 2 da demonstração: respostas, atividade e pontos.
--
-- Roda DEPOIS de `seed-demo.sql` e depois de as perguntas do docs/TIME_12
-- entrarem na empresa `demo` — é `scripts/seed-demo.mjs` que põe na ordem.
-- Separado em dois arquivos porque esta parte precisa das perguntas da própria
-- empresa de demonstração, e a parte 1 é que cria a empresa.
--
-- Pontuação só por `_lancar_pontos`, com o mesmo `origem_id` das RPCs reais:
-- o índice `pl_unico_colab` é (origem, origem_id, colaborador_id) e não tem
-- `dia`, então quiz usa o id da RESPOSTA e presença usa md5(colab || dia).
-- =====================================================================

do $$
declare
  v_emp      uuid;
  v_camp     uuid;
  v_licao    uuid;
  v_colabs   uuid[];
  v_setores  uuid[];
  v_pergunta record;
  v_resposta uuid;
  v_inicio   date;
  v_dia      date;
  v_acertou  boolean;
  i          int;
  j          int;
begin
  select id into v_emp from public.empresas where codigo = 'demo';
  if v_emp is null then
    raise exception 'Empresa demo não existe. Rode scripts/seed-demo.sql primeiro.';
  end if;

  select id, inicio into v_camp, v_inicio
    from public.campanhas where empresa_id = v_emp and status = 'ativa';

  if not exists (select 1 from public.perguntas where empresa_id = v_emp and status = 'ativa') then
    raise exception 'A empresa demo não tem perguntas. Rode node scripts/seed-demo.mjs.';
  end if;

  -- Mesma ordem da parte 1: o setor de cada colaborador é `1 + (i % 4)`.
  select array_agg(id order by nome) into v_setores
    from public.setores where empresa_id = v_emp;
  select array_agg(id order by matricula) into v_colabs
    from public.colaboradores where empresa_id = v_emp;

  -- ------------------------------------------------------------------
  -- 1) Perguntas da lição publicada.
  -- ------------------------------------------------------------------
  select id into v_licao from public.licoes where empresa_id = v_emp order by ordem limit 1;
  if v_licao is not null then
    insert into public.licao_perguntas (licao_id, pergunta_id, empresa_id, ordem)
    select v_licao, p.id, v_emp, row_number() over (order by p.criado_em)
      from public.perguntas p
      join public.temas t on t.id = p.tema_id
     where p.empresa_id = v_emp and t.slug = 'nr12' and p.status = 'ativa'
     limit 5
    on conflict do nothing;
  end if;

  -- ------------------------------------------------------------------
  -- 2) Respostas e atividade nas três semanas.
  --
  --    O desenho é de propósito: a Produção (setor 1) acerta pouco em NR-12 e
  --    vira uma LACUNA visível no mapa; os outros setores vão bem. Sem isso o
  --    print do mapa de lacunas não diria nada.
  --
  --    O engajamento cai conforme o índice do colaborador: os primeiros
  --    respondem quase todo dia, os últimos quase nunca — é o que produz a
  --    distribuição de sequências da aba Engajamento.
  -- ------------------------------------------------------------------
  for i in 1..array_length(v_colabs, 1) loop
    for j in 0..20 loop
      v_dia := v_inicio + j;
      continue when (i + j) % greatest(1, (i / 6) + 1) <> 0;

      insert into public.atividade_diaria (empresa_id, colaborador_id, campanha_id, dia)
      values (v_emp, v_colabs[i], v_camp, v_dia)
      on conflict do nothing;

      for v_pergunta in
        select p.id, p.correta, t.slug, array_length(p.alternativas, 1) as quantas
          from public.perguntas p
          join public.temas t on t.id = p.tema_id
         where p.empresa_id = v_emp and p.status = 'ativa'
         order by md5(p.id::text || v_dia::text || v_colabs[i]::text)
         limit 3
      loop
        v_acertou := case
          when v_pergunta.slug = 'nr12' and v_setores[1 + (i % 4)] = v_setores[1]
            then (i + j) % 3 = 0
          else (i + j) % 5 <> 0
        end;

        v_resposta := null;
        insert into public.respostas (
          empresa_id, campanha_id, colaborador_id, pergunta_id, origem,
          alternativa, acertou, tempo_ms, dia, criado_em)
        values (
          v_emp, v_camp, v_colabs[i], v_pergunta.id, 'diario',
          case when v_acertou then v_pergunta.correta
               else (v_pergunta.correta + 1) % v_pergunta.quantas end,
          v_acertou, 4000 + (i * 137 + j * 29) % 9000, v_dia,
          -- Hora concentrada no início do turno: dá um pico plausível no
          -- gráfico de horários de uso.
          v_dia + time '06:40' + ((i * 7 + j * 11) % 240 || ' minutes')::interval)
        on conflict do nothing
        returning id into v_resposta;

        if v_acertou and v_resposta is not null then
          perform public._lancar_pontos(
            v_camp, v_colabs[i], v_setores[1 + (i % 4)], 'conhecimento',
            'quiz_diario', v_resposta, 10);
        end if;
      end loop;

      perform public._lancar_pontos(
        v_camp, v_colabs[i], v_setores[1 + (i % 4)], 'engajamento',
        'presenca_diaria', md5(v_colabs[i]::text || v_dia::text)::uuid, 2);
    end loop;
  end loop;

  raise notice 'respostas: %', (select count(*) from public.respostas where empresa_id = v_emp);
  raise notice 'pontos:    %', (select coalesce(sum(pontos), 0) from public.pontos_lancamentos where empresa_id = v_emp);
end $$;
