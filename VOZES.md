# Plataforma V.O.Z.E.S.

## Documento de referência — v4 (estado atual implementado)

---

## Registro de mudanças desde o prompt original (v2)

Este documento nasceu como o prompt de geração no Lovable. O projeto evoluiu
bastante desde então, em cinco frentes:

1. **Etapa 4 (painel completo do professor)** — `/dashboard`, `/calendario`,
   `/materiais`, `/pontuacao` e `/analytics` saíram de telas em preparação para
   implementações completas.
2. **Perguntas diárias do celular reformuladas** — de "1 pergunta por dia,
   sempre, +1 ponto, limite de 10 respostas" para 5 perguntas por dia em 6 dias
   específicos da campanha e, mais recentemente, para o modelo atual: **todas
   as perguntas ativas, num único dia da campanha, 10 pontos por acerto**
   (ver item 5).
3. **Ajustes pós-teste em sala** — Quiz TV virou jogo único por turma, o app
   do aluno ganhou abertura animada, instalação como PWA e tela de
   encerramento, e os materiais impressos passaram de PDF para PNG.
4. **Segurança de pontuação e identidade por aparelho** — antes, qualquer
   cliente com a chave publishable do Supabase podia escrever pontuação
   arbitrária direto nas tabelas. A migração `participantes_e_pontuacao_segura`
   introduziu a tabela `participantes` (papel **líder/aluno/excedente** por
   aparelho, sem login, até 10 aparelhos por turma) e moveu **toda** escrita de
   pontuação para funções `SECURITY DEFINER` no banco — o cliente perdeu
   `INSERT`/`UPDATE`/`DELETE` direto nas tabelas de fatos e nas colunas de
   pontuação de `turmas` (ver seções "Participantes" e "Supabase RPC
   Functions").
5. **Campanha concentrada em um único dia** — o calendário de perguntas
   diárias deixou de ter 6 dias fixos (16 a 23/09) e passou a valer só para
   **hoje da campanha** (atualmente `2026-09-29`); nesse dia, o líder da turma
   responde **todas** as perguntas ativas de uma vez, sem o limite de 5. A
   tela de encerramento do aluno passou a aparecer a partir do dia seguinte.

As seções abaixo descrevem o **estado atual** do sistema, não mais o prompt
original — onde algo mudou, o texto já reflete a implementação real. Nenhuma
menção institucional além de "CEM de Gurupi" aparece em nenhuma tela, material
ou registro do banco.

---

## Visão Geral

**V.O.Z.E.S.** (Valorização, Orientação e Zelo pela Existência das Mulheres) é
uma plataforma educativa de campanha contra a violência contra a mulher,
voltada para alunos e professores do Ensino Médio do CEM de Gurupi.

Identidade visual:

- Cor primária: roxo (`#7030A0`)
- Cor secundária: roxo claro (`#EAD1F7`)
- Cor de destaque: roxo médio (`#9B59B6`)
- Cor de fundo geral: lavanda suave (`#F9F4FD`)
- Ícone/símbolo da marca: coração roxo 💜 (títulos, botões, ícone do PWA)
- Tipografia: **Outfit** nos títulos (geométrica, jovem, marcante) e
  **Figtree** no corpo do texto (muito legível em celular e na TV)
- Visual jovem, acolhedor e educativo
- Border-radius arredondado (12–16px) em cards e botões

Stack real: **TanStack Start (React + TypeScript) + Tailwind CSS v4 + Supabase
(Lovable Cloud) + shadcn/ui**, com roteamento por arquivo em `src/routes/`
(não React Router tradicional).

Bibliotecas em uso:

- `qrcode.react` — geração de QR Codes
- `html2canvas` — captura de tela para os materiais em PNG e para o relatório
  de Analytics em PDF
- `jspdf` — geração do relatório de Analytics em PDF (o folder da campanha
  deixou de usar PDF; ver seção Materiais)
- `recharts` — gráficos do dashboard e do Analytics
- `date-fns` com locale `pt-BR` — datas e calendário
- `canvas-confetti` — confete no resultado do Quiz TV e na tela de
  encerramento do aluno

---

## Responsividade — Regra Global

| Perfil        | Desktop (>1024px)                  | Tablet (768-1024px)                | Mobile (<768px)                            |
| ------------- | ---------------------------------- | ---------------------------------- | ------------------------------------------ |
| **Professor** | ✅ Layout completo com sidebar     | ✅ Sidebar colapsável              | ✅ Menu hambúrguer, layout empilhado       |
| **Aluno**     | ❌ Redirecionar para layout mobile | ❌ Redirecionar para layout mobile | ✅ Único layout disponível                 |
| **Quiz TV**   | ✅ Fullscreen otimizado            | ✅ Fullscreen otimizado            | ❌ Exibir aviso "Use uma TV ou computador" |

> **Regra:** As rotas `/aluno/*` sempre renderizam o layout mobile (máx. 480px,
> centralizado), independente do tamanho da tela.

> **Regra:** A rota `/quiz-tv` tenta entrar em tela cheia automaticamente (com
> botão manual de reserva, já que navegadores só concedem fullscreen a partir
> de um gesto do usuário) e exibe aviso abaixo de **768px** de largura.

> **Regra:** As rotas do professor são responsivas — desktop com sidebar,
> mobile com menu hambúrguer.

---

## Tipos de Usuário

### 1. Professor (login no site — desktop e mobile)

- Login com senha única compartilhada: `V.O.Z.E.S`
- Sem cadastro individual — todos os professores usam a mesma senha
- Acesso ao painel administrativo completo
- Pode acessar todas as rotas exceto `/aluno/*`

### 2. Aluno (acesso via QR Code — mobile only, instalável como app)

- Sem login tradicional — acesso exclusivo por QR Code da turma
- Interface 100% mobile first
- Sem acesso ao painel administrativo
- Não visualiza pontuação nem ranking (oculto até o encerramento da campanha)
- Pode **instalar o app na tela inicial do celular** (PWA) — ver seção própria
- A partir do dia seguinte ao fim da janela de perguntas, o app mostra uma
  tela de encerramento em vez do quiz

#### Identidade por aparelho ("participante")

Não existe cadastro de aluno — cada celular que abre `/aluno/:turmaId` recebe
um id anônimo (`crypto.randomUUID()`, guardado em `localStorage`) e o servidor
decide o papel desse aparelho **dentro daquela turma**, via a função
`registrar_participante`:

| Papel       | Quem é                      | O que pode fazer                                     |
| ----------- | --------------------------- | ---------------------------------------------------- |
| `lider`     | 1º aparelho a abrir a turma | Responde o quiz diário (`/quiz`) e pode compartilhar |
| `aluno`     | do 2º ao 10º aparelho       | Só compartilha (`/compartilhar`) — não acessa o quiz |
| `excedente` | a partir do 11º aparelho    | Navega normalmente, mas nada do que fizer pontua     |

Um índice único (`participantes_um_lider`) garante um único líder por turma
mesmo se dois aparelhos abrirem no mesmo instante — a corrida é resolvida no
banco, não no cliente. O professor pode "devolver" a vaga de líder de uma
turma pelo painel (função `liberar_lider`), por exemplo se o celular do líder
original for perdido ou trocado.

---

## Proteção de Rotas

```javascript
// Guard: rotas do professor exigem autenticação
const isProfessor = localStorage.getItem("vozes_auth") === "professor";

// Rotas protegidas (só professor):
// /dashboard, /turmas, /perguntas, /quiz-tv, /calendario, /materiais, /pontuacao, /analytics
// Se !isProfessor → redirecionar para /

// Rotas públicas (aluno via QR Code):
// /aluno                         → start_url do PWA; redireciona para a última turma escaneada
// /aluno/:turmaId                → valida turmaId no banco; se não existir → "Turma não encontrada"
// /aluno/:turmaId/quiz
// /aluno/:turmaId/compartilhar

// Rota / (login):
// Se já autenticado como professor → redirecionar para /dashboard
```

---

## Autenticação

```javascript
const PROFESSOR_PASSWORD = "V.O.Z.E.S";

if (inputPassword === PROFESSOR_PASSWORD) {
  localStorage.setItem("vozes_auth", "professor");
  navigate("/dashboard");
} else {
  exibirErro("Senha incorreta. Tente novamente.");
}

const logout = () => {
  localStorage.removeItem("vozes_auth");
  navigate("/");
};
```

> Não usa Supabase Auth. Autenticação apenas frontend com `localStorage`. A
> senha fica visível a quem inspecionar a página — aceitável para o escopo da
> campanha.

---

## Banco de Dados (Supabase / Lovable Cloud)

O schema **não mudou** desde a criação do projeto — nenhuma tabela ou coluna
nova foi necessária para as mudanças recentes. As tabelas seguem exatamente
como criadas na primeira migração:

```sql
CREATE TABLE turmas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  serie TEXT NOT NULL,
  qr_code_url TEXT,
  quantidade_alunos INTEGER DEFAULT 0,
  pontuacao_qrcode INTEGER DEFAULT 0,
  pontuacao_quiz_tv INTEGER DEFAULT 0,
  pontuacao_compartilhamento INTEGER DEFAULT 0,
  status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'inativa')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE perguntas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  enunciado TEXT NOT NULL,
  alternativa_a TEXT NOT NULL,
  alternativa_b TEXT NOT NULL,
  alternativa_c TEXT NOT NULL,
  alternativa_d TEXT NOT NULL,
  resposta_correta CHAR(1) NOT NULL CHECK (resposta_correta IN ('A', 'B', 'C', 'D')),
  status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'inativa')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Respostas das perguntas diárias (celular do líder da turma)
CREATE TABLE respostas_alunos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  turma_id UUID REFERENCES turmas(id) ON DELETE CASCADE,
  pergunta_id UUID REFERENCES perguntas(id) ON DELETE CASCADE,
  alternativa_escolhida CHAR(1) NOT NULL,
  acertou BOOLEAN NOT NULL,
  tempo_resposta_ms INTEGER DEFAULT 0,
  dispositivo TEXT DEFAULT 'mobile',
  data DATE DEFAULT CURRENT_DATE,   -- gravado explicitamente como o "dia do jogo" (ver Perguntas Diárias)
  hora TIME DEFAULT CURRENT_TIME,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quiz_tv (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  turma_id UUID REFERENCES turmas(id) ON DELETE CASCADE,
  total_perguntas INTEGER NOT NULL DEFAULT 15,
  acertos INTEGER NOT NULL DEFAULT 0,
  erros INTEGER NOT NULL DEFAULT 0,
  pontuacao INTEGER NOT NULL DEFAULT 0,
  tempo_total_ms INTEGER DEFAULT 0,
  data DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quiz_tv_respostas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_tv_id UUID REFERENCES quiz_tv(id) ON DELETE CASCADE,
  turma_id UUID REFERENCES turmas(id) ON DELETE CASCADE,
  pergunta_id UUID REFERENCES perguntas(id) ON DELETE CASCADE,
  alternativa_escolhida CHAR(1) NOT NULL,
  acertou BOOLEAN NOT NULL,
  tempo_resposta_ms INTEGER DEFAULT 0,
  ordem INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE compartilhamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  turma_id UUID REFERENCES turmas(id) ON DELETE CASCADE,
  plataforma TEXT DEFAULT 'desconhecida',
  data DATE DEFAULT CURRENT_DATE,
  hora TIME DEFAULT CURRENT_TIME,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE acessos_qrcode (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  turma_id UUID REFERENCES turmas(id) ON DELETE CASCADE,
  acao TEXT NOT NULL CHECK (acao IN ('acesso', 'quiz', 'compartilhamento')),
  pontuou BOOLEAN DEFAULT false,
  dispositivo TEXT DEFAULT 'mobile',
  data DATE DEFAULT CURRENT_DATE,
  hora TIME DEFAULT CURRENT_TIME,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE eventos_calendario (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  data DATE NOT NULL,
  horario TEXT,
  descricao TEXT,
  tipo TEXT DEFAULT 'geral' CHECK (tipo IN ('palestra', 'cartaz', 'quiz', 'encerramento', 'geral')),
  turma_id UUID REFERENCES turmas(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'concluido', 'cancelado')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Identidade por aparelho, sem login (ver "Identidade por aparelho" acima)
CREATE TABLE participantes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  dispositivo_id TEXT NOT NULL,
  papel TEXT NOT NULL DEFAULT 'aluno' CHECK (papel IN ('lider', 'aluno')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (turma_id, dispositivo_id)
);
-- Só 1 líder por turma, garantido pelo banco:
CREATE UNIQUE INDEX participantes_um_lider ON participantes (turma_id) WHERE papel = 'lider';
```

`respostas_alunos` e `compartilhamentos` ganharam a coluna `dispositivo_id
TEXT`, usada para saber qual aparelho respondeu ou compartilhou. Três índices
únicos fecham a dupla contagem no próprio banco:

- `respostas_alunos (turma_id, pergunta_id, data)` — uma turma não responde a
  mesma pergunta duas vezes no mesmo dia.
- `compartilhamentos (turma_id, dispositivo_id, data)` — um ponto de
  compartilhamento por aparelho por dia.
- `quiz_tv (turma_id)` — uma única sessão de Quiz TV por turma, para sempre.

RLS está habilitado em todas as tabelas. A leitura pública continua liberada
para `anon`/`authenticated` (o painel de Analytics e as telas do aluno leem
direto), mas a **escrita nas tabelas de fatos e nas colunas de pontuação de
`turmas` não é mais feita pelo cliente** — só as funções `SECURITY DEFINER`
listadas em "Supabase RPC Functions" escrevem nesses lugares. O cliente mantém
apenas `UPDATE` nas colunas não sensíveis de `turmas` (`nome`, `serie`,
`quantidade_alunos`, `status`, `qr_code_url`), para o CRUD de turmas do
professor continuar funcionando sem RPC.

### Migrações aplicadas (`supabase/migrations/` e `drizzle/migrations/`)

| Arquivo                                                    | Conteúdo                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260910185602_..._..._....sql`                           | Schema completo (todas as tabelas + GRANTs + RLS), as 4 funções RPC iniciais, seed de 9 turmas, 15 perguntas e 13 eventos do calendário                                                                                                                                                                              |
| `20260910185622_..._..._....sql`                           | Recriação das 4 funções RPC iniciais com `SECURITY INVOKER` (ajuste de segurança)                                                                                                                                                                                                                                    |
| `20260911144613_perguntas_sinal_vermelho_e_calendario.sql` | +8 perguntas da cartilha "Sinal Vermelho"; ajusta os eventos de "Perguntas diárias ativas" para as novas datas                                                                                                                                                                                                       |
| `20260911185139_padronizar_descricao_quiz_tv.sql`          | Remove a menção institucional das descrições dos eventos de Quiz TV                                                                                                                                                                                                                                                  |
| `20260912155336_participantes_e_pontuacao_segura.sql`      | Cria `participantes` + índices únicos anti-dupla-contagem; cria as 8 funções `SECURITY DEFINER` da seção "Supabase RPC Functions"; revoga escrita direta do cliente nas tabelas de fatos e nas colunas de pontuação de `turmas`; remove `incrementar_pontuacao_qrcode` (substituída por `responder_pergunta_diaria`) |
| `drizzle/migrations/0001_campanha_dia_unico.sql`           | Restringe `dia_de_campanha(dia)` a um único dia (hoje, `2026-09-29`), fechando a campanha original de 6 dias                                                                                                                                                                                                         |

> `incrementar_pontuacao_compartilhamento`, `incrementar_pontuacao_quiz_tv` e
> `taxa_acerto_por_pergunta` continuam existindo no banco (não foram
> removidas), mas **não são chamadas por nenhum código atual** — e, como
> perderam acesso de escrita às colunas de pontuação de `turmas`, chamá-las
> manualmente hoje falharia. São legado morto, mantido por histórico.

### Estado atual (referência)

9 turmas · 23 perguntas ativas · pontuações da campanha concentradas em
`2026-09-29` (ver `.lovable/plan/` para o plano exato de dados de
demonstração).

---

## Fórmulas de Cálculo de Pontuação

Todas as três fontes abaixo são calculadas e gravadas **pelo servidor**
(funções `SECURITY DEFINER`) — o cliente só informa o que o aluno tocou, nunca
escreve pontuação diretamente. Ver "Supabase RPC Functions".

```javascript
// PONTUAÇÃO TOTAL de uma turma = soma de 3 fontes
const pontuacaoTotal =
  turma.pontuacao_qrcode + turma.pontuacao_quiz_tv + turma.pontuacao_compartilhamento;

// PONTUAÇÃO VIA PERGUNTAS DIÁRIAS (celular do líder da turma)
// Só existe pergunta disponível no(s) dia(s) de campanha (hoje, apenas
// 2026-09-29 — ver DIAS_QUIZ_MOBILE / dia_de_campanha()). Nesse dia, o líder
// responde TODAS as perguntas ativas (sem limite de 5), cada uma uma única
// vez por turma. +10 pontos por acerto, via RPC responder_pergunta_diaria
// (o servidor confere o gabarito e grava — o cliente não decide se acertou).
// Erros não pontuam. Fora do(s) dia(s) de campanha, não há pergunta disponível.
// As perguntas do dia expiram às 6h da manhã seguinte, não à meia-noite —
// ver "Perguntas Diárias" na seção do aluno para o detalhe da janela de tempo.

// PONTUAÇÃO VIA QUIZ TV
// Cada turma joga o Quiz TV uma ÚNICA VEZ durante toda a campanha (garantido
// por índice único no banco, não só pela UI).
// Ao salvar (RPC salvar_quiz_tv): o servidor recalcula os acertos comparando
// cada resposta enviada ao gabarito das perguntas — não confia no que o
// cliente diz ter acertado. pontuacao = acertos × 10 (de 0 a 150, sobre 15
// perguntas), somada a pontuacao_quiz_tv da turma numa única transação.
// Depois de jogar, a turma some da lista de turmas disponíveis na tela de
// seleção do Quiz TV (fica visível, desabilitada, com o selo "✓ Jogou em
// DD/MM · N pts").

// PONTUAÇÃO VIA COMPARTILHAMENTO
// +1 ponto por clique em "Compartilhar" (Web Share API ou cópia de link), via
// RPC registrar_compartilhamento. Limite de 1 por aparelho por dia (índice
// único no banco) — e só aparelhos já registrados como participante da turma
// (líder ou aluno) podem pontuar.
```

---

## Rotas da Aplicação

```
/                              → Tela de login (professores)
/dashboard                     → Painel do professor (protegido)
/turmas                        → Gestão de turmas (protegido)
/perguntas                     → Banco de perguntas (protegido)
/quiz-tv                       → Modo TV interativa — fullscreen (protegido)
/calendario                    → Calendário da campanha (protegido)
/materiais                     → Materiais da campanha (protegido)
/pontuacao                     → Ranking e histórico (protegido)
/analytics                     → Painel de análise completa de dados (protegido)

/aluno                         → start_url do PWA (público) — redireciona para a turma lembrada
/aluno/:turmaId                → Home do aluno (público — valida turmaId)
/aluno/:turmaId/quiz           → Perguntas diárias do celular (público)
/aluno/:turmaId/compartilhar   → Compartilhamento do banner (público)
```

---

## Telas — Área do Professor

### Login (`/`)

- Fundo lavanda suave com padrão sutil de corações
- Card centralizado com sombra, logo V.O.Z.E.S. no topo
- Campo de senha, botão "Entrar na campanha 💜"
- Rodapé: "CEM de Gurupi · Campanha 2026"
- Já autenticado → redireciona para `/dashboard`

### Sidebar (desktop) / Menu hambúrguer (mobile)

📊 Dashboard · 🏫 Turmas · ❓ Perguntas · 📺 Quiz TV · 📅 Calendário · 📁
Materiais · 🏆 Pontuação · 📈 Analytics · 🚪 Sair

### Dashboard (`/dashboard`)

**Cards de resumo:**

- 🏫 Turmas cadastradas · 👥 Acessos via QR Code · 📊 Participação geral (%
  de turmas com ≥1 resposta) · 📅 Próximo evento do calendário

**Ranking das turmas** (top da página): posição com medalha, nome, pontos por
fonte (QR Code / Quiz TV / Compartilhamento) e total — ordenado
decrescente, linha líder destacada.

**Últimos quizzes TV realizados** — 5 mais recentes, com turma, data,
acertos/total e pontuação.

**Evolução dos últimos 7 dias** — gráfico de linha (recharts) com o total de
respostas por dia, incluindo dias sem nenhuma.

**Resumo de Analytics** — 6 cards: acertos, erros, taxa de acerto geral,
pergunta mais acertada, pergunta mais errada e horário de pico.

### Turmas (`/turmas`)

Cards responsivos com nome, série, quantidade de alunos, pontuação total e
status (ativa/inativa). Modal "Nova turma" gera o QR Code automaticamente
(`{domínio}/aluno/{turmaId}`). Modal "Ver QR Code" com baixar PNG, copiar link
e imprimir.

**Turmas semeadas:** 1401, 1402, 1403 (1º ano) · 2401, 2402, 2403 (2º ano) ·
3401, 3402, 3901 (3º ano).

### Perguntas (`/perguntas`)

Lista expansível com enunciado, status (ativa/inativa), 4 alternativas
(correta destacada), CRUD completo. Contador "X perguntas cadastradas (Y
ativas)". Banco atual: **23 perguntas** (15 do conjunto inicial + 8 da
cartilha "Sinal Vermelho contra a Violência Doméstica").

### Quiz TV (`/quiz-tv`)

> ⚠️ Cada turma joga o Quiz TV **uma única vez durante toda a campanha.**

**Comportamento geral:**

- Tenta `document.documentElement.requestFullscreen()` ao montar; como
  navegadores só concedem isso a partir de um gesto do usuário, há um botão
  manual "⛶ Tela cheia" de reserva, junto com "✕ Sair do modo TV"
- Abaixo de 768px de largura: aviso "Este modo é otimizado para TVs e
  projetores. Use um computador conectado à TV."
- Fundo: gradiente roxo escuro (`#1A0A2E` → `#2D1B4E`)

**TELA 1 — Seleção de turma (dois passos):**

- "💜 VOZES — Quiz Interativo" / "Selecione a turma que vai jogar"
- Grid de cards. Turma **ainda não jogada**: clicável, fica com borda/realce
  ao selecionar. Turma **já jogada**: card acinzentado, sem clique, com o selo
  `✓ Jogou em DD/MM · N pts`
- Botão "▶ Iniciar Quiz" aparece só depois de selecionar uma turma disponível
- Se todas as turmas já jogaram: "🏆 Todas as turmas já jogaram o Quiz TV.
  Desafio concluído!"
- Um guard interno bloqueia o início mesmo que dois computadores tentem abrir
  a mesma turma ao mesmo tempo

**TELA 2 — Quiz (15 perguntas sorteadas entre as ativas):**

- Barra de progresso no topo, indicador "Pergunta N de 15"
- Grid 2×2 de alternativas, letra em círculo roxo
- Fluxo por pergunta: clique → destaque → 1s → revelação verde/vermelho
  (demais opacidade 0.3) → 2s → próxima
- Se houver menos de 15 perguntas ativas, usa todas as disponíveis com aviso

**TELA 3 — Resultado:**

- Confete roxo/dourado, acertos/erros/pontuação, barra visual de acerto
- Botão "💾 Salvar pontuação" → chama a RPC `salvar_quiz_tv`, que recalcula os
  acertos pelo gabarito das perguntas (não confia no que o cliente enviou),
  grava a sessão e cada resposta detalhada, e soma `pontuacao_quiz_tv` da
  turma **numa única transação** no banco; o cliente então cria um evento no
  calendário (`📺 Quiz TV — Turma X`, na data de hoje, com o resumo do
  resultado na descrição) — esse registro no calendário é best-effort: se
  falhar, avisa mas não desfaz a pontuação, que já está salva
- Botões "Outra turma" e "Sair" — **não há mais "Jogar novamente"**

### Calendário (`/calendario`)

Grade mensal (`date-fns`, locale pt-BR), navegação por mês, eventos coloridos
por tipo:

- 🎤 Roxo escuro: palestra · 📌 Laranja: cartaz/QR Code · 🎮 Verde: quiz ·
  🏆 Dourado: encerramento

Clicar no dia lista os eventos; CRUD completo (título, data, horário,
descrição, tipo, turma relacionada). Eventos do Quiz TV são criados
automaticamente ao salvar uma sessão (ver seção Quiz TV acima).

> Os eventos do calendário já passaram por duas fases: originalmente
> espalhados entre 17/08 e 25/09 (conscientização em sala, instalação de
> banners, 6 dias de perguntas diárias, sessões de Quiz TV por turma e
> encerramento em 25/09). Com a campanha concentrada em um único dia (ver
> registro de mudanças), os eventos de quiz/perguntas/encerramento foram
> reagendados para a data corrente da campanha (hoje, `2026-09-29`, com
> encerramento em `2026-09-30`). O calendário é dado vivo no banco — consulte
> `/calendario` no painel para a lista exata em vigor.

### Materiais da Campanha (`/materiais`)

> O folder em PDF foi **substituído por dois materiais em PNG**, com visual
> mais atraente (badges, ícones, gradiente roxo) — sem PDF nesta tela.

**1. Card 16:9** (1920×1080, paisagem) — para compartilhar em redes sociais,
projetar na TV ou imprimir em paisagem:

- Bloco de marca (selo "CAMPANHA 2026", logo V.O.Z.E.S., subtítulo)
- 3 passos ilustrados com emoji em badge circular: 📷 Escaneie · 💬 Responda ·
  🏆 Pontue
- Selo `#VozesQueProtegem` em degradê dourado
- Cartão branco com o QR Code da turma e badge "TURMA {nome}"
- Rodapé: "CEM de Gurupi · Campanha 2026" + telefones 180/190

**2. Cartaz A4** (1240×1754, retrato) — para imprimir e colar nos murais: o
mesmo conteúdo do card 16:9, reorganizado em coluna única para o formato
retrato.

Botões em cada aba: "Baixar PNG" e "Imprimir" (captura via `html2canvas` →
`canvas.toDataURL("image/png")`).

**3. QR Code avulso** — inalterado: dropdown de turma, QR Code 400×400px,
baixar PNG / copiar link / imprimir.

### Pontuação (`/pontuacao`)

Tabela de ranking ordenável por qualquer coluna (nome, QR Code, Quiz TV,
Compartilhamento, Total), medalhas 🥇🥈🥉 sempre pela pontuação total
(mesmo ordenando por outra coluna), linha líder destacada. Visível só para
professores. Abaixo, histórico completo dos quizzes TV (turma, data, acertos,
erros, pontuação).

### Analytics (`/analytics`)

Painel completo, alimentado pelo hook `useAnalytics` (`src/hooks/useAnalytics.ts`),
que combina `respostas_alunos` e `quiz_tv_respostas` em memória (sem depender
de RPC) para todas as métricas abaixo:

- **Cards de visão geral**: tentativas, acertos, erros, taxa de acerto geral
- **Desempenho por turma** (tabela expansível, ordenável, com gráfico de
  evolução diária ao expandir) + exportar CSV
- **Desempenho por pergunta** (mais difíceis primeiro, badge verde/amarelo/
  vermelho por taxa de acerto, alternativa errada mais escolhida) + CSV
- **Evolução temporal** (filtro por turma, toggle quantidade/taxa de acerto)
- **Horário de pico** (gráfico de barras por faixa de horário, 7h–22h)
- **Funil de engajamento** (acesso → resposta → acerto → compartilhamento,
  com taxa de conversão entre etapas)
- **Quiz TV — análise das sessões** (expansível, pergunta a pergunta, tempo
  médio/mais rápida/mais lenta)
- **Comparativo entre fontes de pontuação** (QR Code vs Quiz TV vs
  Compartilhamento, por turma)
- **Exportação**: "Exportar relatório PDF" (captura o painel inteiro com
  `html2canvas` + `jsPDF`, paginando conforme a altura) e "Exportar CSV
  completo" (uma seção por tabela de fatos, com BOM UTF-8 para abrir
  corretamente no Excel)

