-- =====================================================================
-- T.I.M.E. Seguro — 0010_revoga_execute_publico.sql
--
-- Achado do gate de RLS (scripts/test-rls.mjs) ao aplicar a 0008 e a 0009:
-- as funcoes novas nasceram EXECUTAVEIS por `anon` (via PUBLIC), porque o
-- `alter default privileges` da 0005 nao alcanca funcoes criadas por esta
-- conexao. Na pratica `tecnico_*` ja recusava quem nao tem perfil
-- (`_exigir_tecnico` levanta `acesso_negado`), mas defesa em profundidade e
-- nao depender disso: quem nao deve executar nao executa.
--
-- Migration NOVA: a 0008 e a 0009 ja foram aplicadas e nao se editam.
-- =====================================================================

-- Painel: so `authenticated` (o GRANT explicito da 0008/0009 permanece).
revoke execute on function
  public.tecnico_ver_pin(uuid),
  public.tecnico_reemitir_pin(uuid),
  public.tecnico_decidir_solicitacao(uuid, boolean, uuid, text)
from public, anon;

-- Internas: ninguem de fora. Chamadas so por dentro, por funcoes SECURITY DEFINER.
revoke execute on function
  public._pin_unico(uuid),
  public._colaborador_define_pin()
from public, anon, authenticated;

-- Publicas do autocadastro: o GRANT explicito a anon e authenticated permanece;
-- tira so o PUBLIC implicito, para a permissao ser a que esta escrita.
revoke execute on function
  public.publico_setores_da_empresa(text),
  public.publico_solicitar_cadastro(text, text, text, text, uuid)
from public;

-- Para as proximas migrations: funcao nova nasce fechada.
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;
