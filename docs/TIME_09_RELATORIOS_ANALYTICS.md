# TIME_09 — Relatórios, Analytics e Certificados

Base: `useAnalytics`, `ExportarAnalytics` (CSV/PDF com jspdf + html2canvas) e componentes de gráfico
do V.O.Z.E.S. Todas as consultas usam o supabase-js autenticado (RLS da empresa).

## 1. Analytics (`/painel/analytics`)

Filtros no topo: campanha · período · setor · tema. Abas:

### 1.1 Visão geral

- Cards: colaboradores ativos · % que participou (≥ 1 ação) · respostas · taxa de acerto ·
  lições aprovadas · relatos (recebidos / validados / resolvidos) · check-ins
- Linha: pessoas ativas por dia
- Barras: pontos por pilar (conhecimento / relatos / engajamento) por semana
- Funil de adesão: colaboradores cadastrados → 1º acesso → termo aceito → 1ª ação → ativos na última semana

### 1.2 🔍 Mapa de lacunas (o diferencial)

Matriz **setor (linhas) × tema (colunas)** de `v_lacunas`, célula = taxa de acerto:

| Faixa          | Cor                       | Leitura                           |
| -------------- | ------------------------- | --------------------------------- |
| ≥ 80%          | verde `#2E7D32`           | domina o tema                     |
| 60–79%         | amarelo `#FFC400`         | atenção                           |
| < 60%          | vermelho `#C62828`        | **lacuna: priorizar treinamento** |
| < 10 respostas | cinza com padrão listrado | dados insuficientes               |

- A célula mostra o número (%) além da cor (acessível para daltônicos).
- Clique na célula → gaveta com as **5 perguntas mais erradas** daquele setor+tema, a alternativa
  errada mais escolhida (`v_desempenho_pergunta`) e botões **"Agendar DDS sobre este tema"** e
  **"Criar lição"**.
- Exportar PNG (para colar em apresentação) e CSV.

### 1.3 Perguntas

Tabela de `v_desempenho_pergunta`: enunciado, tema, tentativas, % acerto, alternativa errada
mais comum. Ordenar pelas mais erradas. Serve para revisar perguntas mal formuladas.

### 1.4 Relatos

- Por categoria, gravidade e setor (barras)
- Tempo médio: aberto → validado e validado → resolvido
- Mapa de calor por **local** (quais pontos concentram riscos)
- % de relatos resolvidos

### 1.5 Engajamento

- Distribuição da sequência de dias (quantos com 0, 1–6, 7–14, 15+)
- Participação em eventos (check-ins por evento)
- Horários de uso (útil para escolher horário de DDS)

## 2. 📄 Relatório de Evidência de Treinamento (`/painel/relatorios`)

Para auditorias, gestão e CIPA. Gerado em **PDF** (e CSV com os mesmos dados).

**Parâmetros**: campanha · lição(ões) ou "trilha completa" · setor (opcional).

**Conteúdo do PDF:**

1. Cabeçalho: logo e nome da empresa, título, campanha, período, data de emissão, técnico responsável
2. Resumo: colaboradores do escopo, concluintes, % de conclusão, nota média, carga horária por lição
3. Tabela por lição: matrícula · nome · setor · data de conclusão · nota · tentativas · situação (Aprovado / Pendente)
4. Presença em eventos do período (DDS/SIPAT/Treinamento): evento, data, presentes
5. Campo de assinatura: "Técnico de Segurança do Trabalho" e "Representante da CIPA"
6. Rodapé em todas as páginas: número da página e o **aviso obrigatório**:

> _"Este relatório registra ações complementares de capacitação e conscientização realizadas
> na plataforma T.I.M.E. Seguro. Não substitui os treinamentos obrigatórios previstos
> nas Normas Regulamentadoras, que devem seguir carga horária, conteúdo programático e
> requisitos próprios de cada NR."_

### Relatório de prevenção ao assédio (CIPA+A)

Versão do relatório focada no tema `assedio`: colaboradores capacitados na lição de assédio,
datas, e **somente números agregados** do Canal de Respeito (quantidade recebida por mês e por
status) — **nunca** conteúdo, protocolo ou categoria individual. Gerar só para quem tem `comite_assedio`.
Serve de evidência da ação de capacitação periódica exigida pela Lei 14.457/2022.

## 3. 📈 Comparativo trimestral

Fonte: `campanha_resultados` (campanhas encerradas) + agregados da campanha ativa.
Selecionar 2 a 4 campanhas → gráficos lado a lado:

- Participação (% de ativos) por campanha
- Taxa de acerto geral e por tema (barras agrupadas)
- Mapa de lacunas de antes × depois (setas ▲▼ em cada célula)
- Relatos: recebidos, validados, resolvidos, tempo médio de resolução
- Ranking de setores de cada trimestre
  Texto automático no topo, ex.: "A taxa de acerto em NR-12 no setor Usinagem subiu de 54% para 78%."
  (gerado por regras simples: maiores variações positivas e negativas).
  Exportar PDF para a gestão.

## 4. Exportações

| Onde                        | CSV | PDF | PNG     |
| --------------------------- | --- | --- | ------- |
| Analytics (cada aba)        | ✅  | ✅  | gráfico |
| Mapa de lacunas             | ✅  | ✅  | ✅      |
| Evidência de treinamento    | ✅  | ✅  | —       |
| Comparativo                 | ✅  | ✅  | —       |
| Ranking                     | ✅  | —   | —       |
| Lista de presença do evento | ✅  | ✅  | —       |
| Relatos                     | ✅  | —   | —       |

CSV sempre com `;` e BOM UTF-8 (abre certo no Excel brasileiro).

## 5. 🎓 Certificados

Gerados como **PNG/PDF no navegador** (html2canvas + jspdf), a partir da tabela `certificados`.

**Layout (A4 paisagem):**

- Borda com faixa zebrada amarelo/preto discreta nos cantos (identidade de segurança)
- Logo T.I.M.E. + logo da empresa
- Título: "Certificado de Destaque" ou "Certificado de Conclusão"
- Texto destaque: _"Certificamos que **[NOME COMPLETO]**, do setor [SETOR], conquistou o
  **[1º lugar geral / destaque do setor]** na campanha **[NOME]**, realizada de [INÍCIO] a [FIM],
  pelo compromisso com a segurança e o respeito no ambiente de trabalho."_
- Texto conclusão: _"...concluiu a trilha de capacitação da campanha [NOME], com carga horária
  de [X] horas e [Y] minutos, na plataforma T.I.M.E. Seguro."_
- Selos conquistados (ícones pequenos)
- Assinatura do técnico (nome digitado) e data de emissão
- QR + código `TIME-XXXXXXXXXX` → `/verificar/{codigo}`

**`/verificar/$codigo`** (pública): chama `verificar_certificado` e mostra
"✅ Certificado válido", título, colaborador (nome curto), empresa, campanha, emissão.
