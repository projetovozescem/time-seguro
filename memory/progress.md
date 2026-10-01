# Progresso — T.I.M.E. Seguro

> Ler este arquivo, `decisoes.md`, `erros.md` e `duvidas.md` ANTES de qualquer tarefa.
> Atualizar ao fim de CADA tarefa.

## Ordem das funcionalidades

Definida pelas fases do `docs/TIME_11` §1. Prazo da inscrição: **05/10/2026**.

| Fase | Entrega                                     | Estado                                                 |
| ---- | ------------------------------------------- | ------------------------------------------------------ |
| —    | Instalação e configuração (`TIME_13` §1–§2) | feita (1 pendência)                                    |
| 0    | Setup e limpeza do V.O.Z.E.S.               | **feita**                                              |
| 1    | Banco completo (6 migrations do `TIME_02`)  | migrations no disco; **não aplicadas**                 |
| 2    | Auth do painel + colaboradores + PINs       | login feito; resto não                                 |
| 3    | Perguntas + importador                      | não iniciada                                           |
| 4    | Campanha + trilha + eventos                 | não iniciada                                           |
| 5    | App do colaborador                          | entrar/PIN/termo/início/quiz escritos, não exercitados |
| 6    | Relatos com foto + validação                | não iniciada                                           |
| 7    | Canal de Respeito                           | não iniciada                                           |
| 8    | Modo TV (Clássico + check-in)               | não iniciada                                           |
| 9    | Ranking, selos, encerramento, certificados  | não iniciada                                           |
| 10   | Analytics, mapa de lacunas, relatório       | não iniciada                                           |
| 11   | Materiais, dados de demonstração, deploy    | não iniciada                                           |

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

## Ordem do desenvolvimento autônomo (docs/TIME_13 §4)

Registrada em 01/10/2026. Prazo da inscrição: **05/10/2026 — 4 dias**.
Prioridade declarada no §4: primeiro o que torna a demonstração real; Duelo,
Eliminação, comparativo trimestral e certificado em PDF ficam por último.

| #   | Pilar       | Funcionalidade                               | Fonte                               | Fase TIME_11 |
| --- | ----------- | -------------------------------------------- | ----------------------------------- | ------------ |
| 0   | —           | Banco aplicado + tipos + RLS testada         | TIME_02, TIME_03                    | 1            |
| 1   | Treinar     | Perguntas + importador TXT/CSV/PDF           | TIME_07, TIME_12                    | 3            |
| 2   | Treinar     | Campanha, trilha e eventos                   | TIME_04 §4 e §8, TIME_08            | 4            |
| 3   | Treinar     | App do colaborador: trilha e avaliação       | TIME_05 §6                          | 5            |
| 4   | Treinar     | Pontuação e selos                            | TIME_08                             | 5            |
| 5   | Identificar | Relatos com foto + Edge Function + validação | TIME_05 §7, TIME_04 §9, TIME_03 §5  | 6            |
| 6   | Identificar | Canal de Respeito                            | TIME_01 §7, TIME_03 §6, TIME_04 §10 | 7            |
| 7   | Mobilizar   | Modo TV Clássico + check-in                  | TIME_06                             | 8            |
| 8   | Mobilizar   | Ranking e encerramento da campanha           | TIME_08 §6                          | 9            |
| 9   | Evoluir     | Analytics e MAPA DE LACUNAS                  | TIME_09 §1.2                        | 10           |
| 10  | Evoluir     | Relatório de evidência                       | TIME_09                             | 10           |
| 11  | Evoluir     | Certificados e /verificar                    | TIME_09 §5                          | 9            |
| 12  | —           | Materiais, seed de demonstração e deploy     | TIME_11 Fase 11                     | 11           |
| 13  | Mobilizar   | Duelo de Setores e Eliminação                | TIME_06                             | 8 (⏳)       |
| 14  | Evoluir     | Comparativo trimestral                       | TIME_09                             | 10 (⏳)      |

O item **0** é pré-requisito de todos os outros: sem schema no banco, nenhum
gate de RLS, de teste ou de interface pode ser cumprido.

## Em andamento

Item 1 (perguntas + importador): parser TXT e CSV prontos e testados. Faltam as
telas `/painel/perguntas` e `/painel/perguntas/importar`, o parser de PDF e o
exportar TXT pela interface.

## Feito em 01/10/2026 — item 0 concluído

- Projeto DEV `niazcsjnxvoeeolwrcqx` ("TIME", sa-east-1) configurado. É o único
  projeto da conta: a produção do V.O.Z.E.S. não é alcançável por este token.
- **7 migrations aplicadas** (as 6 do TIME_02 + uma nova que fecha brecha de
  sequence), registradas em `supabase_migrations.schema_migrations` para o CLI
  continuar funcionando. Renomeadas para prefixo de timestamp (TIME_02 §1.3).
- Conferência do TIME_02 §7: 7 temas globais, 10 selos, 18 funções
  `colaborador_*`, 30 tabelas, nenhuma sem RLS.
- `src/lib/database.types.ts` gerado (2.282 linhas). `types.ts` do V.O.Z.E.S.
  apagado, imports repontados, contorno de tipagem do `rpc.ts` removido —
  `rpcApp` agora só aceita nome de RPC que existe no banco.
- Gate de RLS reescrito: 235 verificações em 11s (eram 382 em minutos) e agora
  pega grant por coluna e por sequence, que a versão anterior não via.
- Gate de fluxo novo (`npm run test:fluxo`): 38 verificações por HTTP real,
  cobrindo as 6 famílias do TIME_13 §3f.
- Bootstrap e seed de demonstração reproduzíveis por script.
- Subárvore órfã do V.O.Z.E.S. (analytics, calendário, materiais, vozes.ts)
  movida para `docs/legado-vozes/`; será portada nas fases 4 e 10.
- Parser de importação TXT + CSV (item 1) com os 7 casos do TIME_07 §7.

## Próximo

1. Telas `/painel/perguntas` e `/painel/perguntas/importar` (item 1).
2. Campanha, trilha e eventos (item 2).

## Bloqueado (precisa do usuário)

- **Rotacionar `SUPABASE_ACCESS_TOKEN`** (está no `.env`, fora do git) e a
  `sb_secret_` — as duas foram expostas no chat. O token segue válido.
- **Trocar a senha provisória do admin** no primeiro acesso (está em `BOOTSTRAP_SENHA`, no `.env`).
- **Desativar cadastro público** no Supabase Auth (TIME_03 §8).
- **URL do repositório GitHub** para `git remote add origin`.
- **Superpowers**: `/plugin install superpowers@claude-plugins-official`.
- **Reiniciar a sessão** para o `.mcp.json` carregar o servidor `supabase`.
- **Confirmar remoção de `drizzle-orm`** (órfão no devDependencies).
