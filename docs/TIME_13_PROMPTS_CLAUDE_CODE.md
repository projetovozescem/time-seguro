# TIME_13 — Prompts, Skills, AGENTS.md e Agentes (Claude Code)

> Este arquivo reúne tudo para **configurar o repositório** e **rodar o desenvolvimento autônomo**.
> Ordem: §1 instalar → §2 criar arquivos → §3 prompt do piloto → §4 prompt autônomo → §5 retomada.

## 0. Ajustes feitos em relação ao seu rascunho (e por quê)

| Seu rascunho                                   | Ajuste                                                                                   | Motivo                                                                                                    |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `AGENTS.md` com as regras                      | Mantido, mas o `CLAUDE.md` ganha a linha `@AGENTS.md`                                    | O Claude Code lê `CLAUDE.md` sozinho; **não** lê `AGENTS.md` por conta própria. O `@` importa o conteúdo. |
| Agentes em `.github/agents/`                   | Criados em **`.claude/agents/`** (e espelhados em `.github/agents/` se você usa Copilot) | `.github/agents/` é formato do GitHub Copilot. O Claude Code procura em `.claude/agents/`.                |
| `.github/copilot-instructions.md`              | Removido do prompt (opcional)                                                            | Só vale para Copilot. O Claude Code usa `CLAUDE.md` + `AGENTS.md`.                                        |
| Stack "React + Vite"                           | **TanStack Start + React + TypeScript + Tailwind v4 + shadcn/ui**                        | É a stack real herdada do V.O.Z.E.S.                                                                      |
| Pasta `/docs/funcionalidades`                  | **`docs/`** (arquivos `TIME_00` a `TIME_13`)                                             | Combina com o `CLAUDE.md` e com o `TIME_11`.                                                              |
| Spec Kit gera plano e SQL do zero              | O prompt manda **usar o SQL do `TIME_02` sem alterar**                                   | As migrações já foram testadas. O Spec Kit planeja o resto, não refaz o banco.                            |
| Login "colaborador, técnico, administrador"    | Dois fluxos: **técnico/admin = Supabase Auth**; **colaborador = matrícula + PIN**        | É a arquitetura decidida no `TIME_03`.                                                                    |
| Fluxo Spec Kit completo em toda funcionalidade | Há um **modo enxuto** para o prazo de 05/10                                              | Os docs já estão detalhados. `clarify` e `analyze` só quando houver dúvida real.                          |
| Piloto genérico                                | Piloto definido: **login + quiz diário com pontuação**                                   | Cobre as partes mais críticas: auth, RLS, RPC e pontos.                                                   |

## 1. Skills e ferramentas — instalar nesta ordem

> ⚠️ Não verifiquei os comandos de instalação atuais desses repositórios. Por isso o prompt abaixo manda o
> Claude **ler o README de cada um** e instalar do jeito indicado, em vez de eu inventar comandos.

| #   | Ferramenta                                             | Repositório                                            | Tipo                                                 |
| --- | ------------------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------------- |
| 1   | Supabase Agent Plugin (MCP + skills Supabase/Postgres) | https://github.com/supabase-community/supabase-plugin  | instalar                                             |
| 2   | GitHub Spec Kit                                        | https://github.com/github/spec-kit                     | instalar                                             |
| 3   | Superpowers                                            | https://github.com/obra/superpowers                    | instalar                                             |
| 4   | Planning with Files                                    | https://github.com/OthmanAdi/planning-with-files       | instalar                                             |
| 5   | Benjamin-Plus (economia de tokens)                     | https://github.com/JetBrains/benjamin-plus-skill       | **colar** o `injected-instruction.md` no `AGENTS.md` |
| 6   | Karpathy Guidelines                                    | https://github.com/forrestchang/andrej-karpathy-skills | **colar** o `CLAUDE.md` deles no `AGENTS.md`         |

### Prompt de instalação (rode uma vez, no modo normal)

