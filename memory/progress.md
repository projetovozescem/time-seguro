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
5. Pendência única: o **deploy**. Decidido em 01/10/2026 "só preparar": o
   roteiro está em `docs/DEPLOY.md` e nada foi publicado.

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


## Dados de demonstração e checklist de segurança (01/10/2026)

`node scripts/seed-demo.mjs` cria a **Empresa Demonstração** (código `demo`) do
zero, em três partes: `seed-demo.sql` (4 setores, 8 locais, 30 colaboradores
fictícios, campanha ativa de 3 semanas, lição publicada, 14 relatos, 5 eventos,
95 check-ins, 2 denúncias), as 36 perguntas do `docs/TIME_12` pelo mesmo parser
do app, e `seed-demo-respostas.sql` (810 respostas, 270 dias de atividade,
~7.000 pontos). Rodar de novo apaga a empresa `demo` e recria — e não toca em
nenhuma outra empresa (conferido: o piloto ficou intacto).

O desenho é proposital: **Produção** acerta pouco em NR-12 (36–50%) e
**Expedição** acerta bem (~74–83%), para o print do mapa de lacunas dizer
alguma coisa. Pontuação só por `_lancar_pontos`, com o mesmo `origem_id` das
RPCs reais — o índice `pl_unico_colab` não tem `dia`, então quiz usa o id da
resposta e presença usa `md5(colaborador || dia)`.

`scripts/_bundle.mjs` nasceu aqui: o `seed-dev.mjs` importava `esbuild`, que
**não existe mais** no projeto (o Vite 7 traz `rolldown`). Os dois seeds agora
passam pelo helper, que tenta rolldown e depois esbuild e, falhando os dois, diz
o que instalar.

Checklist do `docs/TIME_03` §8 revisado:

| Item                                        | Prova                                        |
| ------------------------------------------- | -------------------------------------------- |
| Cadastro público desativado                 | `npm run db:configurar` (ok)                  |
| `anon` sem `select` em tabela nenhuma       | `npm run test:rls` (249)                      |
| Gabarito ausente antes de responder         | `contratos.test.ts` + `test:fluxo`            |
| `/respeito` sem token                       | `respeito.test.ts`                            |
| Bucket `relatos-fotos` privado              | `npm run db:configurar` (ok)                  |
| Service role só no servidor                 | `seguranca.test.ts` (novo)                    |
| Só `VITE_SUPABASE_URL` e `_ANON_KEY` no front | `seguranca.test.ts` (novo)                  |

Conferido também no build: `.output/public` tem a chave publishable (é pública
por natureza) e **não** tem o `SUPABASE_ACCESS_TOKEN`, a chave `sb_secret_` nem
a senha do admin.

## Leitura de PDF: ligada (01/10/2026)

`src/lib/importacao/pdf.ts` é o `pdfQuestions.js` do Max Games portado e tipado,
com 28 testes (os do legado mais os do T.I.M.E.): reconhece "Questão N", "1.",
"Q12", alternativas A–E em várias pontuações, gabarito no fim do documento,
negrito por fonte minoritária e marcadores `**`, `(correta)`, `✔`. Remove
cabeçalho e rodapé repetidos.

`pdfjs-dist` 6.3.289 instalado com sua autorização, em três camadas:

- `pdf-extrair.ts` — a única que conhece o pdf.js. Import dinâmico, e o worker
  vem do próprio pacote por `?url`. O build confirma a separação: a entrada
  principal tem 197 kB e **não** traz o pdfjs; os 431 kB da biblioteca e os
  1,26 MB do worker ficam em pedaços carregados sob demanda.
- `pdf-linhas.ts` — monta as linhas a partir dos pedaços de texto (pura, 10
  testes). Nasceu separada porque `?url` só existe dentro do Vite: com ela no
  mesmo arquivo, nenhum script Node consegue empacotar a lógica para testar.
