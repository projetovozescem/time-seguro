# TIME_05 — App do Colaborador (PWA, mobile first)

Base: área do aluno do V.O.Z.E.S. (layout máx. 480px centralizado, PWA instalável,
abertura animada). Toda a comunicação é por `rpcApp()` (TIME_03 §3).

Princípios de UX para chão de fábrica:

- Botões grandes (mín. 48px de altura), texto curto, ícone + palavra.
- Funciona com **uma mão**, com luva fina e em tela suja: alvos de toque generosos.
- Contraste alto (uso sob sol e em galpão escuro).
- Nada de termos em inglês. "Sequência", não "streak".

## 1. Rotas

| Rota                   | Tela                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| `/app`                 | `start_url` do PWA → redireciona para `/app/inicio` ou `/app/entrar` |
| `/app/entrar`          | Login (aceita `?empresa=codigo`)                                     |
| `/app/novo-pin`        | Troca obrigatória do PIN provisório                                  |
| `/app/termo`           | Termo LGPD                                                           |
| `/app/inicio`          | Home                                                                 |
| `/app/quiz`            | Quiz do dia                                                          |
| `/app/trilha`          | Lista de lições                                                      |
| `/app/trilha/$licaoId` | Lição + avaliação                                                    |
| `/app/relatar`         | Novo relato (aceita `?local=id`)                                     |
| `/app/local/$localId`  | Entrada pelo QR de um local → abre relatar com local preenchido      |
| `/app/relatos`         | Meus relatos                                                         |
| `/app/checkin`         | Check-in (`?e=eventoId&c=CODIGO`, vindo do QR da TV)                 |
| `/app/ranking`         | Ranking                                                              |
| `/app/perfil`          | Selos, extrato, certificados, trocar PIN, termo, sair                |

Público, **fora** do layout do app: `/respeito/$codigo` e `/verificar/$codigo` (TIME_03 §6).

Navegação inferior fixa (5 itens): 🏠 Início · ❓ Quiz · 📚 Trilha · 📢 Relatar · 👤 Perfil

## 2. Entrar

- Logo T.I.M.E. + nome/logo da empresa (via `empresa_publica`).
- Campo **Código da empresa** (preenchido e oculto se veio no QR ou já foi lembrado; link "Trocar empresa").
- **Matrícula** (`inputmode="numeric"` se a empresa usar só números; senão texto).
- **PIN**: 6 caixinhas, teclado numérico, botão 👁️ mostrar.
- Botão **Entrar**. Erros amigáveis (tabela §9).
- Rodapé: "Esqueceu o PIN? Procure o técnico de SST." + link discreto 💜 **Canal de Respeito**.

## 3. Novo PIN e Termo

- **Novo PIN**: "Crie seu PIN de 6 números. Não use 123456 nem números repetidos." PIN atual + novo + confirmar.
- **Termo**: texto do termo (rolagem), checkbox "Li e entendi", botão **Li e aceito**.
  Sem aceite, nada funciona (as RPCs devolvem `aceitar_lgpd`).

## 4. Início

Dados de `colaborador_resumo`.

```
┌──────────────────────────────┐
│ Olá, Carlos! 👷  Manutenção   │
│ 🏆 T4 2026 · faltam 42 dias   │
├──────────────────────────────┤
│   1.240 pts   🔥 6 dias        │
│   #4 geral · setor #2          │  (se ranking visível)
│ 🧠 ████████░░  820            │
│ 📢 ███░░░░░░░  300            │
│ 🔥 ██░░░░░░░░  120            │
├──────────────────────────────┤
│ MISSÕES DE HOJE               │
│ ❓ Quiz do dia        2/5  ▶  │
│ 📚 Próxima lição: NR-35   ▶  │
│ 📢 Viu um risco? Relate   ▶  │
├──────────────────────────────┤
│ 🎁 Prêmio: <premiacao>        │
└──────────────────────────────┘
```

- Sem campanha ativa: tela "Nenhuma campanha no momento. Fique de olho nos avisos da SST!"
  com acesso a Meus relatos, Perfil e Certificados.
- Ao ganhar selo em qualquer tela (`novos_selos` na resposta): modal de conquista com confete
  (canvas-confetti) e o ícone grande do selo.

## 5. Quiz do dia

Reaproveitar o fluxo do V.O.Z.E.S. (`aluno.$turmaId.quiz.tsx`), trocando a RPC:

1. `colaborador_perguntas_do_dia` → lista (já respondidas aparecem com resultado).
2. Tela da pergunta: chip do tema (ícone + nome), "Pergunta 2 de 5", enunciado, 2–5 alternativas
   com letra em círculo. Cronômetro invisível mede `tempo_ms`.
3. Toque → `colaborador_responder_pergunta` → verde ✅ / vermelho ❌ + **explicação** + "+10 pts".
4. Última pergunta → resumo do dia: acertos, pontos de hoje, sequência 🔥, botão "Ir para a trilha".
5. Todas respondidas: "Você já fez o quiz de hoje. Volte amanhã! 🔥 Não quebre a sequência."

## 6. Trilha

