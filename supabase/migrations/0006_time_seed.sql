-- Gerado de docs/TIME_02_BANCO_DE_DADOS.md (linha 2034) — NAO EDITAR O SQL.
-- O SQL deste arquivo foi testado em PostgreSQL 16. Mudanca de banco vira
-- migration NOVA; nunca editar uma migration ja aplicada.

-- =====================================================================
-- T.I.M.E. Seguro — 0006_time_seed.sql
-- Catálogos globais: temas e selos. (Perguntas: importar o arquivo
-- do TIME_12 pelo painel, o que também testa o importador.)
-- =====================================================================
insert into public.temas (empresa_id, slug, nome, icone, cor) values
  (null, 'assedio', 'Respeito e prevenção ao assédio', '💜', '#6A1B9A'),
  (null, 'nr10',    'NR-10 · Eletricidade',            '⚡', '#F5A300'),
  (null, 'nr12',    'NR-12 · Máquinas e equipamentos', '⚙️', '#455A64'),
  (null, 'nr35',    'NR-35 · Trabalho em altura',      '🪜', '#1565C0'),
  (null, 'epi',     'EPI · Equipamento de proteção',   '🦺', '#EF6C00'),
  (null, '5s',      '5S · Organização e limpeza',      '🧹', '#2E7D32'),
  (null, 'geral',   'Segurança geral / CIPA',          '🛡️', '#0B3C5D')
on conflict do nothing;

insert into public.selos (slug, nome, descricao, icone, ordem) values
  ('primeiro-passo',    'Primeiro Passo',       'Respondeu a primeira pergunta da campanha',              '👣', 1),
  ('olho-vivo',         'Olho Vivo',            '3 relatos validados pelo técnico de SST',                '👁️', 2),
  ('sentinela',         'Sentinela',            '10 relatos validados na campanha',                       '🛡️', 3),
  ('presenca-firme',    'Presença Firme',       'Sequência de 10 dias com atividade',                     '🔥', 4),
  ('maratonista',       'Maratonista do Saber', '100 acertos no quiz diário',                             '⚡', 5),
  ('dds-em-dia',        'DDS em Dia',           'Check-in em 10 DDS',                                     '🗣️', 6),
  ('mestre-das-nrs',    'Mestre das NRs',       'Todas as lições obrigatórias aprovadas com média ≥ 90',  '🎓', 7),
  ('voz-do-respeito',   'Voz do Respeito',      'Aprovado na lição de prevenção ao assédio',              '💜', 8),
  ('guardiao-do-setor', 'Guardião do Setor',    '1º lugar do setor ao fim do trimestre',                  '🏆', 9),
  ('podio',             'Pódio do T.I.M.E.',    'Top 3 geral ao fim do trimestre',                        '🥇', 10)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- BOOTSTRAP (rodar MANUALMENTE no SQL Editor, depois de criar o
-- primeiro usuário em Authentication > Users). Não faz parte da migração.
-- ---------------------------------------------------------------------
-- insert into empresas (nome, codigo, termo_lgpd_texto)
-- values ('Empresa Piloto', 'piloto', '<cole aqui o termo do TIME_03>')
-- returning id;
--
-- insert into perfis_tecnicos (user_id, empresa_id, nome, papel, comite_assedio)
-- values ('<uuid do usuário>', '<uuid da empresa>', 'Técnico de SST', 'admin', true);
