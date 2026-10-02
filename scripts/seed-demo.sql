-- =====================================================================
-- T.I.M.E. Seguro — dados de DEMONSTRAÇÃO (docs/TIME_11 Fase 11 item 2)
--
-- Cria a empresa "Empresa Demonstração" (código `demo`) com 4 setores,
-- 30 colaboradores fictícios, 1 campanha, respostas, relatos, eventos e
-- check-ins distribuídos em 3 semanas, para prints e apresentação.
--
-- ⚠️ HONESTIDADE NA INSCRIÇÃO (docs/TIME_11 §3): isto é DEMONSTRAÇÃO DO
--    SISTEMA, nunca uso real. Todo nome é claramente fictício ("Colaborador
--    Demo 01"…) e a empresa se chama "Empresa Demonstração" justamente para
--    que nenhum print possa ser confundido com resultado de campo.
--
-- Como rodar (projeto de DESENVOLVIMENTO):
--   node scripts/seed-demo.mjs
--
-- O orquestrador roda este arquivo, carrega as 36 perguntas do docs/TIME_12
-- na empresa demo e depois roda `seed-demo-respostas.sql`.
--
-- Idempotente: rodar de novo apaga a empresa `demo` e recria do zero. Não
-- toca em nenhuma outra empresa.
--
-- Regras respeitadas:
--  • pontuação SÓ por `_lancar_pontos` (CLAUDE.md regra 1) — nenhum insert
--    direto em `pontos_lancamentos`;
--  • o PIN de cada colaborador e dado pela trigger da 0008 (fixo e unico) —
--    este seed nao escolhe PIN; para ve-los: node scripts/seed-demo.mjs lista os 5 primeiros;
--  • Canal de Respeito recebe denúncias de demonstração SEM hora e SEM
--    ligação com pessoa (CLAUDE.md regra 3).
-- =====================================================================

do $$
declare
  v_emp        uuid;
  v_camp       uuid;
  v_setor      uuid;
  v_colab      uuid;
  v_local      uuid;
  v_evento     uuid;
  v_licao      uuid;
  v_relato     uuid;
  v_hoje       date := current_date;
  -- A campanha cobre 3 semanas que terminam hoje: o print mostra histórico.
  v_inicio     date := current_date - 20;
  v_setores    uuid[] := '{}';
  v_colabs     uuid[] := '{}';
  v_locais     uuid[] := '{}';
  v_nomes      text[] := array['Produção','Manutenção','Expedição','Qualidade'];
  v_cores      text[] := array['#0B3C5D','#F5A300','#2E86C1','#16A085'];
  v_turnos     text[] := array['manha','tarde','noite','adm'];
  i            int;
  j            int;
begin
  -- ------------------------------------------------------------------
  -- 0) Limpa a demonstração anterior. `on delete cascade` em todas as
  --    tabelas filhas faz o resto.
  -- ------------------------------------------------------------------
  delete from public.empresas where codigo = 'demo';

  insert into public.empresas (nome, codigo, termo_lgpd_texto, termo_lgpd_versao)
  values (
    'Empresa Demonstração',
    'demo',
    'Este é um texto de demonstração. A empresa guarda sua matrícula, seu nome, '
    || 'suas respostas e seus relatos para organizar o treinamento de segurança. '
    || 'Seus dados não são vendidos nem usados para punir ninguém. Para pedir '
    || 'cópia ou exclusão, fale com o técnico de segurança.',
    1)
  returning id into v_emp;

  -- ------------------------------------------------------------------
  -- 1) Quatro setores e dois locais em cada um.
  -- ------------------------------------------------------------------
  for i in 1..4 loop
    insert into public.setores (empresa_id, nome, cor)
    values (v_emp, v_nomes[i], v_cores[i])
    returning id into v_setor;
    v_setores := v_setores || v_setor;

    insert into public.locais (empresa_id, setor_id, nome, descricao)
    values (v_emp, v_setor, v_nomes[i] || ' · Posto ' || i, 'Local de demonstração')
    returning id into v_local;
    v_locais := v_locais || v_local;

    insert into public.locais (empresa_id, setor_id, nome, descricao)
    values (v_emp, v_setor, v_nomes[i] || ' · Painel elétrico', 'Local de demonstração')
    returning id into v_local;
    v_locais := v_locais || v_local;
  end loop;

  -- ------------------------------------------------------------------
  -- 2) Trinta colaboradores fictícios. O PIN fixo e único nasce na trigger
  --    `colaboradores_define_pin` (0008); aqui não se grava PIN nenhum.
  -- ------------------------------------------------------------------
  for i in 1..30 loop
    insert into public.colaboradores (
      empresa_id, setor_id, matricula, nome, turno,
      lgpd_aceite_versao, lgpd_aceite_em)
    values (
      v_emp,
      v_setores[1 + (i % 4)],
      'D' || lpad(i::text, 3, '0'),
      'Colaborador Demo ' || lpad(i::text, 2, '0'),
      v_turnos[1 + (i % 4)],
      1,
      now() - (i || ' days')::interval)
    returning id into v_colab;
    v_colabs := v_colabs || v_colab;
  end loop;

  -- ------------------------------------------------------------------
  -- 3) Uma campanha ativa de três semanas, com todos os temas globais.
  -- ------------------------------------------------------------------
  insert into public.campanhas (
    empresa_id, nome, descricao, inicio, fim, status, premiacao,
    ranking_visivel, perguntas_por_dia)
  values (
    v_emp,
    'SIPAT de Demonstração',
    'Campanha de demonstração do sistema. Os dados são fictícios.',
    v_inicio, v_hoje + 10, 'ativa',
    'Café da manhã com a diretoria para o setor campeão',
    true, 5)
  returning id into v_camp;

  insert into public.campanha_temas (campanha_id, tema_id, empresa_id)
  select v_camp, t.id, v_emp from public.temas t where t.empresa_id is null;

  -- ------------------------------------------------------------------
  -- 4) Uma lição publicada, com as perguntas de um tema.
  -- ------------------------------------------------------------------
  insert into public.licoes (
    empresa_id, campanha_id, tema_id, titulo, conteudo_md, carga_minutos,
    ordem, nota_minima, publicada)
  select
    v_emp, v_camp, t.id,
    'Máquinas paradas antes de limpar',
    E'## Antes de limpar ou destravar\n\n'
    || E'1. **Pare** a máquina.\n'
    || E'2. **Bloqueie** a energia e coloque a etiqueta com seu nome.\n'
    || E'3. **Confirme** que não tem tensão.\n\n'
    || E'Máquina em movimento não se limpa. Não existe serviço rápido o '
    || E'bastante para valer um dedo.\n',
    15, 1, 70, true
  from public.temas t where t.empresa_id is null and t.slug = 'nr12'
  returning id into v_licao;

  -- As perguntas da licao e as respostas da campanha ficam em
  -- `seed-demo-respostas.sql`: dependem das perguntas do docs/TIME_12 ja
  -- carregadas na empresa demo, e e `scripts/seed-demo.mjs` que poe na ordem.

  -- ------------------------------------------------------------------
  -- 5) Relatos: um pouco de cada categoria e situação, concentrados em
  --    dois locais (o mapa de calor precisa de um ponto quente).
  -- ------------------------------------------------------------------
  for i in 1..14 loop
    insert into public.relatos (
      empresa_id, campanha_id, colaborador_id, setor_id, local_id, categoria,
      descricao, status, gravidade, validado, validado_em, criado_em)
    values (
      v_emp, v_camp, v_colabs[i], v_setores[1 + (i % 4)],
      -- Dois terços no mesmo local: é o ponto quente da demonstração.
      v_locais[case when i % 3 = 0 then 2 else 1 end],
      (array['condicao_insegura','ato_inseguro','quase_acidente','melhoria'])[1 + (i % 4)],
      (array[
        'A proteção da máquina está solta e encosta na correia quando liga.',
        'Colega subiu na escada sem o cinto de segurança para trocar a lâmpada.',
        'Quase escorreguei no óleo que vaza perto da prensa.',
        'Sugiro pintar a faixa do corredor de novo: apagou e ninguém vê o limite.'
      ])[1 + (i % 4)],
      (array['aberto','em_analise','em_correcao','resolvido','resolvido'])[1 + (i % 5)],
      case when i % 5 = 0 then 'alta' when i % 2 = 0 then 'media' else 'baixa' end,
      i % 5 <> 1,
      case when i % 5 <> 1 then v_hoje - 18 + i + 1 else null end,
      v_hoje - 18 + i)
    returning id into v_relato;

    -- Histórico: quando está resolvido, registra a data da resolução para o
    -- analytics calcular "validado → resolvido".
    insert into public.relato_historico (
      empresa_id, relato_id, status, comentario, visivel_colaborador, criado_em)
    select v_emp, v_relato, 'resolvido',
           'Correção executada pela manutenção. (demonstração)', true,
           v_hoje - 18 + i + 4
     where (array['aberto','em_analise','em_correcao','resolvido','resolvido'])[1 + (i % 5)] = 'resolvido';

    -- Relato validado pontua (docs/TIME_08): só pela função.
    if i % 5 <> 1 then
      perform public._lancar_pontos(
        v_camp, v_colabs[i], v_setores[1 + (i % 4)], 'relatos', 'relato_validado',
        v_relato, 20);
    end if;
  end loop;

  -- ------------------------------------------------------------------
  -- 6) Eventos (DDS e SIPAT) com check-in, nas três semanas.
  -- ------------------------------------------------------------------
  for i in 1..5 loop
    insert into public.eventos (
      empresa_id, campanha_id, tipo, titulo, descricao, setor_id, inicio, fim,
      pontos, status)
    values (
      v_emp, v_camp,
      case when i = 3 then 'sipat' else 'dds' end,
      (array[
        'DDS: travar a máquina antes de limpar',
        'DDS: uso correto do protetor auricular',
        'SIPAT 2026 — abertura no refeitório',
        'DDS: organização do corredor de passagem',
        'DDS: o que fazer num quase-acidente'
      ])[i],
      'Evento de demonstração.',
      case when i = 3 then null else v_setores[1 + (i % 4)] end,
      (v_hoje - 18 + i * 4) + time '07:00',
      (v_hoje - 18 + i * 4) + time '07:20',
      case when i = 3 then 10 else 5 end,
      case when (v_hoje - 18 + i * 4) < v_hoje then 'realizado' else 'agendado' end)
    returning id into v_evento;

    -- Presença: quem participa mais do quiz também aparece mais no DDS.
    for j in 1..(10 + i * 3) loop
      exit when j > array_length(v_colabs, 1);
      insert into public.checkins (empresa_id, evento_id, colaborador_id, criado_em)
      values (v_emp, v_evento, v_colabs[j], (v_hoje - 18 + i * 4) + time '07:05')
      on conflict do nothing;

      perform public._lancar_pontos(
        v_camp, v_colabs[j], v_setores[1 + (j % 4)], 'engajamento',
        'checkin', v_evento, case when i = 3 then 10 else 5 end);
    end loop;
  end loop;

  -- ------------------------------------------------------------------
  -- 7) Canal de Respeito: duas denúncias de demonstração.
  --
  --    SEM colaborador, SEM hora e SEM pontuação — só a DATA, como o
  --    schema permite (CLAUDE.md regra 3). A senha de acompanhamento das
  --    duas é `demo123`, em bcrypt.
  -- ------------------------------------------------------------------
  insert into public.denuncias_assedio (
    empresa_id, protocolo, senha_hash, categoria, descricao,
    local_aproximado, periodo_aproximado, quer_retorno, status, recebida_em)
  values
    (v_emp, 'RESP-DEMO-0001', extensions.crypt('demo123', extensions.gen_salt('bf', 8)),
     'moral',
     'Relato de demonstração: um encarregado faz piadas constantes sobre o jeito '
     || 'de falar de uma pessoa da equipe, na frente dos outros.',
     'Área de produção', 'Nas últimas semanas', true, 'em_apuracao', v_hoje - 12),
    (v_emp, 'RESP-DEMO-0002', extensions.crypt('demo123', extensions.gen_salt('bf', 8)),
     'discriminacao',
     'Relato de demonstração: uma pessoa foi deixada de fora de um treinamento '
     || 'por causa da idade.',
     'Sala de treinamento', 'No mês passado', false, 'recebida', v_hoje - 4);

  -- ------------------------------------------------------------------
  -- 8) Conferência: números que o técnico pode checar na tela.
  -- ------------------------------------------------------------------
  raise notice 'Empresa Demonstração criada (codigo demo, id %)', v_emp;
  raise notice '  setores:       %', (select count(*) from public.setores where empresa_id = v_emp);
  raise notice '  locais:        %', (select count(*) from public.locais where empresa_id = v_emp);
  raise notice '  colaboradores: %', (select count(*) from public.colaboradores where empresa_id = v_emp);
  raise notice '  relatos:       %', (select count(*) from public.relatos where empresa_id = v_emp);
  raise notice '  eventos:       %', (select count(*) from public.eventos where empresa_id = v_emp);
  raise notice '  check-ins:     %', (select count(*) from public.checkins where empresa_id = v_emp);
  raise notice '  pontos:        %', (select coalesce(sum(pontos), 0) from public.pontos_lancamentos where empresa_id = v_emp);
  raise notice 'Cada colaborador tem PIN fixo proprio (veja node scripts/seed-demo.mjs). Senha das denuncias: demo123.';
end $$;
