-- =====================================================================
-- T.I.M.E. Seguro — 20261001000007_revoga_sequencias_anon.sql
--
-- Fecha uma brecha encontrada pelo gate de RLS depois de aplicar as 6
-- migrations do docs/TIME_02.
--
-- A 0005 §1 faz `revoke all on all tables in schema public`, que não alcança
-- SEQUENCES. Com os grants padrão do Supabase, `anon` ficou com
-- SELECT/UPDATE/USAGE em public.denuncia_mensagens_ordem_seq.
--
-- Por que importa: `anon` não lê o conteúdo das denúncias (a tabela não tem
-- grant nenhum), mas podia chamar nextval() e queimar a numeração de
-- `denuncia_mensagens.ordem` — ou ler o último valor e inferir quantas
-- mensagens existem no Canal de Respeito. Pelo docs/TIME_03 §4 e §6, `anon`
-- só executa RPC; não toca objeto nenhum de public.
--
-- O SQL do docs/TIME_02 fica intacto: isto é migration nova, como manda o
-- AGENTS.md.
-- =====================================================================

revoke all on all sequences in schema public from anon, authenticated;

-- As RPCs são SECURITY DEFINER e rodam como o dono, então não dependem destes
-- grants para usar as sequences.

-- E as sequences criadas daqui para frente também já nascem fechadas.
alter default privileges in schema public revoke all on sequences from anon, authenticated;
