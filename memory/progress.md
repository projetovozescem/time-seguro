# Progresso — T.I.M.E. Seguro

> Ler este arquivo, `decisoes.md`, `erros.md` e `duvidas.md` ANTES de qualquer tarefa.
> Atualizar ao fim de CADA tarefa.

## Ordem das funcionalidades

Definida pelas fases do `docs/TIME_11` §1. Prazo da inscrição: **05/10/2026**.

| Fase | Entrega                                     | Estado                                                                        |
| ---- | ------------------------------------------- | ----------------------------------------------------------------------------- |
| —    | Instalação e configuração (`TIME_13` §1–§2) | **feita** (falta só o Superpowers)                                            |
| 0    | Setup e limpeza do V.O.Z.E.S.               | **feita**                                                                     |
| 1    | Banco completo (6 migrations do `TIME_02`)  | **feita e aplicada** (+ a 0007 de correção)                                   |
| 2    | Auth do painel + colaboradores + PINs       | login, guard e menu por papel; falta a tela de colaboradores                  |
| 3    | Perguntas + importador                      | telas feitas; falta só a leitura de PDF                                       |
| 4    | Campanha + trilha + eventos                 | **feita** (ranking e resultados ficam nas fases 9 e 10)                       |
| 5    | App do colaborador                          | **feito**: entrar, PIN, termo, início, quiz, trilha, relatar, relatos, perfil |
| 6    | Relatos com foto + validação                | **feita**, com Edge Function e kanban                                         |
| 7    | Canal de Respeito                           | **feito**, com o anonimato travado por teste                                  |
| 8    | Modo TV (Clássico + check-in)               | não iniciada                                                                  |
| 9    | Ranking, selos, encerramento, certificados  | não iniciada                                                                  |
| 10   | Analytics, mapa de lacunas, relatório       | não iniciada                                                                  |
| 11   | Materiais, dados de demonstração, deploy    | seed de demonstração feito; resto não                                         |

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
- `.mcp.json` com o `project_ref` do projeto DEV. Só carrega ao reiniciar a sessão.
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
- `scripts/db-migrate.mjs` removido. As migrations vão por `npm run db:aplicar`
  (Management API), que registra na mesma tabela do CLI.

### Código do app e do painel

- `src/lib/sessao.ts`, `rpc.ts` (`rpcApp`/`rpcPublica`), `mensagens.ts` (24
  motivos) e `pin.ts`, conforme `TIME_03` §3 e `TIME_05` §9.
- Rotas: `/`, `/painel/login`, `/painel` (protegida), `/app/entrar`,
  `/app/novo-pin`, `/app/termo`, `/app/inicio`, `/app/quiz`.
- 51 testes de unidade em 4 arquivos, todos passando.

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

Item 7 da ordem: Modo TV Clássico e check-in (docs/TIME_06).

## Feito em 01/10/2026 — itens 3 a 6

**Item 3 — trilha e avaliação.** `/app/trilha` em caminho vertical e
`/app/trilha/$licaoId` com Markdown, vídeo do YouTube, "Terminei de estudar" e
avaliação corrigida pelo servidor. Navegação inferior de 5 itens.

**Item 4 — perfil, selos e extrato.** `/app/perfil` com a grade dos 10 selos, o
extrato agrupado por dia com origem traduzida (`src/lib/pontuacao.ts`) e os
certificados.

**Item 5 — relatos.** `/app/relatar` com foto comprimida para JPEG 1280px via
Edge Function, `/app/relatos`, `/app/local/$localId`, e `/painel/relatos` em
kanban com validação, gravidade, andamento e CSV. Edge Function
`relato-upload-url` extraída do TIME_03 §5, idêntica ao documento.

**Item 6 — Canal de Respeito.** `/respeito/$codigo` pública e anônima,
`/painel/respeito` só para o comitê. O anonimato está travado por teste de
código e por teste de fluxo.

### Guardas de contrato que nasceram aqui

- `src/lib/contratos.test.ts`: extrai as chaves do `jsonb_build_object` de cada
  RPC nas migrations e confere com o que as telas leem. Nasceu de um bug real.
- `src/lib/pontuacao.test.ts`: toda origem de `_lancar_pontos` tem texto.
- `src/lib/relatos.test.ts` e `respeito.test.ts`: categorias, status e
  gravidades conferidos contra os CHECK do schema.
- `src/lib/respeito.test.ts`: a página pública não pode conter `rpcApp`,
  `p_token`, `localStorage` nem analytics.

### Gates ao fim do bloco

