# Decisões — T.I.M.E. Seguro

> Uma entrada por decisão: o que foi decidido, por quê, e o que ela descarta.

## 2026-09-30 — `docs/TIME_*` é a fonte da verdade; `VOZES.md` é histórico

O repositório é cópia do V.O.Z.E.S., mas o produto é outro. `CLAUDE.md` +
`docs/TIME_00..TIME_13` mandam. `VOZES.md` fica como referência do projeto anterior.

## 2026-09-30 — Agentes em `.claude/agents/`, não `.github/agents/`

`.github/agents/` é convenção do GitHub Copilot; o Claude Code lê `.claude/agents/`.
Decidido no `TIME_13` §0. Espelhar em `.github/` só se o Copilot entrar em uso.

## 2026-09-30 — Migrations pelo CLI do Supabase, não por script próprio

`TIME_02` §1 usa `npx supabase link` + `db push`, que também dá `gen types` e
`functions deploy` (necessário na Fase 6). O `scripts/db-migrate.mjs` que havia
sido escrito foi removido para não existirem dois caminhos de migration.

## 2026-09-30 — `drizzle/` removido

`TIME_02` §1.2 e `TIME_11` Fase 0 mandam apagar. `drizzle.config.ts` saiu com ele
porque apontava para `./drizzle/schema.ts`. `drizzle-orm` continua no
`devDependencies` como órfão, aguardando confirmação do usuário para sair.

## 2026-09-30 — `@lovable.dev/vite-tanstack-config` mantido

É o motor do `vite.config.ts` (TanStack Start, nitro, tailwind, injeção `VITE_*`).
Nenhum doc do T.I.M.E. pede para trocar, e substituí-lo é tarefa própria com risco
de quebrar o build. Separar do Lovable foi feito no nível do repositório.

## 2026-09-30 — Lint: `prefer-const` com `ignoreReadBeforeAssign`

`previewAuthStorage.ts` guarda o handle do `setTimeout` numa variável lida por um
closure definido antes da atribuição. A opção é a documentada para esse padrão e
evita reordenar código herdado.

## 2026-09-30 — Spec Kit instalado, mas sem refazer a especificação

O `TIME_13` §1 manda instalar e o §6 pede "modo enxuto". Os `docs/TIME_*` já são
a spec e o `TIME_11` já é o tasks, então o Spec Kit entra para as funcionalidades
grandes das próximas fases, não para reescrever o que está nos documentos.

## 2026-09-30 — `.env` zerado em vez de apontar para o projeto antigo

Depois de renomear as chaves, o `.env` continuava com a URL e a anon key do
projeto `irpyxizuwzuquqtyajam` — a PRODUÇÃO do V.O.Z.E.S. Zerei os valores: o
app agora falha com recado claro em vez de abrir conexão com produção. Os
valores antigos seguem em `C:\Code\projeto-vozes-main\.env`.

## 2026-09-30 — `src/lib/vozes.ts` sobrevive à Fase 0

O `TIME_11` manda manter analytics, calendário e `CartaoCampanha`, e esses 9
arquivos importam tipos e helpers de `vozes.ts`. Apagá-lo agora quebraria o que
o próprio documento pede para preservar. Sai ao fim das fases 4 e 10, quando
esses componentes forem adaptados ao schema do T.I.M.E.

## 2026-09-30 — Alias `chamar` em `src/lib/rpc.ts`

`supabase.rpc` é tipado contra o `Database` do V.O.Z.E.S. e não conhece as RPCs
`colaborador_*`. Em vez de espalhar `as any` pelas telas, concentrei um único
alias documentado em `rpc.ts`. Some quando `src/lib/database.types.ts` for
gerado contra o DEV.

## 2026-09-30 — `pinFraco` em `src/lib/pin.ts`, não na rota

Exportar função de uma rota dispara `react-refresh/only-export-components` e
deixa a regra sem teste. Em módulo próprio, as regras anti-fraude do PIN
(repetido, sequência) ficam cobertas por teste de unidade.

## 2026-10-01 — Migrations pela Management API, não por `supabase db push`

