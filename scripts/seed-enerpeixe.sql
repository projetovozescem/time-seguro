-- =====================================================================
-- T.I.M.E. Seguro — dados da Enerpeixe S.A. (Usina Hidrelétrica)
-- Campanha "Foco Total na NR-1" (conteúdo de nr1-markdown.md).
--
-- Como rodar:  node scripts/seed-enerpeixe.mjs
-- O orquestrador roda este arquivo, importa scripts/perguntas-nr1.txt e
-- depois roda seed-enerpeixe-respostas.sql.
--
-- O que faz:
--  0) apaga a empresa `demo` inteira e TODOS os dados de negócio da empresa
--     piloto/enerpeixe, mantendo a linha de `empresas` e `perfis_tecnicos`
--     (o login do admin continua valendo);
--  1) renomeia a empresa para Enerpeixe (código `enerpeixe`);
--  2) setores e locais da usina; 3) colaboradores fictícios;
--  4) campanha encerrada "Violência contra a mulher" (vazia);
--  5) campanha ativa "Foco Total na NR-1" com tema `nr1` e 6 lições;
--  6) material informativo NR-1 (destino do QR do cartaz);
--  7) eventos DDS/SIPAT com check-in; 8) relatos.
--
-- Regras: pontos SÓ por `_lancar_pontos` (CLAUDE.md regra 1); PIN pela
-- trigger da 0008; nenhum nome de escola (regra 9).
-- Idempotente: rodar de novo limpa e recria.
-- =====================================================================

do $$
declare
  v_emp       uuid;
  v_tema      uuid;
  v_assedio   uuid;
  v_camp      uuid;
  v_camp_ant  uuid;
  v_setor     uuid;
  v_local     uuid;
  v_colab     uuid;
  v_evento    uuid;
  v_relato    uuid;
  -- Começa na segunda depois da campanha anterior (21 a 25/09/2026).
  v_inicio    date := date '2026-09-28';
  v_setores   uuid[] := '{}';
  v_locais    uuid[] := '{}';
  v_colabs    uuid[] := '{}';
  v_col_setor uuid[] := '{}';
  v_tabelas   text[];
  v_resto     text[];
  t           text;
  i           int;
  j           int;
  v_nomes_set text[] := array['Operação da Usina','Manutenção Elétrica','Manutenção Mecânica',
                              'Barragem e Reservatório','Meio Ambiente','Administrativo'];
  v_cores     text[] := array['#0B3C5D','#F5A300','#C62828','#2E86C1','#2E7D32','#6D4C41'];
  v_locais_n  text[] := array['Casa de Força','Sala de Comando',
                              'Subestação 500 kV','Painéis e Cubículos',
                              'Turbinas e Geradores','Oficina Mecânica',
                              'Crista da Barragem','Vertedouro',
                              'Viveiro de Mudas','Margem do Reservatório',
                              'Escritório Central','Almoxarifado'];
  v_pessoas   text[] := array[
    'Antônio Carlos Ribeiro','Bruna Ferreira Lima','Cícero Alves da Silva','Daniela Souza Rocha',
    'Edson Pereira Gomes','Fabiana Martins Costa','Gilberto Nunes Araújo','Helena Barbosa Dias',
    'Isaías Rodrigues Melo','Juliana Teixeira Pinto','Kleber Moreira Santos','Luciana Cardoso Reis',
    'Marcos Vinícius Azevedo','Natália Campos Freitas','Osvaldo Lopes Batista','Patrícia Mendes Cruz',
    'Quintino Ramos Viana','Raimunda Oliveira Prado','Sebastião Correia Neto','Tatiane Fonseca Moura',
    'Ubirajara Castro Leal','Vanessa Duarte Siqueira','Wellington Farias Brito','Ximena Andrade Peixoto',
    'Yuri Cavalcante Borges','Zilda Monteiro Guerra','Adriano Queiroz Lins','Beatriz Vasconcelos Sá',
    'Claudionor Brandão Rêgo','Denise Pacheco Tavares','Evandro Sampaio Coelho','Francisca Aguiar Matos',
    'Geraldo Magalhães Paiva','Ivone Carvalho Bezerra','José Ribamar Fontes','Lorena Bastos Assunção'];
  v_turnos    text[] := array['manha','tarde','noite','adm'];