- Lista (de `colaborador_trilha`) em formato de **caminho** vertical: cada lição é um nó com
  ícone do tema, título, duração ("10 min"), estado: 🔒 não iniciada · 📖 conteúdo lido ·
  ✅ aprovada (nota) · ⭐ obrigatória.
- **Lição** (`colaborador_licao`):
  1. Conteúdo em Markdown renderizado (usar `react-markdown`, sem HTML bruto) + vídeo do
     YouTube incorporado (se houver).
  2. Botão **"Terminei de estudar"** → `colaborador_concluir_conteudo` (+20 pts na 1ª vez).
  3. **Avaliação**: todas as perguntas numa tela com rolagem, botão Enviar →
     `colaborador_enviar_avaliacao` → nota, aprovado/reprovado, gabarito comentado.
  4. Reprovado: "Faltou pouco! Revise o conteúdo e tente de novo." (máx. 3 tentativas por dia).

## 7. Relatar risco

Passo a passo em uma tela:

1. **O que você viu?** (4 cartões grandes):
   ⚠️ Condição insegura · 🚶 Ato inseguro · 😰 Quase-acidente · 💡 Sugestão de melhoria
2. **Onde?** Local (se veio do QR, já preenchido e travado) ou setor (padrão: o do colaborador).
3. **Conte o que aconteceu** (mín. 10 caracteres, contador).
4. **Foto (opcional)**: `<input type="file" accept="image/*" capture="environment">`,
   pré-visualização, aviso "📷 Fotografe o risco, não as pessoas."
5. **Enviar** → `colaborador_criar_relato` → se tiver foto, fluxo da Edge Function (TIME_03 §5).
6. Tela de sucesso: "Relato enviado! O técnico vai analisar. Você ganha pontos quando ele for validado."

Aviso fixo no topo: "🚨 Emergência ou risco grave e iminente? Pare e avise o líder/SESMT agora.
O app não substitui a comunicação imediata."

### Meus relatos

Lista com chip de status colorido e linha do tempo (mensagens do técnico).
Status em linguagem simples: Enviado · Em análise · Em correção · Resolvido ✅ · Não validado · Já relatado.

## 8. Check-in, Ranking e Perfil

- **Check-in**: o QR da TV abre `/app/checkin?e=...&c=...`. Se não estiver logado, faz login e volta.
  Tela: título do evento, botão **Confirmar presença** → `colaborador_checkin` → "+5 pts. Bom DDS!".
- **Ranking** (`colaborador_ranking`): abas **Pessoas** (top 10 + "Você: #14") e **Setores**
  (meu setor destacado). Se oculto: "O ranking será revelado no fim da campanha."
- **Perfil** (`colaborador_perfil`): grade de selos (conquistados coloridos, demais em cinza com a
  regra), extrato de pontos (origem traduzida: "Acerto no quiz", "Lição aprovada", "Relato validado",
  "Presença no DDS", "Sequência de 7 dias"...), certificados (abrir/baixar PNG), trocar PIN, ver termo, **Sair**.

## 9. Mensagens para cada `motivo`

| motivo                 | Mensagem                                                                     |
| ---------------------- | ---------------------------------------------------------------------------- |
| credenciais_invalidas  | Matrícula ou PIN incorretos.                                                 |
| bloqueado              | Muitas tentativas. Tente de novo em 15 minutos ou fale com o técnico de SST. |
| pin_atual_incorreto    | PIN atual incorreto.                                                         |
| pin_fraco              | PIN fraco. Use 6 números sem repetir ou seguir sequência.                    |
| sem_campanha           | Nenhuma campanha ativa no momento.                                           |
| pergunta_invalida      | Esta pergunta não está disponível hoje.                                      |
| ja_respondida          | Você já respondeu esta pergunta hoje.                                        |
| licao_invalida         | Lição não encontrada.                                                        |
| conteudo_nao_concluido | Estude o conteúdo antes da avaliação.                                        |
| limite_tentativas      | Você usou as 3 tentativas de hoje. Volte amanhã!                             |
| evento_invalido        | Evento não encontrado.                                                       |
| fora_do_horario        | O check-in deste evento não está aberto agora.                               |
| outro_setor            | Este evento é de outro setor.                                                |
| codigo_expirado        | Código expirado. Escaneie de novo o QR da TV.                                |
| ja_fez_checkin         | Presença já confirmada! ✅                                                   |
| descricao_curta        | Conte um pouco mais (mínimo 10 letras).                                      |
| limite_diario          | Você já enviou muitos relatos hoje. Fale direto com o técnico.               |
| local_invalido         | Local não encontrado.                                                        |
| ranking_oculto         | O ranking será revelado no fim da campanha.                                  |

## 10. PWA

- Reaproveitar `manifest.webmanifest`, `sw.js` e `BotaoInstalar` do V.O.Z.E.S. com:
  `name: "T.I.M.E. Seguro"`, `short_name: "T.I.M.E."`, `start_url: "/app"`, `scope: "/app"`,
  `theme_color: "#0B3C5D"`, `background_color: "#F4F6F9"`, ícones novos (escudo + capacete).
- Service worker: igual ao original (network-first em navegação, nunca cacheia chamadas ao Supabase),
  registrado **só** em `/app/*`.
- Abertura animada: escudo pulsando + "T.I.M.E." + nome da empresa (1 vez por sessão).
