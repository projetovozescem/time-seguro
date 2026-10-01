# TIME_04 — Painel do Técnico (web, responsivo)

Base: layout do professor do V.O.Z.E.S. (sidebar no desktop, hambúrguer no celular).
Acesso: Supabase Auth. Papéis e permissões em `TIME_01` §3.

## 1. Rotas

| Rota                            | Tela                                           | Papel mínimo           |
| ------------------------------- | ---------------------------------------------- | ---------------------- |
| `/painel/login`                 | Login (fora do layout protegido)               | —                      |
| `/painel/nova-senha`            | Redefinir senha                                | —                      |
| `/painel`                       | Início (dashboard)                             | cipa                   |
| `/painel/campanhas`             | Lista de campanhas                             | cipa                   |
| `/painel/campanhas/$id`         | Detalhe da campanha (abas)                     | cipa (edição: tecnico) |
| `/painel/perguntas`             | Banco de perguntas                             | tecnico                |
| `/painel/perguntas/importar`    | Importador (TIME_07)                           | tecnico                |
| `/painel/colaboradores`         | Colaboradores, PINs, importação                | tecnico                |
| `/painel/colaboradores/cartoes` | Impressão dos cartões de acesso                | tecnico                |
| `/painel/setores`               | Setores e locais com QR                        | tecnico                |
| `/painel/eventos`               | Calendário de DDS/SIPAT/treinamentos           | cipa                   |
| `/painel/relatos`               | Kanban de relatos                              | cipa (ações: tecnico)  |
| `/painel/respeito`              | Canal de Respeito                              | **comite_assedio**     |
| `/painel/ranking`               | Rankings                                       | cipa                   |
| `/painel/analytics`             | Analytics e mapa de lacunas (TIME_09)          | cipa                   |
| `/painel/relatorios`            | Relatório de evidência e comparativo (TIME_09) | cipa                   |
| `/painel/certificados`          | Certificados emitidos                          | cipa                   |
| `/painel/materiais`             | Cartazes e QR Codes (PNG)                      | tecnico                |
| `/painel/configuracoes`         | Empresa, termo LGPD, usuários                  | **admin**              |

## 2. Menu lateral

🏠 Início · 🏆 Campanhas · ❓ Perguntas · 👷 Colaboradores · 🏭 Setores e Locais · 📅 Eventos ·
📢 Relatos · 💜 Canal de Respeito _(só comitê)_ · 🥇 Ranking · 📈 Analytics · 📄 Relatórios ·
🎓 Certificados · 🖼️ Materiais · 📺 Modo TV · ⚙️ Configurações _(só admin)_ · 🚪 Sair

No topo: nome da empresa, nome do técnico, chip da campanha ativa ("T4 2026 · faltam 42 dias").

## 3. Início (dashboard)

**Cards:**

- 🏆 Campanha ativa (nome, período, dias restantes) ou botão "Criar campanha"
- 👷 Participação: % dos colaboradores ativos com alguma atividade nos últimos 7 dias
- 📢 Relatos aguardando validação (clicável → `/painel/relatos`)
- 🔴 Relatos de gravidade **alta** não resolvidos há mais de 3 dias (alerta)
- 🧠 Taxa de acerto geral da campanha
- 📅 Próximo evento

**Blocos:**

- Gráfico de linha: pessoas ativas por dia (últimos 30 dias)
- Top 5 colaboradores e ranking de setores (mini tabelas)
- "Onde reforçar": as 3 piores combinações setor × tema do mapa de lacunas, com botão
  "Agendar DDS sobre este tema" (abre o form de evento já preenchido)
- Alertas: colaboradores bloqueados por PIN, colaboradores sem primeiro acesso

## 4. Campanhas

### Lista

Cards com status (Rascunho cinza / Ativa verde / Encerrada azul), período e participantes.

### Criar/editar (form)

Nome · descrição · início · fim · temas (multi-seleção, obrigatório ≥ 1) · perguntas por dia (1–20, padrão 5) ·
premiação (texto) · ranking visível (switch) · **pontos avançados** (acordeão que edita `config`,
com os padrões do TIME_08 como placeholder).

### Detalhe — abas

1. **Visão geral**: números da campanha e botões **Ativar** / **Encerrar**.
   - Encerrar abre confirmação: "Isso congela o ranking, concede os selos finais e emite os
     certificados. Não dá para desfazer." + campo "Quantos destaques gerais recebem certificado?" (padrão 3).
2. **Trilha**: lista ordenável (arrastar) de lições. Form da lição:
   título · tema · conteúdo em Markdown (editor com pré-visualização) · link de vídeo (YouTube) ·
   carga horária em minutos · nota mínima (padrão 70) · obrigatória · publicada ·
   **perguntas da avaliação** (buscar no banco por tema e marcar; recomendado 3 a 5).
3. **Eventos** da campanha (atalho para o calendário filtrado).
4. **Ranking** da campanha.
5. **Resultados** (só encerrada): ranking congelado, selos e certificados emitidos.

## 5. Perguntas

- Filtros: tema, status, origem (manual/importação/global), dificuldade, busca por texto.
- Card expansível (padrão do V.O.Z.E.S.): enunciado, alternativas com a correta destacada,
  explicação, tema, dificuldade, **taxa de acerto** (de `v_desempenho_pergunta`).
- CRUD em modal: 2 a 5 alternativas (A–E), marcar a correta clicando, explicação (recomendada),
  dificuldade 1–3, tema.
- Perguntas globais (sem empresa): só leitura, com botão **"Copiar para minha empresa"**.
- Botões: **Importar** (TIME_07) · **Exportar TXT** (mesmo formato da importação).

## 6. Colaboradores

