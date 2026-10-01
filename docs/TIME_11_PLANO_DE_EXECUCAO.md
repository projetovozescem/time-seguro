# TIME_11 — Plano de Execução no Claude Code

## 0. Antes de tudo

1. Copie o repositório do V.O.Z.E.S. para uma pasta nova `time-seguro` e inicie um git novo.
2. Crie a pasta `docs/` e coloque **todos** os `TIME_*.md` dentro. Coloque o `CLAUDE.md` na raiz
   (substituindo o antigo).
3. Crie um **projeto novo no Supabase** e anote URL, anon key e service role key.
4. Tenha à mão do Max Games: `src/utils/parseFile.js`, `pdfQuestions.js`, `questionValidation.js`,
   `exportQuestions.js`, `src/hooks/gameReducer.js` e os testes. Copie para `docs/legado-maxgames/`.
5. Trabalhe **uma fase por sessão** do Claude Code. No fim de cada fase: testar, `git commit`.

> 💡 Dica: comece cada sessão com _"Leia o CLAUDE.md e o docs/TIME_XX antes de começar."_

## 1. Prioridade: MVP para o prêmio (até 05/10/2026)

Com 5 dias, a meta é ter **funcionando e demonstrável**:

| Fase | Entrega                                    | Essencial para o prêmio?                     |
| ---- | ------------------------------------------ | -------------------------------------------- |
| 0    | Setup e limpeza                            | ✅                                           |
| 1    | Banco completo                             | ✅                                           |
| 2    | Auth do painel + colaboradores + PINs      | ✅                                           |
| 3    | Perguntas + importador                     | ✅                                           |
| 4    | Campanha + trilha + eventos                | ✅                                           |
| 5    | App do colaborador                         | ✅                                           |
| 6    | Relatos com foto + validação               | ✅                                           |
| 7    | Canal de Respeito                          | ✅ (argumento da Lei 14.457)                 |
| 8    | Modo TV (Clássico + check-in)              | ✅ Clássico · ⏳ Duelo/Eliminação depois     |
| 9    | Ranking, selos, encerramento, certificados | ✅ ranking · ⏳ certificado pode ser simples |
| 10   | Analytics, mapa de lacunas, relatório      | ✅ mapa de lacunas · ⏳ comparativo          |
| 11   | Materiais, polimento, deploy               | ✅ deploy + cartaz                           |

⏳ = pode ficar para depois da inscrição (descrever como "em desenvolvimento" no formulário).

## 2. Prompts por fase

### Fase 0 — Setup e limpeza

```
Leia CLAUDE.md e docs/TIME_00_INDICE.md. Este repositório é uma cópia do V.O.Z.E.S. e vai
virar o T.I.M.E. Seguro.
1. Renomeie o projeto no package.json para "time-seguro".
2. Remova: pasta drizzle/, supabase/migrations/*, src/lib/auth.ts (senha fixa),
   src/lib/participante.ts e as rotas/componentes de turmas, participantes, compartilhamentos
   e respostas de alunos. Mantenha (vamos adaptar): layout do professor, calendário
   (CalendarioGrid, EventoForm), analytics (componentes de gráfico e ExportarAnalytics),
   CartaoCampanha, BotaoInstalar, Quiz TV, manifest e sw.js.
3. Configure .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY do projeto novo.
4. Aplique a identidade do docs/TIME_10 no src/styles.css (@theme) e troque textos
   "V.O.Z.E.S." por "T.I.M.E. Seguro".
5. Garanta que `npm run dev` sobe sem erros (pode haver telas vazias).
Liste o que removeu e o que manteve.
```

### Fase 1 — Banco de dados

```
Leia docs/TIME_02_BANCO_DE_DADOS.md. Crie os 6 arquivos de migração em supabase/migrations/
exatamente com o SQL das seções 5.1 a 5.6 (não altere o SQL; ele foi testado).
Depois: npx supabase link e npx supabase db push. Gere os tipos em src/lib/database.types.ts.
Crie o bucket e a policy de storage da seção 4 (me dê o SQL para eu rodar no SQL Editor).
Por fim me passe o passo a passo do bootstrap (empresa + meu usuário admin + comite_assedio).
```

### Fase 2 — Acesso do painel e colaboradores

