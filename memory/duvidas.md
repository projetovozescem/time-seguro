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

## 8. `colaboradores.turno` é texto livre

O schema declara `turno text`, sem `check` e sem tabela de domínio, e o comentário
da RPC `tecnico_importar_colaboradores` usa `"turno": "A"` como exemplo. Já a
lista `TURNOS` (`manha`/`tarde`/`noite`/`adm`) do `src/lib/colaboradores.ts` é
**convenção da interface**, não regra do banco.
**Suposição:** a tela e o importador só oferecem os quatro valores e avisam na
importação quando o CSV traz outro, mas nada no banco impede um turno diferente
(nem o importador do servidor). `rotuloDoTurno` mostra o valor cru quando não
conhece. Se a especificação quiser travar, é um `check` em migration nova —
não mudar a existente.

## 9. Participação do comparativo usa o efetivo de hoje

O comparativo trimestral (TIME_09 §3) pede "% de ativos" por campanha, mas o
banco não guarda o quadro de pessoal de cada trimestre: `colaboradores.ativo` é
um estado atual, sem histórico.
**Suposição:** usar o efetivo de hoje como denominador em todas as campanhas e
dizer isso na tela, embaixo da tabela. Guardar o histórico seria uma coluna nova
em `campanhas` preenchida no encerramento — migration nova, decidir depois.

## 10. "Pular" na Eliminação mantém o acumulado

O TIME_06 §4 lista a ajuda ⏩ Pular sem dizer o que acontece com o acumulado da
rodada nem com o valor da pergunta pulada.
**Suposição:** pular passa para a próxima pergunta **mantendo** o acumulado, sem
contar acerto nem erro e sem somar o valor da pergunta pulada — é o que faz a
ajuda valer a pena sem virar ponto de graça. Pular na última pergunta encerra o
turno com o que a equipe já tinha. Está fixado em `eliminacao.test.ts`.

## 11. Duelo e Eliminação: o servidor confia nos pontos da tela, com teto

`tecnico_salvar_quiz_tv` recalcula os pontos só no modo `classico`
(`acertos × 10`). Nos outros dois ele usa o `pontos` que a tela mandou, limitado
a `respostas × 10 + 100`. Isso é do SQL de `docs/TIME_02`, que não pode ser
editado — a regra de 1º/2º/3º lugar e a escada de 2 a 40 vivem no cliente.
**Suposição:** aceitar como está e cobrir com teste de fluxo (o teto reprova
999999 → 140). Mover a regra para o SQL seria migration nova.

## 12. Textos novos de mensagens.ts (autocadastro e PIN fixo)

`nome_invalido`, `matricula_invalida`, `email_invalido`, `email_fora_do_dominio`,
`muitas_solicitacoes`, `solicitacao_nao_encontrada`, `matricula_ja_cadastrada`,
`colaborador_nao_encontrado`, `pin_indisponivel` foram escritos por mim, em
linguagem de chão de fábrica, e não vêm do `docs/TIME_05` §9. Pendente de
revisão do dono do produto (mesma situação do item 8).

## 13. Domínio de e-mail vazio deixa o cadastro aberto

Sem `empresas.config.dominios_email`, qualquer e-mail pode pedir cadastro. Todo
pedido ainda passa por aprovação humana e há teto de 30/hora e 200 pendentes.
**Suposição:** não obrigar a configurar o domínio (a empresa pode usar e-mail
pessoal no piloto) e avisar na tela de Configurações. Se preferir, é uma linha
no SQL para recusar enquanto não houver domínio.
