# 🥈 T.I.M.E. Seguro

## Treinar, Identificar, Mobilizar e Evoluir

_Plataforma gamificada de capacitação, prevenção e reconhecimento na indústria_

---

## 1. Em uma frase

O técnico de SST cria uma **campanha trimestral**; os colaboradores respondem perguntas,
fazem lições curtas, relatam riscos com foto e participam do DDS pelo celular; tudo vira
**pontos em 3 pilares**; no fim do trimestre os melhores são **premiados** e a empresa tem
**relatórios de evidência** e um **mapa de lacunas** por setor e tema.

## 2. De onde vem cada parte

| Veio do V.O.Z.E.S.                    | Veio do Max Games                  | Novo no T.I.M.E.                            |
| ------------------------------------- | ---------------------------------- | ------------------------------------------- |
| Stack TanStack + Supabase             | Importador PDF/TXT/CSV             | Login matrícula + PIN                       |
| App PWA do aluno → app do colaborador | Validação de perguntas             | Consentimento LGPD                          |
| Quiz TV → Modo TV (DDS/SIPAT)         | Motor dos modos Duelo e Eliminação | Campanha trimestral                         |
| Pontuação segura via RPC              | Ranking por equipe                 | Trilha de lições com avaliação              |
| Analytics + export CSV/PDF            | Relatório por participante         | Relatos com foto + validação                |
| Materiais com QR Code (PNG)           |                                    | Canal de Respeito anônimo (Lei 14.457/2022) |
| Calendário de eventos                 |                                    | Check-in de DDS com código rotativo         |
|                                       |                                    | Selos, certificados, mapa de lacunas        |

**Fica de fora:** os simuladores de apostas do Max Games (não têm relação com a indústria)
e a identidade por aparelho do V.O.Z.E.S. (substituída por login individual).

## 3. Os 3 públicos

| Público                       | Onde usa                 | Como entra                          |
| ----------------------------- | ------------------------ | ----------------------------------- |
| 👷 Colaborador                | Celular (PWA instalável) | Código da empresa + matrícula + PIN |
| 🦺 Técnico SST / CIPA / Admin | Computador ou celular    | E-mail e senha (Supabase Auth)      |
| 📺 TV do refeitório           | Computador ligado à TV   | Sessão do técnico                   |
| 💜 Qualquer pessoa            | Página pública           | Canal de Respeito, **sem login**    |

## 4. Ordem de leitura

1. `TIME_01_PRODUTO_E_REGRAS.md` — o que o sistema faz e por quê
2. `TIME_02_BANCO_DE_DADOS.md` — SQL pronto para aplicar
3. `TIME_03_SEGURANCA_LGPD.md` — como os acessos funcionam
4. `TIME_04` a `TIME_07` — telas e funcionalidades
5. `TIME_08` e `TIME_09` — pontos, selos e relatórios
6. `TIME_10` — visual
7. `TIME_11_PLANO_DE_EXECUCAO.md` — **comece a codar por aqui**
8. `TIME_12` — perguntas prontas
9. `TIME_13` — skills, AGENTS.md, agentes e prompts do Claude Code (piloto e modo autônomo)

## 5. Estrutura final do repositório

```
time-seguro/
├── CLAUDE.md
├── docs/                      ← todos os TIME_*.md
├── supabase/
│   ├── migrations/            ← 0001 a 0006 do TIME_02
│   └── functions/
│       └── relato-upload-url/index.ts
├── public/
│   ├── manifest.webmanifest   ← scope /app
│   ├── sw.js
│   └── icones T.I.M.E.
└── src/
    ├── routes/                ← ver TIME_04, TIME_05, TIME_06
    ├── components/
    │   ├── painel/  app/  tv/  analytics/  materiais/  ui/
    ├── hooks/
    ├── lib/
    │   ├── supabase.ts  database.types.ts  rpc.ts  sessao.ts
    │   ├── importacao/        ← parsers portados do Max Games
    │   └── jogos/             ← reducer do Modo TV portado do Max Games
    └── styles.css
```

## 6. Glossário rápido

- **SST**: Segurança e Saúde no Trabalho
- **CIPA+A**: Comissão Interna de Prevenção de Acidentes **e de Assédio** (Lei 14.457/2022)
- **DDS**: Diálogo Diário de Segurança (conversa curta antes do turno)
- **SIPAT**: Semana Interna de Prevenção de Acidentes do Trabalho
- **Quase-acidente**: evento que poderia ter causado lesão ou dano, mas não causou
- **NR**: Norma Regulamentadora (NR-10 eletricidade, NR-12 máquinas, NR-35 altura, NR-6 EPI)
- **Dia operacional**: o dia do sistema vira às **05h**, não à meia-noite (turno da noite)