```
Leia docs/TIME_03_SEGURANCA_LGPD.md (§1 a §4) e docs/TIME_04_PAINEL_TECNICO.md (§1, §2, §6, §7).
1. Login do técnico com Supabase Auth em /painel/login, recuperação de senha, guard das rotas
   /painel/*, contexto usePerfil() com papel e comite_assedio, menu lateral conforme o papel.
2. Tela /painel/setores: CRUD de setores e locais, QR de cada local (PNG e etiqueta).
3. Tela /painel/colaboradores: tabela, filtros, cadastro, importação CSV com pré-visualização
   (tecnico_importar_colaboradores), gerar PIN (tecnico_gerar_pins), desbloquear, desativar,
   anonimizar (admin) e exportar dados em JSON.
4. Tela /painel/colaboradores/cartoes: 8 cartões por A4 com PIN provisório e QR do app.
   Os PINs vêm pelo estado da rota e NUNCA são salvos.
Escreva testes para o parser do CSV de colaboradores.
```

### Fase 3 — Perguntas e importador

```
Leia docs/TIME_07_IMPORTACAO_PERGUNTAS.md. Os arquivos originais do Max Games estão em
docs/legado-maxgames/. Porte para TypeScript em src/lib/importacao/ com as mudanças da tabela §1
(campos Tema, Explicação, Dificuldade; alternativas A–E; sem palavra-chave).
Crie /painel/perguntas (lista, filtros, CRUD em modal, perguntas globais só leitura com
"Copiar para minha empresa", exportar TXT) e /painel/perguntas/importar (abas arquivo, colar
texto, banco global → tema padrão → revisão → salvar em lote).
Rode os testes do §7. Depois importe o arquivo do docs/TIME_12 para validar.
```

### Fase 4 — Campanhas, trilha e eventos

```
Leia docs/TIME_04 §4 e §8 e docs/TIME_08.
1. /painel/campanhas e /painel/campanhas/$id com as abas Visão geral, Trilha, Eventos, Ranking,
   Resultados. Ativar via tecnico_ativar_campanha. "Pontos avançados" editando campanhas.config
   com os padrões do TIME_08 como placeholder.
2. Editor de lição: Markdown com pré-visualização (react-markdown), vídeo do YouTube, carga,
   nota mínima, obrigatória, publicada, seleção de perguntas da avaliação (licao_perguntas),
   ordenação por arrastar.
3. Adapte o calendário do V.O.Z.E.S. para /painel/eventos com os tipos dds/sipat/treinamento/outro,
   pontos, setor, campanha e a lista de presença (checkins) com exportação CSV.
```

### Fase 5 — App do colaborador

```
Leia docs/TIME_05_APP_COLABORADOR.md inteiro e docs/TIME_03 §3.
Crie src/lib/sessao.ts e src/lib/rpc.ts (rpcApp) exatamente como no TIME_03.
Implemente as rotas /app/* : entrar, novo-pin, termo, inicio, quiz, trilha, trilha/$licaoId,
ranking, perfil, checkin. Navegação inferior com 5 itens. Modal de selo conquistado com confete.
Adapte o PWA (manifest, sw.js, BotaoInstalar) conforme §10, com scope /app.
Mapeie todos os "motivo" para as mensagens da tabela §9 num único arquivo src/lib/mensagens.ts.
Teste o fluxo completo: login com PIN provisório → trocar PIN → aceitar termo → quiz → lição.
```

### Fase 6 — Relatos

```
Leia docs/TIME_05 §7, docs/TIME_04 §9 e docs/TIME_03 §5.
1. Crie a Edge Function supabase/functions/relato-upload-url com o código do TIME_03 §5 e faça deploy.
2. App: /app/relatar (categorias, local/setor, descrição, foto com compressão para JPEG 1280px),
   /app/local/$localId (QR do local), /app/relatos (lista + linha do tempo).
3. Painel: /painel/relatos em kanban com gaveta de detalhe, foto por signed URL, badge de possível
   duplicado com comparação lado a lado, ações validar/rejeitar/duplicado (tecnico_validar_relato)
   e andamento (tecnico_atualizar_relato), exportar CSV.
```

### Fase 7 — Canal de Respeito