```
Preciso configurar este repositório para desenvolvimento assistido. Para cada item abaixo, abra o
README do repositório, siga as instruções oficiais de instalação para o Claude Code e confirme no
final que funcionou (mostre como verificou). Instale NESTA ORDEM e pare se algum passo falhar:
1. https://github.com/supabase-community/supabase-plugin
2. https://github.com/github/spec-kit  (inicialize no projeto para Claude Code)
3. https://github.com/obra/superpowers
4. https://github.com/OthmanAdi/planning-with-files

Depois, crie/atualize o AGENTS.md na raiz usando o modelo do docs/TIME_13_PROMPTS_CLAUDE_CODE.md §2.1.
Nos marcadores "COLAR AQUI", traga o conteúdo de:
- injected-instruction.md de https://github.com/JetBrains/benjamin-plus-skill
- o CLAUDE.md de https://github.com/forrestchang/andrej-karpathy-skills
Não instale esses dois como skill: só incorpore o texto no AGENTS.md.

Por fim, crie os agentes (§2.2) e o .mcp.json (§2.3). NÃO conecte nada a produção.
Não escreva nenhuma chave em arquivo versionado.
```

## 2. Arquivos de configuração

### 2.1 `AGENTS.md` (raiz)

```markdown
# AGENTS.md — T.I.M.E. Seguro

## Projeto

T.I.M.E. Seguro — Treinar, Identificar, Mobilizar e Evoluir. Plataforma de capacitação em SST/CIPA+A
para a indústria. Especificação completa em `docs/TIME_00` a `docs/TIME_13`. Regras inegociáveis em `CLAUDE.md`.
A base de código é cópia do V.O.Z.E.S.: nunca alterar o projeto original.

## Fonte da verdade

1. `docs/TIME_*.md` (requisitos). Não inventar requisito. Ambiguidade → registrar em `memory/duvidas.md`
   e seguir com a suposição mais segura.
2. `docs/TIME_02_BANCO_DE_DADOS.md`: o SQL ali foi testado. Copiar para `supabase/migrations/` SEM alterar.
   Mudança de banco = nova migration, nunca editar migration já aplicada.

## Stack

TanStack Start + React + TypeScript, Tailwind v4, shadcn/ui, Supabase (Postgres, Auth só para técnicos,
Storage, Edge Functions), Vitest.

## Memória do projeto (ler ANTES de qualquer tarefa)

- `memory/progress.md` — feito, em andamento, próximo, ordem das funcionalidades
- `memory/decisoes.md` — decisões e motivos
- `memory/erros.md` — falhas e abordagens descartadas
- `memory/duvidas.md` — ambiguidades pendentes
  Atualizar ao fim de CADA tarefa.

## Fluxo por funcionalidade (Spec Kit)

constitution (uma vez) → specify → clarify (só se houver dúvida real) → plan → tasks → analyze (só em
funcionalidade grande) → implement. Artefatos em `specs/NNN-nome/`.
Implementação (Superpowers): plano curto, teste antes do código, depuração sistemática, revisão ao fim da tarefa.

## Gates (não avançar sem EVIDÊNCIA)

1. Spec completa e sem pendência crítica.
2. Migration aplicada + RLS testada por perfil (anon, colaborador via RPC, tecnico, cipa, admin, comite_assedio):
   mostrar as consultas e o resultado.
3. Testes da tarefa passando: mostrar comando e saída.
4. Interface funcionando: descrever como foi verificada (rota, ação, resultado).
5. Falhou 2 vezes a mesma verificação → PARAR, mudar a abordagem, registrar em `memory/erros.md`.

## Segurança

- MCP do Supabase só no projeto de DESENVOLVIMENTO. Nunca produção.
- Pedir confirmação ANTES de: apagar tabelas/dados, desabilitar RLS, alterar autenticação,
  instalar dependência grande, mexer em variáveis de ambiente.
- Nunca gravar chave/segredo em código, `.mcp.json` versionado ou arquivos de memória.
- Dados de colaboradores e relatos são sensíveis: RLS ativa desde a criação da tabela; cada empresa vê só os seus dados.
- Canal de Respeito: nunca enviar token, nunca pontuar, nunca logar identificação.

## Agentes

- `banco`: schema, migrations, RLS, funções SQL, testes de permissão.
- `qa`: testes, validação de gates, revisão final. Não escreve funcionalidade nova.
  Delegar banco ao `banco` e validação ao `qa`.

## Economia de tokens

Levantar contexto de uma vez, ler só trechos necessários, edições pontuais (não reescrever arquivo inteiro),
tarefa pronta quando o teste dela passa.

<!-- COLAR AQUI: conteúdo de injected-instruction.md (Benjamin-Plus) -->

<!-- COLAR AQUI: conteúdo do CLAUDE.md do repositório andrej-karpathy-skills -->
```

