# Progresso — T.I.M.E. Seguro

> Ler este arquivo, `decisoes.md`, `erros.md` e `duvidas.md` ANTES de qualquer tarefa.
> Atualizar ao fim de CADA tarefa.

## Ordem das funcionalidades

Definida pelas fases do `docs/TIME_11` §1. Prazo da inscrição: **05/10/2026**.

| Fase | Entrega                                     | Estado                 |
| ---- | ------------------------------------------- | ---------------------- |
| —    | Instalação e configuração (`TIME_13` §1–§2) | feita (1 pendência)    |
| 0    | Setup e limpeza do V.O.Z.E.S.               | **feita**              |
| 1    | Banco completo (6 migrations do `TIME_02`)  | migrations no disco; **não aplicadas** |
| 2    | Auth do painel + colaboradores + PINs       | login feito; resto não |
| 3    | Perguntas + importador                      | não iniciada           |
| 4    | Campanha + trilha + eventos                 | não iniciada           |
| 5    | App do colaborador                          | entrar/PIN/termo/início/quiz escritos, não exercitados |
| 6    | Relatos com foto + validação                | não iniciada           |
| 7    | Canal de Respeito                           | não iniciada           |
| 8    | Modo TV (Clássico + check-in)               | não iniciada           |
| 9    | Ranking, selos, encerramento, certificados  | não iniciada           |
| 10   | Analytics, mapa de lacunas, relatório       | não iniciada           |
| 11   | Materiais, dados de demonstração, deploy    | não iniciada           |

## Feito

### Configuração (`TIME_13` §1–§2)

- Supabase Agent Plugin instalado (`npx plugins add`, escopo de projeto): 2 skills.
- Spec Kit instalado: Python 3.13.15 + uv 0.12.21 + specify-cli 1.0.13;
  `.specify/` e 10 skills `/speckit-*` em `.claude/skills/`.
- Planning with Files instalado (plugin local, 1 skill + 13 comandos + hooks).
- **Superpowers NÃO instalado**: é plugin de origem remota, só entra por
  `/plugin install superpowers@claude-plugins-official` numa sessão interativa.
- `AGENTS.md` do `TIME_13` §2.1 com Benjamin-Plus e Karpathy incorporados.
- `@AGENTS.md` na primeira linha do `CLAUDE.md`.
- `.claude/agents/banco.md` e `qa.md` do `TIME_13` §2.2.
- `.mcp.json` (`supabase-dev`) com `project_ref` em **placeholder**.
- `memory/` com os quatro arquivos.

### Fase 0

- `package.json` → `time-seguro`.
- Apagados: `drizzle/`, `drizzle.config.ts`, `supabase/migrations/*` do V.O.Z.E.S.,
  `src/lib/{auth,participante,lovable-error-reporting}.ts`, `components/turmas/`,
  `VozesLogo`, `CampanhaEncerrada`, as 8 rotas `_professor.*`, as 5 `aluno.*` e
  `quiz-tv.tsx`. Tudo preservado em `C:\Code\projeto-vozes-main`.
- Tema do `TIME_10` §4 em `src/styles.css`: zero cores do V.O.Z.E.S. restantes.
  Tokens nomeados (`marinho`, `amarelo`, `respeito`…) + `.faixa-seguranca`.
- `VITE_SUPABASE_PUBLISHABLE_KEY` → `VITE_SUPABASE_ANON_KEY` (`TIME_03` §8).
  `.env` **zerado**: antes apontava para a produção do V.O.Z.E.S.
- `TimeLogo`, `PainelLayout`, `AlunoLayout` e `AberturaAnimada` (escudo) refeitos.
- `docs/legado-maxgames/` com os 5 arquivos + 6 testes de `C:\Code\maxcacapalavras`
  (`TIME_11` §0.4), insumo das fases 3 e 8.

### Banco

- As 6 migrations do `TIME_02` §5.1–5.6 extraídas para `supabase/migrations/`,
  **byte a byte idênticas ao documento** (conferido). 1.947 linhas de SQL,
  30 tabelas, 13 policies.
- `scripts/test-rls.mjs` reescrito para o schema do T.I.M.E.: anon sem acesso a
  tabela nenhuma, 23 RPCs públicas, 11 RPCs só do painel, `pin_hash` e
  `senha_hash` ilegíveis, `SECURITY DEFINER` + `search_path` em toda função de
  escrita, índice único de `pontos_lancamentos`, `security_invoker` nas views,
  e a conferência do `TIME_02` §7.
- `scripts/db-migrate.mjs` removido: o caminho é `npx supabase db push`.

### Código do app e do painel

- `src/lib/sessao.ts`, `rpc.ts` (`rpcApp`/`rpcPublica`), `mensagens.ts` (24
  motivos) e `pin.ts`, conforme `TIME_03` §3 e `TIME_05` §9.
- Rotas: `/`, `/painel/login`, `/painel` (protegida), `/app/entrar`,
  `/app/novo-pin`, `/app/termo`, `/app/inicio`, `/app/quiz`.
- 37 testes de unidade em 4 arquivos, todos passando.

## Em andamento

Nada. Parado aguardando o projeto Supabase de DEV.

## Próximo

1. Aplicar as 6 migrations no DEV (`supabase link` + `db push`).
2. `gen types` para `src/lib/database.types.ts` e remover o alias `chamar` de
   `src/lib/rpc.ts` (está marcado como PENDENTE no arquivo).
3. Rodar `npm run test:rls` e o teste negativo do gate.
4. Exercitar os fluxos de ponta a ponta e então seguir a Fase 2.

## Bloqueado (precisa do usuário)

- **Projeto Supabase de DEV**: `project_ref`, `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY` e a connection string (`DATABASE_URL_DEV`).
- **Token Supabase novo** para `npx supabase login` — o anterior foi colado no
  chat e deve ser revogado.
- **URL do repositório GitHub** para `git remote add origin`.
- **Superpowers**: rodar `/plugin install superpowers@claude-plugins-official`.
- **Confirmar remoção de `drizzle-orm`** do `devDependencies` (órfão).
