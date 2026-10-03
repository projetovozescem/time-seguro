-- =====================================================================
-- T.I.M.E. Seguro — Enerpeixe, extras: um cadastro pendente e denúncias do
-- Canal de Respeito. Roda no fim de `seed-enerpeixe.mjs` (ou sozinho:
-- node scripts/db-sql.mjs "$(cat scripts/seed-enerpeixe-extras.sql)").
--
-- Idempotente: apaga o que ele mesmo criou antes de inserir.
--
-- Canal de Respeito (CLAUDE.md regra 3): as denúncias não têm colaborador,
-- nome nem hora — só a DATA. Textos de exemplo, sem identificar ninguém.
-- A senha de acompanhamento de todas é `demo123` (bcrypt).
-- =====================================================================

do $$
declare
  v_emp   uuid;
  v_setor uuid;
begin
  select id into v_emp from public.empresas where codigo = 'enerpeixe';
  if v_emp is null then
    raise exception 'Empresa enerpeixe não existe. Rode scripts/seed-enerpeixe.mjs primeiro.';
  end if;

  -- ------------------------------------------------------------------
  -- Cadastro pendente: aparece em Colaboradores > Pendentes.
  -- ------------------------------------------------------------------
  select id into v_setor from public.setores where empresa_id = v_emp and nome = 'Administrativo';

  delete from public.solicitacoes_cadastro
   where empresa_id = v_emp and lower(email) = 'max.eldon@gmail.com';

  insert into public.solicitacoes_cadastro (empresa_id, nome, matricula, email, setor_id)
  values (v_emp, 'Max Eldon Martins', '2037', 'max.eldon@gmail.com', v_setor);

  -- ------------------------------------------------------------------
  -- Denúncias de exemplo: assédio, convívio e falta de respeito.
  -- ------------------------------------------------------------------
  delete from public.denuncias_assedio
   where empresa_id = v_emp and protocolo like 'RESP-ENER-%';

  insert into public.denuncias_assedio (
    empresa_id, protocolo, senha_hash, categoria, descricao,
    local_aproximado, periodo_aproximado, quer_retorno, status, recebida_em)
  select v_emp, d.protocolo, extensions.crypt('demo123', extensions.gen_salt('bf', 8)),
         d.categoria, d.descricao, d.local, d.periodo, d.retorno, d.status,
         current_date - d.dias
    from (values
      ('RESP-ENER-0001', 'moral',
       'O encarregado do turno grita com a equipe na frente de todo mundo quando a meta não fecha, e já humilhou um colega chamando de incapaz no rádio.',
       'Casa de força', 'Nas últimas semanas', true, 'em_apuracao', 18),
      ('RESP-ENER-0002', 'moral',
       'Um colega mais antigo retira as ferramentas da bancada de um novato e depois cobra o serviço atrasado. Já virou rotina e o novato anda isolado.',
       'Oficina mecânica', 'Há cerca de um mês', true, 'recebida', 3),
      ('RESP-ENER-0003', 'moral',
       'A chefia manda uma pessoa fazer só tarefas de limpeza, mesmo com curso técnico, como forma de castigo depois que ela questionou uma escala.',
       'Sala de comando', 'Desde o mês passado', false, 'em_apuracao', 11),
      ('RESP-ENER-0004', 'sexual',
       'Um colega faz comentários sobre o corpo de uma colega e insiste em convites, mesmo depois de ela dizer não várias vezes.',
       'Vestiário e corredor do refeitório', 'Toda semana', true, 'em_apuracao', 14),
      ('RESP-ENER-0005', 'sexual',
       'Uma pessoa recebe mensagens fora do horário de trabalho, com conteúdo íntimo, de alguém que tem poder sobre a escala dela.',
       'Mensagens de celular', 'Nos últimos 15 dias', true, 'recebida', 2),
      ('RESP-ENER-0006', 'discriminacao',
       'Uma pessoa mais velha foi deixada de fora de um treinamento novo com a desculpa de que "não tem mais idade para aprender".',
       'Sala de treinamento', 'No mês passado', false, 'concluida', 20),
      ('RESP-ENER-0007', 'discriminacao',
       'Piadas sobre o sotaque e a cor de um trabalhador terceirizado são feitas diariamente por parte da equipe, que ri junto.',
       'Subestação', 'Há mais de dois meses', true, 'em_apuracao', 9),
      ('RESP-ENER-0008', 'outro',
       'Dois colegas de turnos diferentes discutem em voz alta e se desrespeitam toda vez que passam o plantão, e o clima da equipe ficou pesado.',
       'Sala de comando', 'Nesta semana', false, 'recebida', 1),
      ('RESP-ENER-0009', 'outro',
       'Falta de respeito com o pessoal da limpeza e da cozinha: ninguém cumprimenta, jogam lixo no chão do refeitório de propósito e tratam com desdém.',
       'Refeitório', 'Todo dia', true, 'concluida', 17),
      ('RESP-ENER-0010', 'outro',
       'Um supervisor interrompe e debocha da opinião de uma colega em todas as reuniões de DDS, o que faz o pessoal ficar com medo de falar.',
       'Reuniões de DDS', 'Nas últimas semanas', true, 'arquivada', 19)
    ) as d(protocolo, categoria, descricao, local, periodo, retorno, status, dias);

  raise notice 'pendentes: %', (select count(*) from public.solicitacoes_cadastro where empresa_id = v_emp and status = 'pendente');
  raise notice 'denuncias: %', (select count(*) from public.denuncias_assedio where empresa_id = v_emp);
end $$;