### 2.1.1 Linha a acrescentar no topo do `CLAUDE.md`

```
@AGENTS.md
```

### 2.2 Agentes customizados

Criar em `.claude/agents/` (se também usa Copilot, copie para `.github/agents/`).

**`.claude/agents/banco.md`**

```markdown
---
name: banco
description: Especialista em Supabase/Postgres do T.I.M.E. Seguro. Use para schema, migrations, RLS, funções SQL (RPC) e testes de permissão por perfil.
tools: Read, Write, Edit, Bash, Grep, Glob
---

Você cuida SOMENTE do banco de dados do T.I.M.E. Seguro.
Regras:

- Fonte: docs/TIME_02_BANCO_DE_DADOS.md. Copie as migrations sem alterá-las. Mudanças viram migration nova.
- Toda tabela com empresa_id e RLS ativa desde a criação. App do colaborador (role anon) nunca lê tabela: só RPC.
- Funções SECURITY DEFINER com search_path fixo. Pontuação só via _lancar_pontos (idempotente).
- Antes de concluir, rode testes de permissão por perfil: anon, técnico, cipa, admin, comitê de assédio,
  e mostre as consultas e os resultados (inclusive as que DEVEM falhar).
- Use apenas o projeto Supabase de DESENVOLVIMENTO. Peça confirmação antes de apagar dados ou desabilitar RLS.
- Nunca imprima chaves. Registre decisões em memory/decisoes.md e falhas em memory/erros.md.
```

**`.claude/agents/qa.md`**

```markdown
---
name: qa
description: QA do T.I.M.E. Seguro. Use ao fim de cada tarefa para validar gates, rodar testes e revisar. Não implementa funcionalidade nova.
tools: Read, Bash, Grep, Glob
---

Você valida; não implementa.
Checklist por tarefa:

1. A spec em specs/NNN-nome/ está completa e a implementação cobre cada critério dela?
2. Migration aplicada e RLS testada por perfil (peça a evidência ao agente banco se faltar).
3. Rode a suíte de testes (comando e saída completos). Teste a regra de negócio, não só o "caminho feliz".
4. Interface: confira rota, estados (carregando, vazio, erro), mensagens em português simples e uso com uma mão no celular.
5. Segurança: gabarito não vaza antes da resposta; Canal de Respeito sem token; sem segredo no código.
6. Revisão de código: duplicação, nomes, tipos, tratamento de erro.
   Entregue: APROVADO ou REPROVADO + lista objetiva do que corrigir + evidências.
```

### 2.3 `.mcp.json` (raiz) — Supabase **só de desenvolvimento**

```json
{
  "mcpServers": {
    "supabase-dev": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=SEU_PROJECT_REF_DE_DESENVOLVIMENTO"
    }
  }
}
```

- Use o **project ref do projeto de desenvolvimento** e nenhum outro. Confira na documentação do MCP do
  Supabase os parâmetros atuais (por exemplo, modo somente leitura) e a autenticação (login pelo navegador,
  sem colar token no arquivo).
- Se for versionar o `.mcp.json`, deixe o `project_ref` num placeholder e configure o real localmente.
- Crie o projeto de **produção separado** só no deploy final, e **sem** MCP conectado a ele.

## 3. Prompt 1 — Piloto

Pasta dos Markdown: `docs/`. Rode no **modo Plan** primeiro (Shift+Tab ×2); aprovado o plano, siga.