Todas as seções têm estado vazio próprio para quando ainda não há dados.

---

## Perguntas Diárias — Área do Aluno (celular do líder da turma)

> Só o celular do líder da turma responde às perguntas diárias — não é um
> fluxo de múltiplos alunos respondendo ao mesmo tempo. Os demais aparelhos da
> turma (papel `aluno`) só têm acesso à tela de compartilhar.

### Janela de dias ativos — agora um único dia

```javascript
// src/lib/vozes.ts
// Campanha concentrada em um único dia (hoje) — já foram 6 dias fixos no
// passado (16 a 23/09); precisa espelhar dia_de_campanha() no banco.
export const DIAS_QUIZ_MOBILE = ["2026-09-29"];

// Sem limite: o líder responde TODAS as perguntas ativas nesse dia (antes
// era limitado a 5 por dia).
export const PERGUNTAS_POR_DIA_MOBILE = Number.POSITIVE_INFINITY;

export const PONTOS_POR_ACERTO_MOBILE = 10;
export const LIMITE_PARTICIPANTES_TURMA = 10; // 1 líder + até 9 alunos
```

Fora do(s) dia(s) de campanha, `/aluno/:turmaId/quiz` mostra "Hoje não tem
pergunta 💜 — as perguntas diárias acontecem em dias específicos da
campanha."

