# AGENTS.md — T.I.M.E. Seguro

## Projeto

T.I.M.E. Seguro — Treinar, Identificar, Mobilizar e Evoluir. Plataforma de capacitação em SST/CIPA+A
para a indústria. Especificação completa em `docs/TIME_00` a `docs/TIME_13`. Regras inegociáveis em `CLAUDE.md`.
A base de código é cópia do V.O.Z.E.S.: nunca alterar o projeto original.

## Fonte da verdade

1. `docs/TIME_*.md` (requisitos). Não inventar requisito. Ambiguidade → registrar em `memory/duvidas.md`
   e seguir com a suposição mais segura.
2. `docs/TIME_02_BANCO_DE_DADOS.md`: o SQL ali foi testado. Copiar para `supabase/migrations/` SEM alterar.
   Mudança de banco = nova migration, nunca editar migration já aplicada.

## Stack

TanStack Start + React + TypeScript, Tailwind v4, shadcn/ui, Supabase (Postgres, Auth só para técnicos,
Storage, Edge Functions), Vitest.

## Memória do projeto (ler ANTES de qualquer tarefa)

- `memory/progress.md` — feito, em andamento, próximo, ordem das funcionalidades
- `memory/decisoes.md` — decisões e motivos
- `memory/erros.md` — falhas e abordagens descartadas
- `memory/duvidas.md` — ambiguidades pendentes
  Atualizar ao fim de CADA tarefa.

## Fluxo por funcionalidade (Spec Kit)

constitution (uma vez) → specify → clarify (só se houver dúvida real) → plan → tasks → analyze (só em
funcionalidade grande) → implement. Artefatos em `specs/NNN-nome/`.
Implementação (Superpowers): plano curto, teste antes do código, depuração sistemática, revisão ao fim da tarefa.

## Gates (não avançar sem EVIDÊNCIA)

1. Spec completa e sem pendência crítica.
2. Migration aplicada + RLS testada por perfil (anon, colaborador via RPC, tecnico, cipa, admin, comite_assedio):
   mostrar as consultas e o resultado.
3. Testes da tarefa passando: mostrar comando e saída.
4. Interface funcionando: descrever como foi verificada (rota, ação, resultado).
5. Falhou 2 vezes a mesma verificação → PARAR, mudar a abordagem, registrar em `memory/erros.md`.

## Segurança

- MCP do Supabase só no projeto de DESENVOLVIMENTO. Nunca produção.
- Pedir confirmação ANTES de: apagar tabelas/dados, desabilitar RLS, alterar autenticação,
  instalar dependência grande, mexer em variáveis de ambiente.
- Nunca gravar chave/segredo em código, `.mcp.json` versionado ou arquivos de memória.
- Dados de colaboradores e relatos são sensíveis: RLS ativa desde a criação da tabela; cada empresa vê só os seus dados.
- Canal de Respeito: nunca enviar token, nunca pontuar, nunca logar identificação.

## Agentes

- `banco`: schema, migrations, RLS, funções SQL, testes de permissão.
- `qa`: testes, validação de gates, revisão final. Não escreve funcionalidade nova.
  Delegar banco ao `banco` e validação ao `qa`.

## Economia de tokens

Levantar contexto de uma vez, ler só trechos necessários, edições pontuais (não reescrever arquivo inteiro),
tarefa pronta quando o teste dela passa.

## Benjamin-Plus

<!-- Fonte: https://github.com/JetBrains/benjamin-plus-skill (injected-instruction.md) -->

BENJAMIN-PLUS MODE ACTIVE

# Benjamin-Plus

Every request you send re-reads the whole conversation so far. The bill is
steps × context, not words. Save by taking fewer steps and keeping bulky tool
output out of the transcript — never by skimping on the work itself. Solve the
task exactly as you otherwise would; these rules change how you look things
up, not what you build.

**1. Recon in one pass.**
Before changing anything, collect every independent fact in a single step:
chain probes with `;` and label the sections
(`echo == layout ==; ls -la; echo == deps ==; head -30 requirements.txt`),
or issue several tool calls in one message. A second lookup round is for
questions the first round's answers created. Copying a convention (a DSL,
schema, or file format)? Sample two existing examples of the exact construct
you will write, not one.

**2. Look through a keyhole.**
A command that only inspects ends with a limiter: `| head -50`, `| tail -20`,
`grep -m 20`, `wc -l` before contents, Read with offset/limit. Size unknown?
Measure first, then read the slice you need. Read a file whole only when you
are about to edit it or copy from it verbatim — truncating data you will
transform corrupts output, so keyhole rules apply to inspection, never to
ingestion. If a peek was too narrow, take exactly one wider look.

**3. Probe the environment once.**
Before running code with several dependencies, check them all in one probe
and install everything missing in one command — never one traceback at a
time. A plain `import x, y, z` stops at the first missing module, so check
each one:
`python3 -c "import importlib.util as u; [print(m) for m in ['x','y','z'] if not u.find_spec(m)]"`
and `command -v tool1 tool2` for binaries.

**4. Green means the task's own check.**
If the task names verification commands, those are the check: run them
exactly as written, and green means exit status zero. A failure you judge
environmental (missing package, compiler, or tool) is still your failure —
fix the environment and re-run; "unrelated to my change" is not a green
check. The same check failing twice on the same approach means the approach
is wrong: name one alternative and try it before patching the next symptom.
When the check passes, stop: no victory laps, no re-reading files you just
wrote. Close with at most two lines.

**5. Polling is a step.**
A running command that hasn't finished is not new information — but every
status check re-reads the whole conversation. If your harness returns while a
command is still running, wait in large slices (30 seconds or more; minutes
for builds and test suites) before checking again. Never re-poll at
one-second intervals, and never send empty input just to peek. Where
execution blocks until completion, this rule costs nothing.

Never build a verification harness, test suite, or checker the task didn't
ask for — verify stated properties with the shortest command that measures
them, and spend the saved steps on the task itself. If saving a step risks a
wrong result, spend the step: efficiency never outranks correctness, a
failing check, or anything the task explicitly asks you to produce.

> Ressalva deste projeto: os gates acima SÃO pedidos explicitamente pela tarefa.
> A regra 4 manda rodá-los, não economizá-los.

## Karpathy Guidelines

<!-- Fonte: https://github.com/forrestchang/andrej-karpathy-skills (CLAUDE.md) -->

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