- `pdf.ts` — reconhece as perguntas (28 testes).

Prova de ponta a ponta (não há navegador nesta sessão): um PDF gerado com jspdf
contendo duas questões e gabarito no fim foi lido pelo pdfjs (build legacy, que
roda no Node) e passou pelo parser — 14 linhas extraídas, 2 perguntas
reconhecidas, respostas B e A vindas do gabarito, tema do lote aplicado e a
seção "Gabarito" não virou pergunta. O script está no scratchpad da sessão.

Limite: 60 páginas por arquivo, e PDF escaneado (imagem, sem texto) é recusado
com uma mensagem que explica o motivo em vez de devolver zero perguntas em
silêncio.


## 02/10/2026 — PIN fixo, autocadastro, PWA real, Canal em grade, legenda

- **Banco:** 0008 (PIN fixo, único, auditado), 0009 (autocadastro), 0010 (fecha
  EXECUTE de funções novas). RLS 282, fluxo 223.
- **Painel:** aba Pendentes (aprovar/recusar, corrigir setor; aprovar abre o PIN
  na hora), botão PIN por pessoa (copiar PIN e "mensagem pronta"; reemitir só
  admin), "Imprimir cartões", domínios de e-mail em Configurações. CIPA agora
  abre "Colaboradores e setores" para aprovar cadastros, sem ver PIN.
- **App:** `/app/cadastro`, `/app` (raiz do PWA), login por `rpcPublica`
  (conserto de um bug antigo), sem troca de PIN.
- **PWA:** manifest, ícones e service worker do T.I.M.E. (ícones gerados por
  `scripts/gerar-icones.mjs`), escopo `/app`, botão de instalar ligado.
  Chrome: manifest sem erro, SW ativo, sem erros de instalabilidade.
- **Canal de Respeito:** cards em grade (detalhe abre em diálogo). **Analytics:**
  legenda em 4 cards com a contagem de células por faixa.
- **Testes:** `npm run test:e2e` (34) e `npm run test:pwa` abrem o Chrome de
  verdade; ficam FORA do `verify` porque precisam do servidor de dev.

### Pendente / não verificado
- **Envio do PIN por e-mail** (Resend + Edge Function): fica para depois.
- **Instalar num celular de verdade:** não dá para automatizar; conferir no
  aparelho (Android: menu > Instalar app; iOS: Compartilhar > Tela de Início).
- O registro do service worker só roda em produção (`import.meta.env.DEV`); no
  teste ele é registrado na mão.
- Textos novos de `mensagens.ts` (autocadastro/PIN) pendentes de revisão.
- Os PINs antigos deixaram de valer: **reimprimir os cartões** do piloto.

## 02/10/2026 — Painel simplificado (menu de 14 → 7) e deploy no Netlify

- **Netlify:** `netlify.toml` (preset netlify, publish `dist`). O primeiro deploy
  publicado em `timeseguro.netlify.app` saiu **sem** as `VITE_*` no bundle
  (conferido baixando o JS: a URL do Supabase não estava lá) → login dava "Não
  foi possível entrar agora". Correção do usuário: redeploy com "Clear cache"
  depois de cadastrar as variáveis com escopo Builds.
- **Menu em seções** (`src/components/layout/secoes.ts` + `AbasDaSecao.tsx`):
  Início, Pessoas, Campanhas (Campanhas·Perguntas·Eventos·Ranking·Certificados),
  Relatos (Relatos·Canal), Resultados (Painel·Relatórios·Materiais), Modo TV,
  Configurações. URLs iguais: link salvo continua valendo.
- **Menos detalhe:** sem parágrafos de instrução sob os títulos; exportar,
  importar e ações raras num "⋯" (`src/components/painel/MaisOpcoes.tsx`); lista
  de pessoas com Nome (matrícula embaixo), Setor, Situação, PIN e "⋯" (sem Turno).