### "Dia do jogo" — expira às 6h, não à meia-noite

```javascript
// As perguntas de um dia continuam válidas até as 6h da manhã seguinte.
// Entre 00h e 06h, o "dia do jogo" ainda é o dia anterior.
export function diaDoJogoISO() {
  const agora = new Date();
  agora.setHours(agora.getHours() - 6);
  const fuso = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
  return fuso.toISOString().slice(0, 10);
}
```

Toda gravação em `respostas_alunos` e `acessos_qrcode` usa `dia_do_jogo()`
calculado **no servidor**, dentro das funções `SECURITY DEFINER` (em vez do
`DEFAULT CURRENT_DATE` do banco ou de uma data enviada pelo cliente), para o
agrupamento por dia no Analytics ficar coerente mesmo em respostas dadas de
madrugada — e para que o cliente não possa forjar a data e furar os limites
diários.

### Seleção (e ordem) das perguntas do dia — determinística por turma

```javascript
// Cada turma tem sua própria ordem das perguntas no dia — não é a mesma
// para todas as turmas. Recarregar a página no mesmo dia mostra as mesmas
// perguntas, na mesma ordem (semente = hash de turmaId + diaDoJogoISO(),
// embaralhamento com PRNG seedado, não Math.random()). Como
// PERGUNTAS_POR_DIA_MOBILE é infinito, a função devolve todas as perguntas
// ativas embaralhadas, sem cortar a lista.
const perguntasHoje = perguntasDoDia(perguntasAtivas, turmaId, diaDoJogoISO());
```