```
Leia docs/TIME_01 §7, docs/TIME_03 §6 e docs/TIME_04 §10.
1. Página pública /respeito/$codigo FORA do layout do app e SEM enviar token: formulário
   (categoria, relato, local e período aproximados, quer retorno), tela de protocolo + senha
   mostrados uma vez com botão copiar, e área "Acompanhar denúncia" (consultar_denuncia e
   responder_denuncia_denunciante). Mostrar Disque 180, Disque 100 e 190. Visual do TIME_10 §6.
2. Painel /painel/respeito só para comite_assedio (comite_responder_denuncia).
3. Link discreto 💜 no login e no perfil do app que abre /respeito/{codigo} sem token.
Confira na aba Rede do navegador que nenhuma chamada dessa página leva p_token.
```

### Fase 8 — Modo TV

```
Leia docs/TIME_06_MODO_TV.md. Adapte o Quiz TV do V.O.Z.E.S. para /tv e /tv/jogo (modo Clássico)
e crie /tv/checkin/$eventoId com QR rotativo (tecnico_rotacionar_codigo a cada 60 s) e contador
de presentes. Salve com tecnico_salvar_quiz_tv. Depois porte o reducer do Max Games
(docs/legado-maxgames/gameReducer.js) para src/lib/jogos/reducer.ts mantendo só Quiz por Tempo
(Duelo de Setores) e Eliminação, com os testes.
```

### Fase 9 — Ranking, selos, encerramento e certificados

```
Leia docs/TIME_08 e docs/TIME_09 §5. Crie /painel/ranking (individual e setores, campanhas
encerradas via campanha_resultados, CSV), o botão Encerrar com confirmação
(tecnico_encerrar_campanha), /painel/certificados, o modelo de certificado em PNG/PDF e a
página pública /verificar/$codigo. No app, certificados no perfil.
```

### Fase 10 — Analytics e relatórios

```
Leia docs/TIME_09. Adapte o analytics do V.O.Z.E.S. para /painel/analytics com as abas do §1,
dando prioridade ao MAPA DE LACUNAS (§1.2) com a gaveta de perguntas mais erradas e o atalho
"Agendar DDS sobre este tema". Depois /painel/relatorios com o Relatório de Evidência em PDF
(com o aviso obrigatório no rodapé), o relatório CIPA+A (só números agregados do Canal) e o
comparativo trimestral. CSV sempre com ; e BOM.
```

### Fase 11 — Materiais, dados de demonstração e deploy

```
1. /painel/materiais: cartaz "Entre no T.I.M.E.", cartaz do Canal de Respeito, etiquetas de
   locais (reaproveitar CartaoCampanha).
2. Script scripts/seed-demo.sql que cria a "Empresa Demonstração" (código demo) com 4 setores,
   30 colaboradores fictícios, 1 campanha, respostas, relatos e eventos distribuídos em 3 semanas,
   para prints e apresentação. Todo nome fictício deve ser claramente fictício.
3. Revise o checklist do docs/TIME_03 §8.
4. Deploy (Vercel/Netlify/Cloudflare Pages) com as duas variáveis VITE_*. Configure a URL do site
   no Supabase Auth (Site URL e Redirect URLs).
```

## 3. ⚠️ Honestidade na inscrição

- **Dados de demonstração não são resultados.** Prints da "Empresa Demonstração" devem ser
  apresentados como _demonstração do sistema_, nunca como uso real. Informação falsa pode
  desclassificar o projeto.
- **TRL**: a base (V.O.Z.E.S.) já foi usada por estudantes reais; o T.I.M.E. é uma evolução
  recente. Descreva assim: _"protótipo funcional validado em ambiente de testes (TRL 5), com
  componentes-base já testados com usuários reais"_. Se conseguir **um piloto curto** com o técnico
  de SST antes de 05/10 (mesmo 10 colaboradores, 1 DDS), registre com fotos, lista de presença e a
  **declaração de interesse** dele: isso sustenta TRL 6.
- Cite o reaproveitamento de V.O.Z.E.S. e Max Games como **trabalhos anteriores da equipe**.

## 4. Depois do prêmio (roadmap)

- 🤖 Triagem de relatos com IA (Edge Function com a API da Anthropic sugerindo categoria e gravidade
  a partir da foto; o técnico sempre decide)
- 📶 Relatos offline (fila no IndexedDB, envio ao reconectar)
- 🎮 Game Master no celular (Supabase Realtime)
- 🏢 Autoatendimento SaaS: cadastro de empresa, convite de técnicos, planos
- 🔔 Notificações push do PWA (lembrete do quiz, relato resolvido)
- 🧩 Integração com o Caça-Riscos Pixel como mais um modo de jogo
