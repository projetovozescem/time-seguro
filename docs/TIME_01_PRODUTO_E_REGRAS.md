# TIME_01 — Produto e Regras de Negócio

## 1. Problema que resolve

- Treinamentos de SST na indústria costumam ser **passivos** (slide, assinatura na lista) e **sem medição**
  do que o colaborador realmente aprendeu.
- Relatos de condição insegura e quase-acidente **se perdem** (papel, WhatsApp, conversa de corredor).
- A **Lei 14.457/2022** passou a exigir das empresas com CIPA ações de prevenção e combate ao assédio,
  incluindo **canal de denúncias** e **capacitação periódica**.
- O técnico de SST não tem como **reconhecer** quem mais se engaja com a segurança.

## 2. Solução

Campanhas trimestrais gamificadas, organizadas nas 4 letras do **T.I.M.E.**:

- 🎓 **Treinar**: quiz diário, trilha curta de lições com avaliação corrigida pelo servidor e quiz ao vivo no DDS/SIPAT
- 🔍 **Identificar**: relatos de condição insegura e quase-acidente com foto, QR Code nos locais,
  mapa de lacunas (setor × tema) e Canal de Respeito anônimo
- 📣 **Mobilizar**: setores competindo como times, check-in em DDS e SIPAT, Modo TV no refeitório,
  sequência de dias e selos
- 📈 **Evoluir**: ranking trimestral, premiação, certificados, relatório de evidência e comparativo
  de um trimestre para o outro

## 3. Perfis de acesso

| Papel                                                  | Pode                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| `admin`                                                | Tudo, incluindo configurações da empresa, termo LGPD e anonimização |
| `tecnico`                                              | Tudo, exceto configurações da empresa e anonimização                |
| `cipa`                                                 | Somente leitura: dashboard, relatos, rankings, relatórios           |
| `comite_assedio` (flag, combinável com qualquer papel) | Único grupo que lê e responde o Canal de Respeito                   |
| Colaborador                                            | App: quiz, trilha, relatos, check-in, ranking, perfil               |
| Público                                                | Canal de Respeito e verificação de certificado                      |

## 4. Campanha trimestral — ciclo de vida

```
rascunho ──(ativar)──▶ ativa ──(encerrar)──▶ encerrada
```

- Só **1 campanha ativa** por empresa (garantido pelo banco).
- Para ativar: precisa ter pelo menos **1 tema** vinculado (pool do quiz diário).
- O técnico define: nome, período, temas, perguntas por dia (padrão 5), premiação (texto livre),
  se o ranking fica visível aos colaboradores, e opcionalmente sobrescreve pontos (`config`).
- **Pontuação zera a cada ciclo** naturalmente: todo ponto pertence a uma `campanha_id`.
- **Encerrar** (botão do técnico): congela o ranking em `campanha_resultados`, concede selos
  finais (Pódio e Guardião do Setor) e emite certificados automaticamente.

## 5. Os 3 pilares da pontuação

| Pilar               | Fontes                                                                         |
| ------------------- | ------------------------------------------------------------------------------ |
| 🧠 **Conhecimento** | Acertos no quiz diário, lição concluída, avaliação aprovada                    |
| 📢 **Relatos**      | Relato **validado** pelo técnico (peso pela gravidade), bônus quando resolvido |
| 🔥 **Engajamento**  | Presença diária, sequência de 7/15/30 dias, check-in em DDS/SIPAT              |
| 📺 Quiz TV (setor)  | Pontos do Modo TV vão para o **setor**, não para pessoas                       |

Valores detalhados em `TIME_08_PONTUACAO_SELOS.md`.

## 6. Regras anti-fraude

1. **Relato só pontua depois de validado** pelo técnico (decisão: validar / rejeitar / duplicado).
2. **Relato duplicado ou rejeitado não pontua.** O sistema sinaliza "possível duplicado"
   (mesmo local/setor + mesma categoria nos últimos 7 dias) para ajudar o técnico.
3. **Máx. 5 relatos pontuados por semana** por colaborador (configurável). Relatos extras
   ainda são tratados, só não pontuam.
4. **Máx. 10 relatos por dia** por colaborador (bloqueio de spam).
5. **Quiz diário**: N perguntas por dia (padrão 5), cada pergunta respondida 1 vez → teto
   natural de pontos por dia.
6. **Avaliação de lição**: máx. 3 tentativas por dia; pontua só na 1ª aprovação.
7. **Check-in**: código muda a cada 60 s na TV (precisa estar no local), 1 por evento,
   janela de 30 min antes/depois, respeita o setor do evento.
8. **Modo TV**: 1 sessão pontuada por evento; no modo clássico o servidor recalcula os pontos.
9. **Presença diária** só conta com ação real (responder, estudar, relatar, check-in),
   não por abrir o app.
10. Todo ponto é **idempotente** (`origem` + `origem_id` únicos): nada pontua duas vezes.

## 7. ⚠️ Regra essencial: Canal de Respeito

- Denúncia de assédio é **anônima** e **nunca pontua**.
- Acessível **sem login**, por link/QR próprio (`/respeito/{codigo-da-empresa}`) e por um botão
  discreto no app que **abre a página pública sem enviar o token**.
- O banco guarda **somente a data** (sem hora), sem colaborador, sem IP, sem aparelho.
- O denunciante recebe **protocolo + senha** (mostrados uma única vez) para acompanhar e trocar
  mensagens com o comitê.
- Só perfis com `comite_assedio = true` enxergam as denúncias. CIPA sem essa flag não vê.
- A **lição sobre assédio** (educativa) pontua normalmente e dá o selo "Voz do Respeito".
  Educação pontua; denúncia não.

## 8. Relatos — fluxo

```
aberto ──▶ [técnico decide]
             ├─ validar (gravidade) ──▶ em_analise ──▶ em_correcao ──▶ resolvido (+bônus)
             ├─ rejeitar ──▶ rejeitado
             └─ duplicado ──▶ duplicado (aponta o relato original)
```

Categorias: `condicao_insegura`, `ato_inseguro`, `quase_acidente`, `melhoria`.
O colaborador acompanha o histórico (mensagens marcadas como visíveis).

## 9. Premiação

- O prêmio é **definido pela empresa** (campo texto na campanha) e entregue fora do sistema.
- O sistema aponta os vencedores (ranking congelado) e gera certificados:
  - **Destaque**: top N geral (padrão 3) + 1º de cada setor
  - **Conclusão de trilha**: todos aprovados em todas as lições obrigatórias, com carga horária somada
- Certificado tem código `TIME-XXXXXXXXXX` verificável em `/verificar/{codigo}`.

## 10. Limites honestos (mostrar no sistema)

- A trilha do T.I.M.E. é **complementar**. Ela **não substitui** os treinamentos formais
  obrigatórios das NRs (ex.: NR-10 básico, NR-35 teórico e prático). O relatório de evidência
  deve trazer esse aviso.
- O Canal de Respeito não substitui canais oficiais: exibir também **Disque 180** (Central de
  Atendimento à Mulher), **Disque 100** (Direitos Humanos) e **190** (emergência).

## 11. Modelo de negócio (para a inscrição)

- **SaaS por empresa**: mensalidade por faixa de colaboradores ativos.
- **Licenciamento para o Sistema Indústria** (SENAI/SESI) oferecer a empresas atendidas.
- Custo de infraestrutura baixo (Supabase + hospedagem estática).