### Fluxo do quiz

1. Ao abrir `/aluno/:turmaId`, o aparelho já foi registrado como participante
   (`registrar_participante`) — se o papel não for `lider`, a tela de quiz
   nem aparece (ver "Identidade por aparelho").
2. Mostra "Pergunta N de {total de perguntas ativas}" com o enunciado e as 4
   alternativas (antes o total era fixo em 5; agora é o total real de
   perguntas ativas, hoje 23)
3. Ao tocar: destaque → revelação (verde ✅ / vermelho ❌) → "Parabéns! +10
   pontos para sua turma! 🎉" ou a resposta certa, se errou — a decisão de
   acerto vem da RPC `responder_pergunta_diaria`, nunca do cliente
4. A RPC grava `respostas_alunos` e `acessos_qrcode` (com `data` = dia do
   jogo) e, se acertou, soma `+10` em `turmas.pontuacao_qrcode` — tudo dentro
   da própria função `SECURITY DEFINER`, sem o cliente tocar nas tabelas
5. Botão "Próxima pergunta →" (ou "Ver resultado do dia →" na última)
6. Depois da última pergunta: tela de resumo do dia (acertos/total, pontos
   ganhos hoje), com o CTA de compartilhar aparecendo **uma vez**, aqui — não
   mais depois de cada pergunta individual
