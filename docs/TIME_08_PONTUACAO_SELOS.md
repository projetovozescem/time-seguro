# TIME_08 — Pontuação, Selos e Ciclo Trimestral

Toda a lógica já está no SQL (TIME_02). Este documento é a referência de regras para telas,
textos de ajuda e para a inscrição no prêmio.

## 1. Tabela de pontos (padrões)

Cada valor pode ser sobrescrito por campanha em `campanhas.config` (chave entre parênteses).

### 🧠 Conhecimento

| Ação                                                 | Pontos | Limite                                   |
| ---------------------------------------------------- | ------ | ---------------------------------------- |
| Acerto no quiz diário (`pontos_acerto_diario`)       | 10     | N perguntas/dia (padrão 5 → máx. 50/dia) |
| Lição: conteúdo concluído (`pontos_licao_conteudo`)  | 20     | 1× por lição                             |
| Lição: avaliação aprovada (`pontos_licao_aprovada`)  | 30     | 1× por lição                             |
| Lição: nota 100 (`pontos_licao_nota_maxima`)         | +10    | 1× por lição                             |
| Tentativas de avaliação (`tentativas_avaliacao_dia`) | —      | 3 por dia                                |

### 📢 Relatos (só depois de validado)

| Ação                                                     | Pontos | Limite                                                  |
| -------------------------------------------------------- | ------ | ------------------------------------------------------- |
| Relato validado, gravidade baixa (`pontos_relato_baixa`) | 30     | até 5 pontuados/semana (`max_relatos_pontuados_semana`) |
| Relato validado, gravidade média (`pontos_relato_media`) | 40     | idem                                                    |
| Relato validado, gravidade alta (`pontos_relato_alta`)   | 50     | idem                                                    |
| Relato resolvido (`pontos_relato_resolvido`)             | +10    | 1× por relato                                           |
| Rejeitado / duplicado                                    | 0      | —                                                       |

### 🔥 Engajamento

| Ação                                      | Pontos                                         | Limite                   |
| ----------------------------------------- | ---------------------------------------------- | ------------------------ |
| Presença diária (`pontos_presenca`)       | 2                                              | 1×/dia, só com ação real |
| Sequência de 7 dias (`pontos_streak_7`)   | 20                                             | 1× por campanha          |
| Sequência de 15 dias (`pontos_streak_15`) | 50                                             | 1× por campanha          |
| Sequência de 30 dias (`pontos_streak_30`) | 100                                            | 1× por campanha          |
| Check-in em evento                        | `eventos.pontos` (DDS 5, SIPAT/Treinamento 15) | 1× por evento            |

Sábado e domingo **sem atividade não quebram** a sequência (`streak_ignora_fds`, padrão `true`).
Atividade no fim de semana conta normalmente.

### 📺 Modo TV (vai para o SETOR)

| Modo               | Pontos do setor                        |
| ------------------ | -------------------------------------- |
| Clássico           | acertos × 10 (recalculado no servidor) |
| Duelo / Eliminação | placar do jogo, com teto de segurança  |

### 💜 Canal de Respeito

**Zero pontos, sempre.** Educação sobre assédio (lição) pontua; denúncia não.

## 2. Exemplo: colaborador engajado em 1 semana (5 dias úteis)

| Ação                                          | Pontos  |
| --------------------------------------------- | ------- |
| Quiz: 4 acertos/dia × 5 dias × 10             | 200     |
| 2 lições concluídas e aprovadas (20 + 30) × 2 | 100     |
| 1 relato validado (média) + resolvido         | 50      |
| Presença 5 dias × 2                           | 10      |
| 3 DDS × 5                                     | 15      |
| **Total da semana**                           | **375** |

Quem **relata riscos reais** compete de igual para igual com quem só acerta perguntas:
esse equilíbrio é proposital (o objetivo é prevenção, não só teoria).

## 3. Rankings

- **Individual**: soma de todos os pontos do colaborador na campanha.
  Desempate: mais pontos em relatos → mais pontos em conhecimento → quem chegou primeiro ao total.
- **Setor**: média de pontos por colaborador ativo do setor + pontos do Modo TV.
  Assim um setor pequeno e engajado pode vencer um setor grande.
- Visibilidade para colaboradores: configurável por campanha (`ranking_visivel`).
  No app, só "Primeiro nome + inicial".

## 4. Selos

| Selo                 | Ícone | Regra                                              | Quando é avaliado |
| -------------------- | ----- | -------------------------------------------------- | ----------------- |
| Primeiro Passo       | 👣    | 1ª resposta na campanha                            | a cada ação       |
| Olho Vivo            | 👁️    | 3 relatos validados                                | validação         |
| Sentinela            | 🛡️    | 10 relatos validados                               | validação         |
| Presença Firme       | 🔥    | sequência de 10 dias                               | a cada ação       |
| Maratonista do Saber | ⚡    | 100 acertos no quiz diário                         | a cada resposta   |
| DDS em Dia           | 🗣️    | 10 check-ins em DDS                                | check-in          |
| Mestre das NRs       | 🎓    | todas as lições obrigatórias aprovadas, média ≥ 90 | avaliação         |
| Voz do Respeito      | 💜    | aprovado na lição do tema "assédio"                | avaliação         |
| Guardião do Setor    | 🏆    | 1º do setor no encerramento                        | encerramento      |
| Pódio do T.I.M.E.    | 🥇    | top 3 geral no encerramento                        | encerramento      |

Selos são **por campanha** (dá para reconquistar a cada trimestre). O perfil mostra os da campanha
ativa e um histórico "Conquistas anteriores".

## 5. Ciclo trimestral (calendário sugerido)

| Semana | Ação do técnico                                                                                      |
| ------ | ---------------------------------------------------------------------------------------------------- |
| Antes  | Criar campanha, escolher temas, importar perguntas, montar 4–6 lições, gerar PINs, imprimir cartazes |
| 1      | Lançamento no DDS com check-in na TV; entrega dos cartões de acesso                                  |
| 1–12   | Validar relatos 2× por semana; 1 DDS com quiz por semana; acompanhar lacunas                         |
| 6      | Meio do trimestre: divulgar top 3 parcial (se ranking visível)                                       |
| SIPAT  | Duelo de Setores e Eliminação na TV                                                                  |
| 13     | **Encerrar campanha** → certificados → premiação no DDS                                              |
| Depois | Relatório de evidência e comparativo para a gestão e a CIPA; criar a próxima campanha                |

## 6. Encerramento — o que o botão faz

1. Status → `encerrada` (app passa a mostrar "Campanha encerrada. Aguarde a premiação!")
2. Congela ranking individual e de setores em `campanha_resultados`
3. Concede **Pódio** (top 3) e **Guardião do Setor** (1º de cada setor)
4. Emite certificados de **destaque** (top N + 1º de cada setor) e de **conclusão de trilha**
5. Pontos da próxima campanha começam do zero

## 7. Textos das origens (extrato do app)

| origem                           | Texto                         |
| -------------------------------- | ----------------------------- |
| quiz_diario                      | Acerto no quiz do dia         |
| licao_conteudo                   | Estudou uma lição             |
| licao_aprovada                   | Aprovado na avaliação         |
| licao_nota_maxima                | Nota máxima na avaliação      |
| relato_validado                  | Relato validado pela SST      |
| relato_resolvido                 | Seu relato foi resolvido      |
| presenca_diaria                  | Presença do dia               |
| streak_7 / streak_15 / streak_30 | Sequência de 7 / 15 / 30 dias |
| checkin                          | Presença em DDS/SIPAT         |