- **Gates:** `npm run verify` exit 0 (466 testes, RLS 282, fluxo 223);
  `npm run test:e2e` todo ok; conferência no Chrome: 7 itens no menu do admin,
  `/painel/ranking` abre com a aba Ranking ativa, `/painel/campanhas/<id>` mantém
  a aba Campanhas, 420 px sem rolagem horizontal. Filtro por papel coberto em
  `secoes.test.ts` (CIPA e técnico não conferidos no navegador: só admin tem
  senha no `.env`).

## Enerpeixe + campanha NR-1 + material com QR + TV em tela cheia (02/10/2026)

- **Dados:** a empresa `piloto` virou **Enerpeixe S.A. (Usina Hidrelétrica)**, código
  `enerpeixe` (mesmo id e mesmos `perfis_tecnicos`: o login do admin continua). A `demo`
  foi apagada. Tudo recriado por `node scripts/seed-enerpeixe.mjs` (idempotente):
  6 setores, 12 locais, 36 colaboradores (matrículas 2001–2036), tema `nr1`, 30 perguntas
  (`scripts/perguntas-nr1.txt`), campanha ativa "Foco Total na NR-1" (28/09 a 27/10/2026,
  6 lições), campanha encerrada e vazia "Violência contra a mulher" (21 a 25/09/2026),
  4 eventos, 10 relatos, respostas, trilha e pontos (só por `_lancar_pontos`).
- **Migration 0011** `materiais` + RPC pública `material_publico`. Página pública
  `/m/<empresa>/<slug>` (destino do QR) e cartaz A4 em Resultados → Materiais, os dois
  lendo o mesmo conteúdo do banco (`src/lib/materiais.ts`).
- **Modo TV:** fora do layout do painel; `CascaTv` com escala por resolução
  (`src/lib/escalaTv.ts`, base 1280×720, `font-size` da raiz), botão "Tela cheia"/"Sair da
  tela cheia" sincronizado pelo evento `fullscreenchange` (Esc também).
- Scripts de teste (`teste-fluxo`, `verificar-no-navegador`, `verificar-pwa`) agora usam
  `enerpeixe`. O e2e cria e apaga as próprias denúncias de teste.
- O arquivo de credenciais `env` foi renomeado para `.env`; `env` entrou no `.gitignore`.
- Pendente: fotos antigas de relatos no bucket `relatos-fotos` ficaram (sem dono no banco).
  Reimprimir cartões de acesso: os PINs da Enerpeixe são novos.

## Ajustes de painel (02/10/2026)

- "Pessoas" virou **Colaboradores** (menu, aba e título); o gráfico "Pessoas ativas por dia" ficou.
- Cards de Campanhas com `border-t-4` na cor do primeiro tema (`useCoresDasCampanhas`).
- `scripts/seed-enerpeixe-extras.sql` (rodado também pelo `seed-enerpeixe.mjs`): cadastro
  pendente **Max Eldon Martins** (matrícula 2037, max.eldon@gmail.com, Administrativo) e **10
  denúncias** de exemplo `RESP-ENER-0001…0010` (moral, sexual, discriminação, convívio/respeito;
  senha de acompanhamento `demo123`). `max.eldon@gmail.com` já era admin + comitê: nada a habilitar.
- Modo TV: só entra em tela cheia pelo botão; ao sair da TV (histórico, menu) o `PainelLayout`
  sai da tela cheia.
- O e2e aprovava o PRIMEIRO pendente da fila e aprovou o cadastro do Max: agora aprova só o
  pedido do próprio teste. O Max foi devolvido a pendente.
- (02/10/2026, depois) Modo TV volta a abrir **dentro do layout** (menu à esquerda), no tamanho
  normal do site. Só o botão "Tela cheia" esconde menu/cabeçalho (`PainelLayout` com
  `useTelaCheia`) e liga a escala por resolução; "Sair da tela cheia" ou Esc volta ao layout.