7. Reabrir o app no mesmo dia retoma de onde parou (o servidor já sabe quais
   perguntas foram respondidas, pelo índice único `turma_id + pergunta_id +
data`)

### Tela de campanha encerrada

```javascript
export const FIM_DA_CAMPANHA = "2026-09-30";
// Usa diaDoJogoISO(), não a meia-noite: as perguntas do dia da campanha
// continuam valendo até as 6h do dia seguinte, exatamente quando expiram.
export function campanhaEncerrada() {
  return diaDoJogoISO() >= FIM_DA_CAMPANHA;
}
```

A partir do dia seguinte ao último dia de perguntas, `/aluno/:turmaId/*`
mostra uma tela de encerramento no lugar do quiz/compartilhar: "🎉 Campanha
encerrada!", agradecimento à turma, "🏆 Aguarde a divulgação dos pontos",
confete leve, `#VozesQueProtegem` e os telefones 180 (denúncia) / 190
(emergência).

---

## Área do Aluno — App instalável (PWA)

### Abertura animada

Ao abrir `/aluno/:turmaId` (por exemplo, ao escanear o QR Code), o app mostra
uma abertura de ~2,2s: coração pulsando, logo V.O.Z.E.S. e o nome da turma,
com fade-out para a home. Roda **uma vez por sessão** (`sessionStorage`) — não
repete ao navegar entre quiz e compartilhar — e é pulada inteiramente se o
aparelho pedir `prefers-reduced-motion`.