begin
  -- ------------------------------------------------------------------
  -- 0) Limpeza.
  -- ------------------------------------------------------------------
  delete from public.empresas where codigo = 'demo';

  select id into v_emp from public.empresas where codigo in ('piloto','enerpeixe') limit 1;
  if v_emp is null then
    raise exception 'Empresa piloto/enerpeixe não existe. Rode npm run db:bootstrap primeiro.';
  end if;

  -- Todas as tabelas com empresa_id, menos a empresa e os perfis do painel.
  select array_agg(c.table_name::text) into v_tabelas
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
   where c.table_schema = 'public' and c.column_name = 'empresa_id'
     and tb.table_type = 'BASE TABLE'
     and c.table_name not in ('empresas','perfis_tecnicos');

  -- Apaga em passadas: a tabela que ainda é referenciada volta para a próxima.
  for i in 1..10 loop
    v_resto := '{}';
    foreach t in array v_tabelas loop
      begin
        execute format('delete from public.%I where empresa_id = $1', t) using v_emp;
      exception when foreign_key_violation then
        v_resto := v_resto || t;
      end;
    end loop;
    exit when cardinality(v_resto) = 0;
    v_tabelas := v_resto;
  end loop;
  if cardinality(v_resto) > 0 then
    raise exception 'Não consegui limpar: %', v_resto;
  end if;

  -- ------------------------------------------------------------------
  -- 1) A empresa.
  -- ------------------------------------------------------------------
  update public.empresas
     set nome = 'Enerpeixe S.A. (Usina Hidrelétrica)', codigo = 'enerpeixe'
   where id = v_emp;

  -- ------------------------------------------------------------------
  -- 2) Setores da usina, dois locais (com QR) em cada.
  -- ------------------------------------------------------------------
  for i in 1..6 loop
    insert into public.setores (empresa_id, nome, cor)
    values (v_emp, v_nomes_set[i], v_cores[i])
    returning id into v_setor;
    v_setores := v_setores || v_setor;

    for j in 0..1 loop
      insert into public.locais (empresa_id, setor_id, nome, descricao)
      values (v_emp, v_setor, v_locais_n[i * 2 - 1 + j], v_nomes_set[i])
      returning id into v_local;
      v_locais := v_locais || v_local;
    end loop;
  end loop;

  -- ------------------------------------------------------------------
  -- 3) 36 colaboradores fictícios, 6 por setor. PIN pela trigger.
  -- ------------------------------------------------------------------
  for i in 1..36 loop
    v_setor := v_setores[1 + ((i - 1) % 6)];
    insert into public.colaboradores (
      empresa_id, setor_id, matricula, nome, turno, lgpd_aceite_versao, lgpd_aceite_em)
    values (
      v_emp, v_setor, (2000 + i)::text, v_pessoas[i],
      case when v_setor = v_setores[6] then 'adm' else v_turnos[1 + (i % 3)] end,
      1, now() - ((20 - i % 7) || ' days')::interval)
    returning id into v_colab;
    v_colabs := v_colabs || v_colab;
    v_col_setor := v_col_setor || v_setor;
  end loop;

  -- ------------------------------------------------------------------
  -- 4) Campanha anterior, encerrada e vazia (21 a 25/09/2026).
  --    Sem nome de escola nem cidade (CLAUDE.md regra 9).
  -- ------------------------------------------------------------------
  select id into v_assedio from public.temas where empresa_id is null and slug = 'assedio';

  insert into public.campanhas (
    empresa_id, nome, descricao, inicio, fim, status, ranking_visivel,
    perguntas_por_dia, encerrada_em)
  values (
    v_emp, 'Violência contra a mulher',
    'Campanha de uma semana sobre violência contra a mulher: reconhecer, '
    || 'acolher e denunciar.',
    date '2026-09-21', date '2026-09-25', 'encerrada', true, 3,
    timestamptz '2026-09-25 18:00:00-03')
  returning id into v_camp_ant;

  insert into public.campanha_temas (campanha_id, tema_id, empresa_id)
  values (v_camp_ant, v_assedio, v_emp);

  -- ------------------------------------------------------------------
  -- 5) Campanha ativa "Foco Total na NR-1".
  -- ------------------------------------------------------------------
  insert into public.temas (empresa_id, slug, nome, icone, cor)
  values (v_emp, 'nr1', 'NR-1 · Gerenciamento de Riscos', '📘', '#0B3C5D')
  returning id into v_tema;

  insert into public.campanhas (
    empresa_id, nome, descricao, inicio, fim, status, premiacao,
    ranking_visivel, perguntas_por_dia)
  values (
    v_emp, 'Foco Total na NR-1',
    'A norma mãe da segurança: direitos, deveres, direito de recusa, '
    || 'GRO/PGR e treinamentos, com exemplos da usina.',
    v_inicio, v_inicio + 29, 'ativa',
    'Churrasco de confraternização para o setor campeão e kit térmico para os 3 primeiros',
    true, 3)
  returning id into v_camp;

  insert into public.campanha_temas (campanha_id, tema_id, empresa_id)
  values (v_camp, v_tema, v_emp);

  insert into public.licoes (
    empresa_id, campanha_id, tema_id, titulo, conteudo_md, carga_minutos,
    ordem, nota_minima, publicada)
  values
  (v_emp, v_camp, v_tema, 'NR-1: a norma mãe',
   E'## O que é a NR-1\n\n'
   || E'A NR-1 é a **norma mãe** da segurança do trabalho. Ela vale para todas as outras NRs.\n\n'
   || E'- Vale para **empregador e empregado** com carteira assinada (CLT).\n'
   || E'- Cria o **GRO**: o jeito contínuo de achar, avaliar e controlar os riscos.\n'
   || E'- Não tira a obrigação de seguir regras do município, do estado e a convenção coletiva.\n\n'
   || E'Na usina, isso vale da casa de força ao escritório.\n',
   10, 1, 70, true),
  (v_emp, v_camp, v_tema, 'Direitos, deveres e a ordem da prevenção',
   E'## A empresa deve\n\n'
   || E'- Cumprir e fazer cumprir as normas.\n'
   || E'- **Informar** os riscos, as medidas de prevenção e os resultados dos exames.\n'
   || E'- Fazer ordens de serviço e dizer o que fazer em caso de acidente.\n\n'
   || E'## Você deve\n\n'
   || E'- Cumprir as ordens de serviço e fazer os exames médicos.\n'
   || E'- **Usar o EPI** fornecido. Recusar sem motivo é falta.\n\n'
   || E'## A ordem da prevenção\n\n'
   || E'1. **Eliminar** o risco.\n2. **Proteção coletiva** (EPC): barreira, guarda-corpo, enclausuramento.\n'
   || E'3. **Organização** do trabalho: procedimento, rodízio, sinalização.\n4. **EPI**: a última barreira.\n',
   15, 2, 70, true),
  (v_emp, v_camp, v_tema, 'Direito de recusa: risco grave e iminente',
   E'## Parou, avisou, protegeu\n\n'
   || E'Se você vê um **risco grave e iminente** para a sua vida ou saúde, pode **parar o serviço**.\n\n'
   || E'1. Pare a atividade.\n2. **Avise na hora** o seu superior.\n'
   || E'3. Só volte quando o risco for **neutralizado**.\n\n'
   || E'Ninguém pode punir você por usar esse direito de boa-fé.\n\n'
   || E'Exemplos na usina: turbina sem bloqueio de energia, altura no vertedouro sem ancoragem, '
   || E'painel energizado sem EPI de arco elétrico.\n',
   10, 3, 70, true),
  (v_emp, v_camp, v_tema, 'GRO e PGR na prática',
   E'## GRO é o processo, PGR é o documento\n\n'
   || E'O **GRO** acontece todo dia: levantar, identificar, avaliar e decidir. O **PGR** registra tudo.\n\n'
   || E'O PGR tem no mínimo:\n\n'
   || E'- **Inventário de riscos**: perigos, possíveis lesões e nível de risco (severidade × probabilidade). '
   || E'Guardado por **20 anos**.\n'
   || E'- **Plano de ação**: o que fazer, quem faz e até quando.\n\n'
   || E'Revisão a cada **2 anos** ou quando mudar o processo, houver acidente ou a medida não funcionar.\n',
   15, 4, 70, true),
  (v_emp, v_camp, v_tema, 'Treinamentos que valem',
   E'## Quando treinar\n\n'
   || E'- **Inicial**: antes de começar a função.\n'
   || E'- **Periódico**: no prazo de cada NR.\n'
   || E'- **Eventual**: mudança de processo, acidente grave ou volta de afastamento acima de **180 dias**.\n\n'
   || E'Treinamento de outra empresa pode valer, se estiver na validade e for avaliado por um responsável técnico.\n\n'
   || E'EAD vale, seguindo as regras do **Anexo II**.\n',
   10, 5, 70, true),
  (v_emp, v_camp, v_tema, 'Respeito, documentos digitais e terceiros',
   E'## Assédio não\n\n'
   || E'A empresa com CIPA precisa ter regras de conduta, **canal de denúncia anônima** e treinamento '
   || E'pelo menos uma vez por ano. Use o **Canal de Respeito**.\n\n'
   || E'## Documentos digitais\n\n'
   || E'Os documentos de SST são preferencialmente digitais, com assinatura **ICP-Brasil**.\n\n'
   || E'## Terceiros na usina\n\n'
   || E'A contratada e a Enerpeixe trocam informações sobre os riscos. A Enerpeixe coordena a prevenção no local.\n',
   10, 6, 70, true);

  -- ------------------------------------------------------------------
  -- 6) Material informativo NR-1: o cartaz e a página do QR leem daqui.
  -- ------------------------------------------------------------------
  insert into public.materiais (empresa_id, campanha_id, slug, titulo, subtitulo, blocos, publicado)
  values (v_emp, v_camp, 'nr1', 'Foco Total na NR-1',
    'A norma mãe da segurança, em poucas palavras.',
    jsonb_build_array(
      jsonb_build_object('icone','BookOpen','titulo','O que é a NR-1',
        'texto','A norma mãe: regras gerais que valem para todas as outras NRs.'),
      jsonb_build_object('icone','Building2','titulo','Dever da empresa',
        'texto','Informar os riscos, as medidas de prevenção e os resultados dos exames.'),
      jsonb_build_object('icone','HardHat','titulo','Seu dever',
        'texto','Cumprir as ordens de serviço, fazer os exames e usar o EPI.'),
      jsonb_build_object('icone','Hand','titulo','Direito de recusa',
        'texto','Risco grave e iminente? Pare e avise na hora. Só volte com o risco controlado.'),
      jsonb_build_object('icone','Layers','titulo','Ordem da prevenção',
        'texto','1º eliminar o risco · 2º proteção coletiva · 3º organização do trabalho · 4º EPI.'),
      jsonb_build_object('icone','ClipboardList','titulo','GRO e PGR',
        'texto','GRO é o processo de cuidar dos riscos. PGR é o documento: inventário de riscos e plano de ação.'),
      jsonb_build_object('icone','GraduationCap','titulo','Treinamento',
        'texto','Antes de começar, no prazo da NR e sempre que algo mudar ou após 180 dias afastado.'),
      jsonb_build_object('icone','HeartHandshake','titulo','Respeito',
        'texto','Assédio não. Denuncie de forma anônima pelo Canal de Respeito.')
    ),
    true);

  -- ------------------------------------------------------------------
  -- 7) Eventos: 3 DDS e a SIPAT; o último DDS ainda está agendado.
  -- ------------------------------------------------------------------
  for i in 1..4 loop
    insert into public.eventos (
      empresa_id, campanha_id, tipo, titulo, descricao, setor_id, inicio, fim, pontos, status)
    values (
      v_emp, v_camp,
      case when i = 3 then 'sipat' else 'dds' end,
      (array[
        'DDS: NR-1, a norma mãe',
        'DDS: direito de recusa na casa de força',
        'SIPAT 2026 — Foco Total na NR-1',
        'DDS: inventário de riscos do vertedouro'])[i],
      (array[
        'Conversa de 15 minutos sobre direitos e deveres da NR-1.',
        'Quando parar o serviço e como avisar o superior.',
        'Abertura da SIPAT no refeitório com quiz ao vivo no Modo TV.',
        'Leitura do inventário de riscos da barragem e do plano de ação.'])[i],
      case i when 2 then v_setores[1] when 4 then v_setores[4] else null end,
      (v_inicio + (array[0, 1, 3, 7])[i]) + time '07:00',
      (v_inicio + (array[0, 1, 3, 7])[i]) + time '07:20',
      case when i = 3 then 10 else 5 end,
      case when i = 4 then 'agendado' else 'realizado' end)
    returning id into v_evento;

    continue when i = 4;
    for j in 1..array_length(v_colabs, 1) loop
      continue when (i = 2 and v_col_setor[j] <> v_setores[1]) or (j % (i + 2) = 0);
      insert into public.checkins (empresa_id, evento_id, colaborador_id, criado_em)
      values (v_emp, v_evento, v_colabs[j], (v_inicio + (array[0, 1, 3])[i]) + time '07:05')
      on conflict do nothing;
      perform public._lancar_pontos(
        v_camp, v_colabs[j], v_col_setor[j], 'engajamento', 'checkin', v_evento,
        case when i = 3 then 10 else 5 end);
    end loop;
  end loop;

  -- ------------------------------------------------------------------
  -- 8) Relatos típicos de hidrelétrica.
  -- ------------------------------------------------------------------
  for i in 1..10 loop
    insert into public.relatos (
      empresa_id, campanha_id, colaborador_id, setor_id, local_id, categoria,
      descricao, status, gravidade, validado, validado_em, criado_em)
    values (
      v_emp, v_camp, v_colabs[i * 3], v_col_setor[i * 3],
      v_locais[(array[5, 8, 3, 1, 7, 5, 6, 10, 4, 12])[i]],
      (array['condicao_insegura','quase_acidente','condicao_insegura','ato_inseguro','melhoria',
             'quase_acidente','condicao_insegura','melhoria','ato_inseguro','condicao_insegura'])[i],
      (array[
        'Vazamento de óleo no mancal da turbina 2 deixa o piso escorregadio.',
        'Guarda-corpo do vertedouro solto: quase caí ao me apoiar.',
        'Porta do cubículo de média tensão sem cadeado de bloqueio.',
        'Colega entrou na casa de força sem protetor auricular.',
        'Sugiro sinalizar a rota de fuga da crista da barragem com faixa refletiva.',
        'Talha da oficina desceu sozinha durante o içamento da peça.',
        'Escada de acesso ao poço da turbina com degrau quebrado.',
        'Sugiro colete salva-vidas extra no barco de inspeção do reservatório.',
        'Serviço na subestação começou sem a permissão de trabalho assinada.',
        'Prateleira alta do almoxarifado sem trava, caixas podem cair.'])[i],
      (array['resolvido','em_correcao','resolvido','em_analise','aberto',
             'resolvido','em_correcao','resolvido','em_analise','aberto'])[i],
      (array['media','alta','alta','media','baixa','alta','media','baixa','alta','media'])[i],
      i not in (5, 10),
      case when i not in (5, 10) then v_inicio + i % 4 + 1 else null end,
      v_inicio + i % 4)
    returning id into v_relato;

    if (array['resolvido','em_correcao','resolvido','em_analise','aberto',
              'resolvido','em_correcao','resolvido','em_analise','aberto'])[i] = 'resolvido' then
      insert into public.relato_historico (
        empresa_id, relato_id, status, comentario, visivel_colaborador, criado_em)
      values (v_emp, v_relato, 'resolvido', 'Correção executada pela manutenção.', true,
              v_inicio + i % 4 + 2);
    end if;

    if i not in (5, 10) then
      perform public._lancar_pontos(
        v_camp, v_colabs[i * 3], v_col_setor[i * 3], 'relatos', 'relato_validado', v_relato, 20);
    end if;
  end loop;

  raise notice 'Enerpeixe pronta (id %)', v_emp;
end $$;