```
Você é o desenvolvedor principal do projeto T.I.M.E. Seguro — Treinar, Identificar, Mobilizar e Evoluir.
Vamos construí-lo por etapas, a partir dos Markdown em docs/ (TIME_00 a TIME_13).

SOBRE O PROJETO
- Plataforma de capacitação em Segurança do Trabalho (SST/CIPA+A) para a indústria: treinamentos e
  perguntas (Treinar), relatos de riscos pelos colaboradores (Identificar), campanhas, DDS/SIPAT e
  engajamento (Mobilizar) e acompanhamento de resultados e melhoria contínua (Evoluir).
- Gamificação: pontuação em 3 pilares (conhecimento, relatos, engajamento), ranking individual e por
  setor e premiação dos melhores a cada trimestre.
- A base de código é uma CÓPIA do projeto V.O.Z.E.S. Reaproveite estrutura, componentes e PWA que fizerem
  sentido; nunca altere o projeto original.
- Stack: TanStack Start + React + TypeScript, Tailwind v4, shadcn/ui, Supabase (via MCP supabase-dev).
- Fonte da verdade: docs/TIME_*.md. Não invente requisitos. Se algo for ambíguo, registre em
  memory/duvidas.md e siga com a suposição mais segura.
- O SQL de docs/TIME_02_BANCO_DE_DADOS.md já foi testado: copie as 6 migrations para supabase/migrations/
  SEM alterar. Não gere schema novo por conta própria.
- Leia CLAUDE.md e AGENTS.md antes de começar e siga-os.

FERRAMENTAS (use cada uma na sua fase)
1. Spec Kit: constitution (uma vez, baseada no CLAUDE.md/AGENTS.md) → specify → plan → tasks → implement.
   Use clarify/analyze só se houver dúvida real. Artefatos em specs/NNN-nome/.
   O specify deve DERIVAR dos Markdown, citando o arquivo e a seção de cada requisito.
2. Superpowers: na implementação, plano curto, teste antes do código, depuração sistemática, revisão ao fim da tarefa.
3. Skills do Supabase: schema, RLS, migrations e funções. Todo SQL vai como migration versionada.
4. Planning with Files: mantenha memory/progress.md, memory/decisoes.md e memory/erros.md atualizados ao
   fim de cada tarefa. Ao iniciar qualquer sessão, leia esses arquivos primeiro.
5. Agentes: delegue banco ao agente "banco" e validação ao agente "qa".

GATES (não avance sem evidência)
- Spec completa e sem pendências críticas.
- Migration aplicada + RLS testada por perfil (mostre as consultas de teste e o resultado).
- Testes da tarefa passando (mostre o comando e a saída).
- Interface funcionando (descreva como verificou).
- Se uma verificação falhar duas vezes, pare, mude a abordagem e registre em memory/erros.md.

SEGURANÇA
- O MCP do Supabase aponta só para o projeto de DESENVOLVIMENTO. Nunca toque em produção.
- Peça minha confirmação antes de: apagar tabelas ou dados, desabilitar RLS, alterar autenticação,
  instalar dependências novas grandes ou mexer em variáveis de ambiente.
- Nunca grave chaves ou segredos em código ou nos arquivos de memória.
- Dados de colaboradores e relatos são sensíveis: RLS ativa desde a criação; cada empresa só enxerga os próprios dados.
- Canal de Respeito: nunca envia token, nunca pontua.

ECONOMIA
- Levante o contexto de uma vez, leia só os trechos necessários, faça edições pontuais em vez de reescrever
  arquivos e considere a tarefa pronta quando o teste dela passar.

TAREFA AGORA (PILOTO)
Implemente SOMENTE esta funcionalidade, de ponta a ponta (spec → plano → tarefas → banco → interface → testes → revisão):
"Acesso por perfil + quiz diário com pontuação":
 a) Fase 0 enxuta do docs/TIME_11 (limpeza do V.O.Z.E.S., tema visual do TIME_10, .env do projeto de dev).
 b) Banco: aplicar as 6 migrations; criar empresa piloto e usuário admin (bootstrap do TIME_02 §6/0006);
    carregar 12 perguntas do docs/TIME_12 (2 por tema) por seed de desenvolvimento.
 c) Técnico/admin: login com Supabase Auth em /painel/login, guard de rotas, menu por papel.
 d) Colaborador: /app/entrar (código da empresa + matrícula + PIN), troca obrigatória de PIN,
    termo LGPD, /app/inicio e /app/quiz com as RPCs colaborador_* (TIME_03 §3 e TIME_05).
 e) Painel mínimo: cadastrar 1 colaborador, gerar PIN (tecnico_gerar_pins) e criar/ativar uma campanha.
 f) Testes: RPC de pontuação idempotente, gabarito oculto antes de responder, bloqueio após 5 PINs errados,
    anon sem acesso a tabelas, pin_hash ilegível, cipa sem denúncias.

Ao terminar, PARE e me entregue um relatório curto com: o que foi feito, evidências de cada gate,
decisões tomadas, problemas encontrados e o que sugere ajustar no processo. Não inicie a próxima funcionalidade.
```

