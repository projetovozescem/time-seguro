# Dúvidas e ambiguidades — T.I.M.E. Seguro

> Ambiguidade entre documentos, ou entre documento e código, que não bloqueia o
> trabalho: registrar aqui, seguir com a suposição mais segura e deixar explícito
> qual foi a suposição.

## 1. MCP read-only ou com escrita?

`TIME_13` §2.3 não traz `read_only` no template e o §6 fala em "MCP com permissão
de escrita no banco". Mas as migrations são aplicadas por `supabase db push`
(`TIME_02` §1), não pelo MCP.
**Suposição:** seguir o template do `TIME_13` literalmente (sem `read_only`) e usar
o MCP só para leitura de schema. Nenhuma escrita pelo MCP sem confirmação.

## 2. Dois servidores MCP do Supabase

O plugin oficial instala um servidor chamado `supabase`; o `TIME_13` §2.3 cria
`supabase-dev`. Os dois juntos duplicam as ferramentas.
**Suposição:** manter só `supabase-dev`, do `TIME_13`.

## 3. Onde ficam os tipos gerados

Regra 10 do `CLAUDE.md` e `TIME_02` §1.5 pedem `src/lib/database.types.ts`; o
código herdado tem `src/integrations/supabase/types.ts`.
**Suposição:** gerar em `src/lib/database.types.ts` e repontar os imports; apagar o
arquivo antigo junto com o schema do V.O.Z.E.S.

## 4. `service_role` no SSR

`src/integrations/supabase/client.server.ts` usa `SUPABASE_SERVICE_ROLE_KEY`, e o
`TIME_03` §8 diz que a service role key fica "só nas Edge Functions, nunca no
front". É SSR, não front, mas o T.I.M.E. não parece precisar disso.
**Suposição:** não remover agora; revisar quando alguma rota do painel precisar de
SSR autenticado. Registrado para decisão.

## 5. Componentes herdados fora da lista do `TIME_11`

`AberturaAnimada`, `CampanhaEncerrada`, `PageHeader` e `routes/README.md` não
aparecem na lista de "manter" nem na de "remover" do `TIME_11` Fase 0.
**Suposição:** manter `AberturaAnimada` (o `TIME_05` §10 pede abertura animada) e
`PageHeader`; remover `CampanhaEncerrada` (é a tela de fim de campanha do
V.O.Z.E.S., e o T.I.M.E. tem outra regra de ciclo).

## 6. Código morto do preview do Lovable

`src/integrations/supabase/{auth-middleware,auth-attacher,cron-auth}.ts` não são
importados por ninguém, e `previewAuthStorage.ts` é usado só pelo `client.ts`
para intermediar auth dentro do iframe do Lovable — coisa que um deploy próprio
não precisa.
**Suposição:** não remover agora. Mexer aí altera o armazenamento da sessão de
auth, e o `AGENTS.md` exige confirmação antes de alterar autenticação. Renomeei
só a variável de ambiente. Decidir na Fase 2, quando o login do painel for
exercitado de verdade.

## 7. `src/integrations/supabase/types.ts` x `src/lib/database.types.ts`

O arquivo antigo ainda descreve o schema do V.O.Z.E.S. (turmas, participantes).
**Suposição:** gerar `src/lib/database.types.ts` com `gen types` contra o DEV e
só então apagar o antigo e repontar os imports. Não escrevi o tipo à mão: seriam
30 tabelas de adivinhação divergindo do banco real.
