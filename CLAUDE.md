@AGENTS.md

# CLAUDE.md — T.I.M.E. Seguro

> Este arquivo fica na RAIZ do repositório. O Claude Code lê automaticamente.
> A especificação completa está nos arquivos `docs/TIME_*.md`.

## O que é

**T.I.M.E. Seguro — Treinar, Identificar, Mobilizar e Evoluir.**
Plataforma gamificada de capacitação, prevenção e reconhecimento para a indústria.
Evolução do projeto V.O.Z.E.S. (campanha escolar) + motor de importação e jogos do Max Games.

Três públicos:

1. **Técnico de SST / CIPA / admin** → painel web (Supabase Auth, e-mail + senha)
2. **Colaborador do chão de fábrica** → app PWA mobile (matrícula + PIN de 6 dígitos, SEM Supabase Auth)
3. **TV do refeitório** → Modo TV (DDS e SIPAT), operado pelo técnico logado

## Stack (herdada do V.O.Z.E.S.)

- TanStack Start (React + TypeScript), roteamento por arquivo em `src/routes/`
- Tailwind CSS v4 (`@theme` em `src/styles.css`) + shadcn/ui
- Supabase: Postgres + Auth (só técnicos) + Storage (fotos de relatos) + Edge Functions
- recharts, qrcode.react, html2canvas, jspdf, date-fns (pt-BR), canvas-confetti, pdfjs-dist
- Testes: Vitest

## Regras INEGOCIÁVEIS

1. **O cliente nunca escreve pontuação.** Todo ponto nasce em função SQL `SECURITY DEFINER`
   (`_lancar_pontos`). O front só informa o que o usuário tocou.
2. **O gabarito nunca vai para o cliente antes da resposta.** As RPCs só devolvem `correta` depois de responder.
3. **Canal de Respeito (denúncia de assédio) é anônimo:** a tela NÃO envia token, NÃO chama
   `registrar_acesso`, NÃO usa analytics, NÃO grava hora nem IP. Nunca pontua.
4. **App do colaborador não lê tabelas.** Role `anon` só executa as RPCs `colaborador_*` e as públicas.
5. **Token do colaborador**: guardado em `localStorage` (`time_token`), enviado como `p_token` em toda RPC.
   Se a RPC retornar erro `sessao_invalida` → apagar token e voltar ao login.
6. **Toda tabela tem `empresa_id`** (multi-empresa). O RLS do painel usa `minha_empresa()`.
7. **Migrações só em `supabase/migrations/`** (apagar a pasta `drizzle/` herdada). Nunca editar migração
   já aplicada: criar uma nova.
8. Todo texto de interface em **português do Brasil**, linguagem simples de chão de fábrica.
9. Nenhum nome de escola (CEM, SENAI) aparece no app. O nome exibido é o da empresa cadastrada.
10. Depois de mudar o banco: `npx supabase gen types typescript --linked > src/lib/database.types.ts`.

## Mapa dos documentos (`docs/`)

| Arquivo                         | Conteúdo                                                      |
| ------------------------------- | ------------------------------------------------------------- |
| TIME_00_INDICE.md               | Visão geral e ordem de leitura                                |
| TIME_01_PRODUTO_E_REGRAS.md     | Perfis, pilares, regras de negócio                            |
| TIME_02_BANCO_DE_DADOS.md       | Migrações SQL completas (testadas)                            |
| TIME_03_SEGURANCA_LGPD.md       | Auth, sessões, RLS, LGPD, anonimato, Edge Function            |
| TIME_04_PAINEL_TECNICO.md       | Telas do painel                                               |
| TIME_05_APP_COLABORADOR.md      | Telas do app PWA                                              |
| TIME_06_MODO_TV.md              | Quiz ao vivo DDS/SIPAT e check-in                             |
| TIME_07_IMPORTACAO_PERGUNTAS.md | Importador TXT/CSV/PDF (portado do Max Games)                 |
| TIME_08_PONTUACAO_SELOS.md      | Tabela de pontos, selos, ciclo trimestral                     |
| TIME_09_RELATORIOS_ANALYTICS.md | Evidência de treinamento, mapa de lacunas, comparativo        |
| TIME_10_IDENTIDADE_VISUAL.md    | Cores, fontes, componentes                                    |
| TIME_11_PLANO_DE_EXECUCAO.md    | Fases e prompts prontos para o Claude Code                    |
| TIME_12_BANCO_DE_PERGUNTAS.md   | 36 perguntas prontas para importar                            |
| TIME_13_PROMPTS_CLAUDE_CODE.md  | Skills, AGENTS.md, agentes, MCP e prompts (piloto e autônomo) |

## Comandos

```bash
npm run dev                  # desenvolvimento
npm run build && npx vite preview   # testar PWA / service worker
npx vitest run               # testes
npx supabase db push         # aplicar migrações
npx supabase functions deploy relato-upload-url
```