### Instalação na tela inicial

- `public/manifest.webmanifest`: `start_url` e `scope` em `/aluno`, `display:
standalone`, `theme_color: #7030A0`, ícones em 192/512/512-maskable
- `public/sw.js`: service worker mínimo — _network-first_ nas navegações com
  fallback ao cache (offline básico), _cache-first_ só nos assets já
  versionados pelo build, e **ignora qualquer requisição de outra origem**
  (as chamadas ao Supabase nunca passam pelo cache)
- Registrado somente nas rotas `/aluno/*` — o painel do professor não instala
  nada
- Botão "📲 Instalar o app" na home do aluno: usa o instalador nativo no
  Chrome/Edge (captura `beforeinstallprompt`); no iOS, que não dispara esse
  evento, mostra a instrução "Compartilhar → Adicionar à Tela de Início"
- `/aluno` (sem turmaId) é o `start_url` do app instalado: lê a última turma
  escaneada em `localStorage` e redireciona para ela; sem turma salva, pede
  para escanear o QR Code

> O service worker fica desativado em `npm run dev` de propósito (atrapalharia
> o hot reload). Para testar a instalação: `npm run build && npx vite preview`.

### Compartilhamento (`/aluno/:turmaId/compartilhar`)

Banner com o texto da campanha, `navigator.share()` (tentando anexar o PNG do
card da campanha, com fallback de cópia de link para a área de transferência).
Chama a RPC `registrar_compartilhamento`, que exige que o aparelho já seja um
participante registrado da turma (líder ou aluno), grava `compartilhamentos` e
`acessos_qrcode` e soma +1 ponto — limitado a 1 por aparelho por dia.

---

## Supabase RPC Functions

Desde a migração `participantes_e_pontuacao_segura`, estas são as **únicas**
funções que escrevem pontuação ou registros de participação — todas
`SECURITY DEFINER`, chamadas pelo cliente via `src/lib/rpc.ts`:

```sql
-- "Dia do jogo" calculado no servidor (não confia na data que o cliente manda)
CREATE OR REPLACE FUNCTION dia_do_jogo() RETURNS DATE LANGUAGE sql STABLE AS $$
  SELECT ((NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '6 hours')::DATE;
$$;

-- Dia(s) em que há pergunta disponível — hoje, só 2026-09-29 (ver registro de mudanças)
CREATE OR REPLACE FUNCTION dia_de_campanha(dia DATE) RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT dia = DATE '2026-09-29';
$$;

-- Registra o aparelho na turma e devolve 'lider' | 'aluno' | 'excedente'
CREATE OR REPLACE FUNCTION registrar_participante(turma_id_param UUID, dispositivo_param TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ ... $$;

-- Só o líder chama: confere se é dia de campanha, se é líder, e o gabarito
-- da pergunta; grava a resposta e soma +10 pontos se acertou
CREATE OR REPLACE FUNCTION responder_pergunta_diaria(
  turma_id_param UUID, dispositivo_param TEXT, pergunta_id_param UUID,
  alternativa_param TEXT, tempo_ms_param INTEGER DEFAULT 0,
  dispositivo_tipo_param TEXT DEFAULT 'mobile'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ ... $$;
-- Retorna { ok, acertou, resposta_correta, motivo }
-- motivo: fora_da_campanha | nao_e_lider | pergunta_invalida | alternativa_invalida | ja_respondida

-- +1 ponto de compartilhamento, 1 por aparelho por dia; exige participante já registrado
CREATE OR REPLACE FUNCTION registrar_compartilhamento(
  turma_id_param UUID, dispositivo_param TEXT,
  plataforma_param TEXT DEFAULT 'desconhecida', dispositivo_tipo_param TEXT DEFAULT 'mobile'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ ... $$;
-- Retorna { ok, motivo }; motivo: nao_participante | ja_pontuou_hoje

-- Log de acesso para o funil de engajamento — não pontua
CREATE OR REPLACE FUNCTION registrar_acesso(turma_id_param UUID, dispositivo_tipo_param TEXT DEFAULT 'mobile')
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ ... $$;

-- Salva a sessão inteira do Quiz TV numa transação; recalcula acertos pelo
-- gabarito do banco (não confia no que o cliente diz ter acertado)
CREATE OR REPLACE FUNCTION salvar_quiz_tv(
  turma_id_param UUID, respostas_param JSONB, tempo_total_param INTEGER DEFAULT 0
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ ... $$;
-- Retorna { ok, quiz_tv_id, acertos, erros, pontuacao, motivo }; motivo: sem_respostas | turma_ja_jogou

-- Devolve a vaga de líder da turma (painel do professor)
CREATE OR REPLACE FUNCTION liberar_lider(turma_id_param UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ ... $$;
```

(Corpos completos em
`supabase/migrations/20260912155336_participantes_e_pontuacao_segura.sql`.)

> As RPCs originais (`incrementar_pontuacao_qrcode`,
> `incrementar_pontuacao_compartilhamento`, `incrementar_pontuacao_quiz_tv`,
> `taxa_acerto_por_pergunta`) foram o modelo de pontuação **antes** dessa
> migração. `incrementar_pontuacao_qrcode` foi removida (`DROP FUNCTION`); as
> outras três continuam existindo no banco mas sem uso — nenhum código atual
> as chama, e as duas que gravam pontuação falhariam hoje porque o cliente
> perdeu `UPDATE` direto nas colunas de pontuação de `turmas`. O Analytics não
> usa `taxa_acerto_por_pergunta`: as métricas por pergunta combinam
> `respostas_alunos` **e** `quiz_tv_respostas` em memória, no hook
> `useAnalytics`.

---

## Banco de Perguntas

**23 perguntas ativas** no total: as 15 originais (Lei Maria da Penha,
feminicídio, violência psicológica/patrimonial, stalking digital, revenge
porn, Casa da Mulher Brasileira, CREAS etc.) mais 8 novas, adicionadas a
partir da cartilha "Sinal Vermelho contra a Violência Doméstica" (AMB/CNJ):

```sql
INSERT INTO perguntas (enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, resposta_correta) VALUES
('Qual é o sinal da campanha "Sinal Vermelho" para pedir ajuda em silêncio?','Uma pulseira azul no pulso','Um "X" vermelho na palma da mão','Um lenço amarelo na bolsa','Uma mensagem com a palavra "socorro"','B'),
('Quem criou a campanha "Sinal Vermelho contra a Violência Doméstica"?','O Ministério da Saúde','A AMB e o CNJ, com apoio da Anoreg/BR','Uma rede de farmácias','A Organização das Nações Unidas','B'),
('O que um atendente deve fazer ao ver o "X" vermelho na mão de uma cliente?','Ignorar e seguir o atendimento normal','Perguntar em voz alta se ela sofre violência','Acolher com calma e ligar para a PM pelo 190','Pedir para ela voltar depois','C'),
('Em que posição o Brasil está no ranking mundial de assassinatos de mulheres?','1ª','5ª','15ª','30ª','B'),
('Quais são as três fases do ciclo da violência doméstica?','Namoro, noivado e casamento','Tensão, agressão e reconciliação','Discussão, silêncio e separação','Aviso, punição e perdão','B'),
('Qual número atende a Central de Atendimento à Mulher, 24h e de forma anônima?','190','193','180','156','C'),
('O que são as medidas protetivas de urgência da Lei Maria da Penha?','Multas aplicadas só à vítima','Afastar o agressor do lar e proibir aproximação da vítima','Cursos obrigatórios de casal','Só uma advertência verbal','B'),
('Qual aplicativo de celular a cartilha indica para pedir ajuda?','Proteja Brasil','Meu INSS','SOS Mulher','Disque Denúncia','A');
```

(As 15 perguntas originais estão na primeira migração, sem alteração.)

---

## Identidade Visual — Tokens CSS

Os tokens reais (`src/styles.css`, Tailwind v4 `@theme`) evoluíram além do
rascunho inicial — a paleta dos **gráficos** foi validada para daltonismo
(separação de contraste entre cores adjacentes), o roxo `#9B59B6` ao lado do
`#7030A0` original não passava nessa validação e foi substituído nos
gráficos por um trio roxo/azul/âmbar:

```css
:root {
  --primary: #7030a0;
  --primary-dark: #4b0082;
  --secondary: #ead1f7; /* roxo claro */
  --accent: #9b59b6; /* roxo médio — ainda usado fora de gráficos */
  --background: #f9f4fd;
  --sucesso: #27ae60;
  --erro: #e74c3c;
  --dourado: #f1c40f;
  --info: #3498db;
  --laranja: #e67e22;

  /* Paleta dos gráficos (Analytics/Dashboard), validada para daltonismo */
  --chart-1: #7030a0; /* roxo — série 1 */
  --chart-2: #2e86c1; /* azul — série 2 */
  --chart-3: #d68910; /* âmbar — série 3, sempre com rótulo direto */
  --grafico-acerto: #27ae60;
  --grafico-erro: #a93226; /* vermelho escurecido: separa do verde p/ daltônicos */

  --font-display: "Outfit", ui-sans-serif, system-ui, sans-serif;
  --font-sans: "Figtree", ui-sans-serif, system-ui, sans-serif;
  --radius: 0.75rem; /* 12px */
}
```

`fundo-tv` (gradiente `#1A0A2E → #2D1B4E`) e as animações de abertura do app
do aluno (`abertura-coracao`, `abertura-subir`) também vivem em `styles.css`.

---

## Estrutura Real de Arquivos

O projeto usa **TanStack Start com roteamento por arquivo** (`src/routes/`),
não o esquema genérico de `pages/` do rascunho original:

```
src/
├── components/
│   ├── layout/        ProfessorLayout · AlunoLayout · ProtectedRoute (via beforeLoad)
│   ├── ui/             shadcn/ui
│   ├── turmas/         QRCodeTurma
│   ├── aluno/          AberturaAnimada · BotaoInstalar · CampanhaEncerrada
│   ├── calendario/     CalendarioGrid · EventoForm
│   ├── materiais/      CartaoCampanha (16:9 e A4, PNG)
│   └── analytics/      Secao · StatsOverview · DesempenhoPorTurma ·
│                        DesempenhoPorPergunta · EvolucaoTemporal · HorarioPico ·
│                        FunilEngajamento · QuizTVAnalise · ComparativoFontes ·
│                        ExportarRelatorio
├── routes/
│   ├── index.tsx                          → /
│   ├── quiz-tv.tsx                        → /quiz-tv
│   ├── _professor.tsx                     → guard + layout do professor
│   ├── _professor.dashboard.tsx
│   ├── _professor.turmas.tsx
│   ├── _professor.perguntas.tsx
│   ├── _professor.calendario.tsx
│   ├── _professor.materiais.tsx
│   ├── _professor.pontuacao.tsx
│   ├── _professor.analytics.tsx
│   ├── aluno.index.tsx                    → /aluno (start_url do PWA)
│   ├── aluno.$turmaId.tsx                 → guard + layout + abertura + encerramento
│   ├── aluno.$turmaId.index.tsx           → home do aluno
│   ├── aluno.$turmaId.quiz.tsx            → perguntas diárias
│   └── aluno.$turmaId.compartilhar.tsx
├── hooks/
│   └── useAnalytics.ts    ← todas as queries e agregações do Analytics/Dashboard
└── lib/
    ├── vozes.ts            ← tipos, constantes, datas, seleção de perguntas
    ├── auth.ts             ← senha do professor    ├── participante.ts      ← id do aparelho, papel (líder/aluno/excedente)
    ├── rpc.ts               ← chamadas tipadas às funções SECURITY DEFINER    ├── pwa.ts              ← registro do service worker, lembrar turma
    └── exportar.ts         ← CSV e PDF do Analytics

public/
├── manifest.webmanifest · sw.js
└── icon-192.png · icon-512.png · icon-maskable-512.png · apple-touch-icon.png
```

---

## MVP — Status

Todas as 16 metas originais foram entregues, mais os ajustes pós-lançamento:

1. ✅ Login com senha única + proteção de rotas
2. ✅ Supabase: tabelas + seeds (turmas, perguntas, eventos)
3. ✅ Turmas com QR Code
4. ✅ Banco de perguntas com CRUD (23 perguntas ativas)
5. ✅ Experiência mobile do aluno
6. ✅ **Perguntas diárias reformuladas**: sem limite por dia, concentradas no dia da campanha, 10 pts/acerto, expira às 6h
7. ✅ Compartilhamento via Web Share API
8. ✅ Quiz TV fullscreen — **agora jogo único por turma**, com registro automático no calendário
9. ✅ **Segurança de pontuação**: identidade por aparelho (líder/aluno/excedente, até 10 por turma) e toda escrita de pontuação/participação exclusiva via RPC `SECURITY DEFINER`
10. ✅ Dashboard completo (cards, ranking, últimos quizzes, gráfico semanal, resumo de analytics)
11. ✅ Calendário com CRUD
12. ✅ **Materiais em PNG** (card 16:9 + cartaz A4) — PDF removido desta tela
13. ✅ Ranking oculto para alunos até o encerramento da campanha
14. ✅ Painel de Analytics completo (7 seções + exportação CSV/PDF)
15. ✅ Tempo de resposta registrado (mobile e TV)
16. ✅ Log de acessos QR Code
17. ✅ Exportação de relatório PDF e CSV completo
18. ✅ **App do aluno como PWA** (manifest, service worker, ícones, instalação)
19. ✅ **Abertura animada** ao escanear o QR Code
20. ✅ **Tela de encerramento** a partir do dia seguinte ao último dia de perguntas, aguardando divulgação dos pontos

---

## Observações Finais

- Todo texto da interface está em **português brasileiro**
- O modo TV (`/quiz-tv`) usa Fullscreen API, fundo escuro, fontes grandes, e
  não deve parecer uma tela mobile ampliada
- As rotas de aluno sempre renderizam layout mobile, mesmo em desktop
- As rotas de professor são responsivas (desktop com sidebar + mobile com
  hambúrguer)
- Os materiais impressos/compartilháveis são **PNG** (card 16:9 e cartaz A4),
  não mais PDF
- Nenhuma menção institucional além de **CEM de Gurupi** aparece em qualquer
  tela, material ou registro do banco
- O app do aluno é **instalável (PWA)**, com abertura animada e tela de
  encerramento fora da janela da campanha
- O sistema registra todas as interações (acesso via QR Code, resposta com
  tempo em ms, compartilhamento, sessão de Quiz TV detalhada por pergunta)
- O painel de Analytics é a fonte de evidências exportáveis do projeto — PDF
  com gráficos e CSV com dados brutos
