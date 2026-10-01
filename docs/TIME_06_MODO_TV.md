# TIME_06 — Modo TV (DDS e SIPAT no refeitório)

Base: `quiz-tv.tsx` do V.O.Z.E.S. (fullscreen, fundo escuro, fontes grandes, aviso < 768px)
\+ motor de regras do Max Games (`gameReducer.js`, modos Quiz por Tempo e Eliminação).
Operado pelo **técnico logado** num computador ligado à TV (ou na tela interativa).

## 1. Rotas

| Rota                    | Tela                                                                         |
| ----------------------- | ---------------------------------------------------------------------------- |
| `/tv`                   | Seleção: evento (ou treino) → modo → setores → iniciar (aceita `?evento=id`) |
| `/tv/checkin/$eventoId` | Tela de check-in com QR rotativo                                             |
| `/tv/jogo`              | Partida em andamento (estado em memória)                                     |

Todas exigem sessão do técnico. Botões fixos no canto: ⛶ Tela cheia · ✕ Sair.

## 2. Tela de check-in (`/tv/checkin/$eventoId`)

Para o DDS: fica na TV enquanto o pessoal chega.

- Ao abrir: chama `tecnico_rotacionar_codigo` e repete **a cada 60 s**.
- Mostra: título do evento, QR gigante para
  `{origin}/app/checkin?e={eventoId}&c={codigo}`, o código em letras grandes (para quem digitar),
  barra de contagem dos 60 s, e **contador ao vivo de presentes** (consulta `checkins` do evento a cada 5 s)
  com os últimos 5 nomes curtos que chegaram ("Carlos S. ✅").
- Botão **"Começar o quiz"** → `/tv?evento={id}`.
- O código anterior continua válido por 3 minutos (tolerância para quem escaneou no limite).

## 3. Seleção (`/tv`)

1. **Evento**: lista de eventos de hoje (agendados, ainda sem sessão). Opção **"Treino (não pontua)"**.
2. **Modo**:
   | Modo                    | Para                       | Equipes              |
   | ----------------------- | -------------------------- | -------------------- |
   | 🎯 **Clássico**         | DDS rápido                 | 1 setor (ou "Todos") |
   | ⚡ **Duelo de Setores** | SIPAT, integração          | 2 a 4 setores        |
   | 🧩 **Eliminação**       | SIPAT, final de campeonato | 2 a 4 setores        |
3. **Setores participantes** (cards com a cor do setor).
4. **Perguntas**: tema(s) (padrão: os da campanha) e quantidade (Clássico: 5 ou 10; Duelo: 10 ou 15;
   Eliminação: automático). Sorteio entre perguntas ativas, **priorizando os temas com pior taxa de
   acerto do setor** (dados de `v_lacunas`) quando a opção "Focar nas lacunas" estiver marcada.
5. **Iniciar**.

## 4. Modos

### 🎯 Clássico (portado do Quiz TV do V.O.Z.E.S.)

Grid 2×2 (ou 2×3 para 5 alternativas), a turma discute e o técnico toca a resposta.
Fluxo: toque → destaque → 1 s → revelação verde/vermelho + **explicação** na tela → 3 s → próxima.
Pontos do setor: **acertos × 10** (recalculado pelo servidor).

### ⚡ Duelo de Setores (portado do "Quiz por Tempo" do Max Games)

Todas as equipes veem a pergunta; cada setor tem um **botão de buzzer** grande na sua cor
(tela touch) ou o técnico toca pela equipe que levantou a mão primeiro. Timer de 30 s.

- 1º a acertar: +10 · 2º: +5 · 3º/4º: +2 · erro: −2 (nunca abaixo de 0)
- Todos erram ou tempo esgota: pula sem pontuar.

### 🧩 Eliminação (portado do "Quiz Eliminação" do Max Games)

Uma equipe por vez, 5 perguntas crescentes: 2 · 5 · 10 · 20 · 40 pts (acumulado máx. 77).
Errar zera o acumulado da rodada. Ajudas (1 de cada por turno): 🃏 50/50 · ⏩ Pular · 👥 Consultar equipe (15 s).

### Como portar o motor do Max Games

- Copiar `src/hooks/gameReducer.js` para `src/lib/jogos/reducer.ts`, **tipando** e mantendo só:
  estado base, rotação de turno, `QuizTempo` e `Eliminacao` (remover caça-palavras, forca,
  corrida, bomba, duelo antigo e todos os jogos de apostas).
- Copiar também `gameReducer.test.js` → `reducer.test.ts` com os casos dos dois modos.
- Adaptar o formato da pergunta: `{ id, enunciado, alternativas: string[], correta: number, explicacao }`
  (no Max Games era `{ q, options, correct }`).
- Equipes = setores: `{ setorId, nome, cor, pontos }`.

## 5. Placar e resultado

- Barra lateral com um card por setor (cor do setor), equipe da vez destacada, placar ao vivo.
- Tela final: confete, ranking da partida com medalhas, acertos/erros por setor.
- Botão **"Salvar pontuação"** (só se veio de um evento) → `tecnico_salvar_quiz_tv` com:
  ```json
  {
    "p_evento": "uuid",
    "p_modo": "classico | duelo | eliminacao",
    "p_duracao_ms": 312000,
    "p_equipes": [{ "setor_id": "uuid", "pontos": 40 }],
    "p_respostas": [
      { "setor_id": "uuid", "pergunta_id": "uuid", "alternativa": 2, "tempo_ms": 8400, "ordem": 1 }
    ]
  }
  ```
  - Resposta `evento_ja_tem_sessao` → "Este evento já tem pontuação salva."
  - Sucesso → o evento vira "realizado" e os pontos entram no **ranking de setores**.
- **Treino**: mostra resultado, não salva nada.

## 6. Visual da TV

- Fundo: gradiente `#0A1929 → #13294B` (azul-noite industrial).
- Enunciado 48–56px, alternativas 32–40px, fonte Outfit.
- Cores das equipes = cor do setor (garantir contraste: se a cor for escura, borda clara).
- Contagem regressiva circular. Sons curtos opcionais (Web Audio, como no Max Games) com botão 🔇.
- Tudo legível a 5 metros.

## 7. Painel remoto (opcional, pós-prêmio)

Portar o "Game Master" do Max Games: celular do técnico como controle (pausar, pular, revelar),
sincronizado pelo Supabase Realtime num canal `tv:{sessao}`.