lint 0 erros, tsc 0, **206 testes**, RLS 242, fluxo **137**. `verify` exit 0.

## Configuração do projeto (01/10/2026)

`npm run db:configurar` cobre o que não cabe em migration: bucket privado
`relatos-fotos` + policy de leitura pelo técnico (TIME_02 §4), cadastro público
desativado e redirect de `/painel/nova-senha` liberado (TIME_03 §8). Verificado
por comportamento: `signup` devolve 422 `signup_disabled` e o login do admin
segue 200. O gate de RLS subiu para 242 verificações, agora cobrindo Storage.

## Próximo

1. Item 7: Modo TV Clássico + check-in (TIME_06).
2. Item 8: ranking e encerramento (TIME_08 §6).
3. Item 9: analytics e MAPA DE LACUNAS (TIME_09 §1.2).
4. Itens 10 a 12: relatório de evidência, certificados e `/verificar`,
   materiais e deploy.
5. Pendências menores: leitura de PDF no importador (`pdfjs-dist`).

## Telas do painel: nenhuma falta (01/10/2026)

O menu lateral não tem mais item "em breve" — o galho que desenhava item sem
rota foi removido porque virou código morto. Entraram nesta rodada:

- `/painel/colaboradores` — lista com busca, filtro de setor e inativos,
  cadastro manual, importação CSV (`matricula;nome;setor;turno`, parser em
  `src/lib/colaboradores.ts`), desbloqueio de PIN e anonimização LGPD (só admin).
- `/painel/colaboradores/cartoes` — 8 cartões por folha A4, com PIN provisório.
  Os PINs chegam **em memória** (`src/lib/cartoes-pendentes.ts`): não passam por
  `sessionStorage` nem pela URL, e recarregar a página os perde de propósito,
  porque `tecnico_gerar_pins` devolve o PIN puro uma única vez.
- `/painel/setores` — setores com cor da paleta do TIME_10 e locais por setor,
  com etiqueta 10×7 cm em PNG (`html2canvas`) para colar na parede.
  `locais.setor_id` é `not null`: a tela exige setor e desabilita "Novo local"
  enquanto não houver um.
- `/painel/materiais` — cartaz "Entre no T.I.M.E." (A4 e 16:9) e cartaz do Canal
  de Respeito (A4) em PNG, com o QR da empresa. Tamanho em pixel fixo porque o
  `html2canvas` captura o que está na tela.
- `/painel/configuracoes` — nome e logo da empresa, código só leitura, editor do
  termo LGPD com "Publicar nova versão" (incrementa `termo_lgpd_versao`) e lista
  dos usuários do painel.

Bucket **`logos`** (público) e a policy `logos_admin_grava` nasceram aqui, por
`npm run db:configurar --aplicar`: escrita só do admin e só na pasta
`<empresa_id>/`. O `test:rls` passou a exigir que **toda** policy de escrita em
`storage.objects` se limite ao bucket `logos` — sem isso a policy nova afrouxaria
o bucket privado das fotos de relato. Três buracos abertos de propósito (policy
de escrita sem bucket, bucket privado, policy sem exigir admin) reprovaram o
gate e, ao fechar, ele voltou verde.

## Não verificado

As telas do painel **não foram vistas renderizadas**: o guard exige sessão, que
vive no `localStorage`, e não há navegador nesta sessão. O que está provado é
que compilam, que o guard redireciona as três rotas para `/painel/login`, e que
o caminho de gravação que o formulário usa funciona (`test:fluxo`: admin cria
pergunta 201, cipa recusada 403). Abrir `/painel/perguntas` logado é a
verificação que falta.

## Bloqueado (precisa do usuário)

- 🔴 **Rotacionar `SUPABASE_ACCESS_TOKEN`** (no `.env`, fora do git) e a chave
  `sb_secret_`: as duas foram expostas no chat e seguem válidas.
- **Trocar a senha provisória do admin** no primeiro acesso (`BOOTSTRAP_SENHA` no `.env`).
- **Superpowers**: `/plugin install superpowers@claude-plugins-official` — é
  plugin de origem remota e não entra por CLI.
- **Reiniciar a sessão** para o `.mcp.json` carregar o servidor `supabase`
  (opcional: os scripts `db:*` já cobrem o que o MCP faria).
- **Confirmar remoção de `drizzle-orm`**, órfão no `devDependencies`.

## Resolvido

- GitHub: remoto `projetovozescem/time-seguro` conectado, `main` publicada
  em 01/10/2026. `.env` e `.mcp.json` ficaram fora.
- Cadastro público do Supabase Auth: desativado por `npm run db:configurar`.