`db push` exige a senha do Postgres ou projeto linkado, e nenhuma das duas estava
disponível. `scripts/db-aplicar.mjs` usa o endpoint de query da Management API e
registra em `supabase_migrations.schema_migrations` — a mesma tabela do CLI, então
`db push` continua válido no futuro. Credenciais vêm do `.env`, nunca de linha de
comando (uma tentativa com o token inline foi barrada, com razão).

## 2026-10-01 — Gate de RLS passou a ler ACL, não `has_table_privilege`

O teste negativo mostrou que `grant select (nome) on colaboradores to anon`
passava batido: `has_table_privilege` devolve falso quando o grant é por coluna.
Agora a varredura é por `aclexplode` em `pg_class.relacl` e `pg_attribute.attacl`,
que pega tabela, view, sequence e coluna. De 382 chamadas HTTP para 7 consultas.

## 2026-10-01 — Migration 0007 fecha sequence aberta para `anon`

A 0005 §1 revoga em ALL TABLES, que não alcança sequences, e o padrão do Supabase
deixou `denuncia_mensagens_ordem_seq` com SELECT/UPDATE/USAGE para `anon`. O SQL
do TIME_02 ficou intacto; a correção é migration nova, como o AGENTS.md manda.

## 2026-10-01 — Legado órfão do V.O.Z.E.S. foi para docs/legado-vozes/

Com os tipos reais gerados, `useAnalytics.ts` deixou de compilar: consultava
`turmas`, `eventos_calendario` e o shape antigo de `perguntas`. Os 10 componentes
de analytics só importavam tipos dele e nenhuma rota viva os usava. Mover preserva
a referência que o TIME_11 pede para as fases 4 e 10 sem deixar código morto em
`src/` travando o gate.

## 2026-10-01 — Seed usa o parser do app, via esbuild

`scripts/seed-dev.mjs` lê o TIME_12 com o mesmo `lerTxt` das telas, em vez de
duplicar a lógica. O Node faz type-stripping de `.ts` mas não resolve import sem
extensão, e `vite-node` travava; o bundle passa pelo esbuild, que já vem com o Vite.

## 2026-10-01 — Configuração de projeto virou script, não passo manual

`docs/TIME_02` §4 e `docs/TIME_03` §8 descrevem SQL e cliques no painel do
Supabase (bucket, policy, desativar cadastro público, redirect URLs). Virou
`npm run db:configurar`: sem argumento mostra o estado, com `--aplicar` aplica.
Assim a configuração é auditável e reproduzível num projeto novo, em vez de
depender de alguém lembrar de clicar.

## 2026-10-01 — No Storage, a proteção são as policies, não os grants

`anon` tem INSERT/SELECT/UPDATE/DELETE em `storage.objects` por padrão do
Supabase, e isso não dá para revogar (a role da Management API não é owner da
tabela). Os grants ficam inertes porque o RLS está ligado e a única policy é de
SELECT para `authenticated`. Por isso o gate afirma sobre as POLICIES: nenhuma
aberta a `anon`/`public`, nenhuma de INSERT (upload só pela Edge Function) e o
bucket privado.

## 2026-10-01 — Menu mostra o produto inteiro, com item desabilitado

O menu do TIME_04 §2 tem 15 itens e só 2 telas existem. Em vez de listar apenas
o que está pronto, o `PainelLayout` mostra todos e desabilita os sem rota, com
"em breve". O técnico vê o mapa do produto e não encontra link quebrado — e com
o router tipado do TanStack, link para rota inexistente nem compilaria.

## 2026-10-01 — Importador recusa PDF em vez de falhar silenciosamente

`pdfjs-dist` entra depois (TIME_07 §5, import dinâmico). Até lá a tela diz
"Leitura de PDF ainda não está pronta. Use TXT ou CSV, ou cole o texto." É pior
aceitar o arquivo e devolver zero pergunta sem explicar.

## 2026-10-01 — O catálogo de config é verificado contra o SQL

