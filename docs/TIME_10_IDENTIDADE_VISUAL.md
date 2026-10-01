# TIME_10 — Identidade Visual

Conceito: **segurança industrial + conquista esportiva**. Cores de sinalização de segurança
(amarelo, laranja, verde, vermelho) sobre um azul-marinho sério. Sai o roxo/rosa do V.O.Z.E.S.

## 1. Nome e marca

- Escrita oficial: **T.I.M.E.** (com pontos) · por extenso: _Treinar, Identificar, Mobilizar e Evoluir_
- Nome completo: **T.I.M.E. Seguro** · artigo masculino: "o T.I.M.E.", "no T.I.M.E.", "do T.I.M.E."
- Duplo sentido proposital: **T.I.M.E.** = as 4 atitudes da segurança e também **"time"**, a equipe
  que se protege junto (setores competindo como times).
- Símbolo: **escudo** com capacete de segurança estilizado no centro e uma estrela no topo
  (lembra brasão de time esportivo). Fazer em SVG simples (2 cores), funciona em 16px.
- Slogan: **"Segurança é trabalho de time."**
- Cada letra pode virar ícone nos materiais:
  🎓 **T**reinar · 🔍 **I**dentificar · 📣 **M**obilizar · 📈 **E**voluir

## 2. Paleta

| Token                    | Hex                 | Uso                                                        |
| ------------------------ | ------------------- | ---------------------------------------------------------- |
| `--color-marinho`        | `#0B3C5D`           | Primária: cabeçalhos, botões principais, texto de destaque |
| `--color-marinho-escuro` | `#072A42`           | Hover, sidebar                                             |
| `--color-amarelo`        | `#FFC400`           | Destaques, pontos, sequência, selos (amarelo segurança)    |
| `--color-laranja`        | `#F57C00`           | Relatos, alertas de atenção, SIPAT                         |
| `--color-verde`          | `#2E7D32`           | Acerto, resolvido, aprovado                                |
| `--color-vermelho`       | `#C62828`           | Erro, gravidade alta, lacuna                               |
| `--color-respeito`       | `#6A1B9A`           | **Somente** Canal de Respeito e tema assédio               |
| `--color-fundo`          | `#F4F6F9`           | Fundo das telas claras                                     |
| `--color-superficie`     | `#FFFFFF`           | Cards                                                      |
| `--color-texto`          | `#1A2330`           | Texto principal                                            |
| `--color-texto-suave`    | `#5B6878`           | Texto secundário                                           |
| `--color-borda`          | `#DDE3EA`           | Bordas                                                     |
| TV fundo                 | `#0A1929 → #13294B` | Gradiente do Modo TV                                       |

Regras:

- Texto sobre amarelo **sempre** em `#1A2330` (nunca branco).
- Faixa zebrada (amarelo/preto 45°) só como detalhe decorativo: topo do app, cantos do certificado.
- Botão primário: marinho com texto branco. Botão de ação positiva de jogo: amarelo com texto escuro.

### Paleta de gráficos (segura para daltonismo)

`#0B3C5D` · `#F5A300` · `#2E86C1` · `#C0392B` · `#7F8C8D` · `#16A085` · `#8E44AD`
No mapa de lacunas, cor **sempre acompanhada do número**.

## 3. Tipografia

- Títulos: **Outfit** (700/800) — mantida do V.O.Z.E.S.
- Texto: **Figtree** (400/500/600) — mantida
- Números grandes (pontos, placar): Outfit 800 com `font-variant-numeric: tabular-nums`
- Tamanho mínimo no app: 16px (evita zoom no iOS). TV: ver TIME_06 §6.

## 4. Tailwind v4 (`src/styles.css`)

Substituir o `@theme` do V.O.Z.E.S. por:

```css
@theme {
  --color-marinho: #0b3c5d;
  --color-marinho-escuro: #072a42;
  --color-amarelo: #ffc400;
  --color-laranja: #f57c00;
  --color-verde: #2e7d32;
  --color-vermelho: #c62828;
  --color-respeito: #6a1b9a;
  --color-fundo: #f4f6f9;
  --color-texto: #1a2330;
  --color-texto-suave: #5b6878;
  --color-borda: #dde3ea;
  --font-titulo: "Outfit", system-ui, sans-serif;
  --font-texto: "Figtree", system-ui, sans-serif;
}
.faixa-seguranca {
  background: repeating-linear-gradient(45deg, #ffc400 0 12px, #1a2330 12px 24px);
  height: 6px;
}
```

E mapear as variáveis do shadcn (`--primary`, `--accent`, `--destructive`...) para esses tokens.

## 5. Ícones e emojis

- `lucide-react` na interface; emojis nos temas, selos e chips (reconhecimento rápido).
- Temas: 💜 Assédio · ⚡ NR-10 · ⚙️ NR-12 · 🪜 NR-35 · 🦺 EPI · 🧹 5S · 🛡️ Geral
- Categorias de relato: ⚠️ Condição insegura · 🚶 Ato inseguro · 😰 Quase-acidente · 💡 Melhoria

## 6. Componentes-chave

- **Card de pilar**: ícone + nome + barra de progresso + pontos (cores: conhecimento marinho,
  relatos laranja, engajamento amarelo).
- **Chip de sequência**: 🔥 + número em amarelo; pulsa quando aumenta.
- **Selo**: círculo 64px com emoji, borda dourada quando conquistado, cinza 40% quando não.
- **Chip de status do relato**: Enviado (cinza) · Em análise (azul) · Em correção (laranja) ·
  Resolvido (verde) · Não validado (vermelho claro) · Já relatado (cinza tracejado).
- **Página do Canal de Respeito**: fundo branco, detalhes em `--color-respeito`, **sem** a faixa
  zebrada, sem gamificação, tom acolhedor.

## 7. Tom de voz

- Direto e respeitoso: "Viu um risco? Relate." / "Bom trabalho, Carlos!"
- Reconhece o esforço, nunca envergonha: "Faltou pouco! Revise e tente de novo."
- Evita tom infantil. Público adulto de fábrica.