## 4. Prompt 2 — Desenvolvimento autônomo (após aprovar o piloto)

```
O piloto foi aprovado. Continue o desenvolvimento do T.I.M.E. Seguro em modo autônomo, seguindo exatamente as
regras, ferramentas, gates e restrições de segurança do prompt anterior, do CLAUDE.md e do AGENTS.md.

ORDEM DAS FUNCIONALIDADES
Defina a ordem pelas dependências entre os Markdown, registre-a em memory/progress.md e siga por ela.
Sugestão, alinhada às fases do docs/TIME_11 e aos quatro pilares:
- Treinar: perguntas + importador (TIME_07) → campanha, trilha e eventos (TIME_04 §4 e §8) → app do colaborador
  completo: trilha e avaliação (TIME_05) → pontuação e selos (TIME_08)
- Identificar: relatos com foto e Edge Function + validação (TIME_05 §7, TIME_04 §9) → Canal de Respeito
  (TIME_01 §7, TIME_03 §6)
- Mobilizar: Modo TV Clássico + check-in (TIME_06) → ranking e encerramento da campanha (TIME_08 §6) →
  Duelo e Eliminação
- Evoluir: analytics e MAPA DE LACUNAS → relatório de evidência → comparativo trimestral → certificados e
  /verificar (TIME_09) → materiais e deploy
PRIORIDADE (prazo da inscrição 05/10/2026): primeiro tudo que torna a demonstração real; deixe Duelo,
Eliminação, comparativo e certificado em PDF por último.

PARA CADA FUNCIONALIDADE
Spec Kit (modo enxuto: specify → plan → tasks → implement; clarify/analyze só se houver dúvida real) →
banco (agente "banco") → interface → testes → revisão (agente "qa") → atualizar memory/ → próxima.

QUANDO PARAR E ME CHAMAR
- Um gate falhou duas vezes seguidas.
- Há conflito entre dois Markdown de funcionalidades.
- Uma ação exige minha confirmação (ver regras de segurança).
- Ao concluir cada funcionalidade, deixe um resumo de 5 linhas em memory/progress.md e continue sem esperar
  resposta, a não ser que esteja bloqueado.

REGRAS DE HONESTIDADE
- Nunca marque um gate como cumprido sem mostrar a evidência.
- Dados de demonstração devem ser claramente fictícios e nunca apresentados como resultado real.

Se a sessão for reiniciada, retome lendo memory/progress.md, memory/decisoes.md e memory/erros.md.
```

## 5. Prompt curto de retomada (nova sessão)

```
Retome o desenvolvimento do T.I.M.E. Seguro. Leia CLAUDE.md, AGENTS.md, memory/progress.md,
memory/decisoes.md e memory/erros.md. Diga em 5 linhas onde paramos e qual é a próxima tarefa,
depois continue seguindo os gates.
```

## 6. Observações práticas

- ✅ Valide o piloto **antes** de ligar o modo autônomo, como você planejou.
- ⏱️ O fluxo completo do Spec Kit em todas as funcionalidades consome muito tempo e contexto. Com o prazo de
  05/10, use o modo enxuto e aprove o plano de cada funcionalidade só quando ela for grande.
- 🔐 Autonomia total + MCP com permissão de escrita no banco exige o projeto de **desenvolvimento** isolado.
  Faça backup (ou exporte o schema) antes de cada fase grande.
- 🧪 O arquivo de teste do banco (seção 6 do TIME_02) serve de modelo para os testes de RLS por perfil.
- 📌 Se alguma skill instalada mudar o comportamento (por exemplo, pedir confirmação demais), ajuste no
  `AGENTS.md` em vez de editar a skill.