`src/lib/campanha.ts` lista as 15 chaves de `campanhas.config` com os padrões, e
`campanha.test.ts` lê as migrations e compara chave por chave com os
`_cfg(campanha, 'chave', padrao)`. Sem isso, a tela de "pontos avançados" poderia
exibir um padrão diferente do que o banco aplica, e ninguém notaria.

## 2026-10-01 — Reordenar a trilha por botões, não arrastando

O TIME_04 §4 pede lista ordenável por arrastar. Implementei com botões de subir e
descer: funciona com teclado, com leitor de tela e com luva — e o próprio TIME_05
§6 exige o produto usável com uma mão. Arrastar entra se o técnico pedir.

## 2026-10-01 — `EventoForm` do V.O.Z.E.S. não foi reaproveitado

O TIME_04 §8 diz "reaproveitar CalendarioGrid e EventoForm". O formulário legado é
de data única sobre os tipos da campanha escolar, e o evento do T.I.M.E. tem
início e fim com hora, setor, pontos de check-in e campanha. Reescrevi; o que se
aproveitou foi a ideia da tela. O legado segue em `docs/legado-vozes/`.

## 2026-10-01 — `react-markdown` instalado

Exigido nominalmente pelo TIME_04 §4 (editor com pré-visualização) e pelo TIME_05
§6 ("usar react-markdown, sem HTML bruto"). 75 KB, usado nas duas pontas.

## 2026-10-01 — Contrato das RPCs é verificado contra o SQL

`src/lib/contratos.test.ts` extrai as chaves do `jsonb_build_object` de cada RPC
nas migrations e compara com o que as telas leem. Cobre `colaborador_resumo`,
`perguntas_do_dia`, `responder_pergunta`, `trilha`, `licao`, `enviar_avaliacao`,
`empresa_publica` e `login` — e afirma também que o gabarito é condicional.
Motivo: um tipo TypeScript escrito à mão sobre resposta de RPC compila com
qualquer nome de campo, então não é contrato nenhum.

## 2026-10-01 — Navegação inferior em componente próprio

`NavegacaoApp` com os 5 itens do TIME_05 §1, ligada por `comNavegacao` no
`AlunoLayout`. As telas de entrada (login, novo PIN, termo) ficam sem ela: antes
de resolver a pendência nada mais funciona, e oferecer atalho só levaria a erro.
Item sem rota aparece desabilitado.

## 2026-10-01 — Parâmetro opcional de RPC é OMITIDO, não `undefined`

Com `exactOptionalPropertyTypes` no tsconfig, passar `p_comentario: undefined`
não compila. O padrão do projeto passou a ser espalhar condicionalmente:
`...(x ? { p_x: x } : {})`. As RPCs têm DEFAULT NULL, então omitir é o correto.

## 2026-10-01 — O teste de anonimato olha o código sem comentários

`respeito.test.ts` afirma que a página pública NÃO contém `rpcApp`, `p_token`,
`localStorage`. Os comentários do arquivo descrevem exatamente isso, então a
primeira versão reprovou pela própria documentação. O teste passou a remover
comentários antes das asserções de ausência, e a usar a fonte completa nas
asserções de presença.

## PIN dos cartões vai em memória, não em `sessionStorage`

`tecnico_gerar_pins` devolve o PIN puro uma única vez; depois existe só o bcrypt.
A página de impressão recebe os cartões por um módulo em memória
(`src/lib/cartoes-pendentes.ts`) e os descarta ao desmontar. Motivo: PIN em
`sessionStorage` grava no disco do computador do técnico, e PIN na URL entra no
histórico do navegador. O preço é que recarregar `/painel/colaboradores/cartoes`
perde os cartões — a tela diz isso e manda gerar de novo.

## Bucket `logos` é público; o das fotos de relato continua privado

O logo aparece no app do colaborador, que **não tem sessão do Supabase Auth**, e
nos cartazes. Bucket público é servido sem policy para `anon`, então a asserção
"anon sem policy em `storage.objects`" continua valendo. Para a policy nova não
afrouxar o bucket das fotos, o `test:rls` exige que toda policy de escrita em
`storage.objects` traga `bucket_id = 'logos'` no `with check`.
