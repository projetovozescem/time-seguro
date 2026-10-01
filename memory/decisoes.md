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