Tabela: matrícula · nome · setor · turno · status (ativo/inativo) · 1º acesso feito ·
LGPD aceito · bloqueado · pontos na campanha.

Ações:

- **Importar CSV**: botão "Baixar modelo" (`matricula;nome;setor;turno`, aceitar `;` ou `,`),
  pré-visualização com erros por linha, depois chama `tecnico_importar_colaboradores`.
  Ao final: "X novos, Y atualizados. Gerar PIN para os novos?" → gera e abre os cartões.
- **Novo colaborador** (form) → ao salvar, oferece gerar PIN.
- **Gerar novo PIN** (seleção múltipla) → `tecnico_gerar_pins` → tela de cartões.
- **Desbloquear**, **Editar**, **Desativar**.
- **Exportar dados** (LGPD, JSON) e **Anonimizar** (só admin, confirmação dupla).

### Cartões de acesso (`/painel/colaboradores/cartoes`)

Recebe a lista devolvida por `tecnico_gerar_pins` via estado da rota (não salvar em lugar nenhum).
Layout A4 com 8 cartões, botão Imprimir. Ao sair da tela: "Os PINs não poderão ser vistos
de novo. Já imprimiu?"

## 7. Setores e Locais

- Setores: nome, cor (usada nos gráficos e na TV), ativo.
- Locais (dentro do setor): nome ("Prensa 03", "Painel elétrico QGBT", "Refeitório"), descrição.
- Cada local tem **QR Code** → `{origin}/app/local/{id}`: ao escanear, o colaborador vai direto
  para "Relatar risco neste local". Botões: baixar PNG, imprimir etiqueta (10×7 cm) com
  nome do local + "Viu um risco aqui? Escaneie e relate."

## 8. Eventos (calendário)

Reaproveitar `CalendarioGrid` e `EventoForm` do V.O.Z.E.S. com os tipos:
🗣️ DDS (azul) · 🎪 SIPAT (laranja) · 🎓 Treinamento (verde) · 📌 Outro (cinza).
Campos: título · tipo · início/fim (data e hora) · setor (vazio = todos) · pontos do check-in
(padrão: DDS 5, SIPAT 15, Treinamento 15) · campanha (padrão: a ativa) · descrição.
No detalhe do evento:

- **"Abrir check-in na TV"** → `/tv/checkin/$eventoId`
- **"Iniciar quiz na TV"** → `/tv?evento=$eventoId`
- **Lista de presença** (check-ins com nome, setor, hora) + Exportar CSV/PDF

## 9. Relatos (kanban)

Colunas: **Novos** (aberto) · **Em análise** · **Em correção** · **Resolvidos**.
Filtro extra para ver **Rejeitados** e **Duplicados**. Filtros: setor, local, categoria, gravidade, período.

Card: miniatura da foto, ícone da categoria, setor/local, "há 2 dias", badge ⚠️ "Possível duplicado".

Gaveta de detalhe:

- Foto grande (signed URL, 5 min), descrição, relator (nome + setor), data/hora.
- Se for possível duplicado: mostra o relato original lado a lado.
- **Ações para relato novo**:
  - ✅ **Validar** → escolher gravidade (Baixa/Média/Alta) + mensagem ao colaborador (opcional)
  - ❌ **Rejeitar** → motivo (obrigatório, vai para o colaborador)
  - 🔁 **Duplicado** → escolher o original
- **Ações para relato validado**: mover para Em correção / Resolvido, com comentário;
  checkbox "Visível para o colaborador" (desmarcado = anotação interna).
- Histórico completo.
- Exportar CSV (período filtrado).

## 10. Canal de Respeito (só `comite_assedio`)

- Faixa fixa no topo: "🔒 Área sigilosa. As informações aqui não podem ser compartilhadas fora do comitê."
- Lista: protocolo · categoria · recebida em (data) · status · quer retorno.
- Detalhe: descrição, local/período aproximados, conversa (mensagens com data), campo de resposta,
  mudar status (Recebida → Em apuração → Concluída / Arquivada) via `comite_responder_denuncia`.
- Nada do Canal aparece em dashboards, rankings, analytics ou relatórios gerais.
  Só um contador "Denúncias sem resposta" visível para o comitê no Início.

## 11. Ranking

- Seletor de campanha (ativas e encerradas; encerradas leem `campanha_resultados`).
- Aba **Individual**: posição, nome completo, setor, total, conhecimento, relatos, engajamento, selos.
  Filtro por setor. Medalhas 🥇🥈🥉.
- Aba **Setores**: posição, setor, média individual, pontos do Modo TV, total, nº de colaboradores.
- Exportar CSV.

## 12. Certificados

Lista por campanha: colaborador, tipo, título, código, emissão. Botões **Ver/Imprimir** (modelo
no TIME_09 §5) e **Imprimir todos** da campanha.

## 13. Materiais (PNG, reaproveitando `CartaoCampanha`)

1. **Cartaz "Entre no T.I.M.E."** (A4 e 16:9): QR do app, 3 passos ("Escaneie · Aprenda · Pontue"),
   período da campanha, premiação.
2. **Cartaz do Canal de Respeito** (A4): QR para `/respeito/{codigo}`, texto de anonimato,
   telefones 180, 100 e 190.
3. **Etiquetas de locais** (seção 7).
4. **Cartões de acesso** (seção 6).

## 14. Configurações (admin)

- Empresa: nome, logo (upload para bucket público `logos`), código (só leitura depois de criado).
- Termo LGPD: editor + botão **"Publicar nova versão"** (incrementa `termo_lgpd_versao`;
  aviso: "Todos terão que aceitar de novo").
- Usuários do painel: lista de `perfis_tecnicos` com papel e flag de comitê (edição via SQL nesta versão).
