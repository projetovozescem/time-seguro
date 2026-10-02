# Erros e abordagens descartadas — T.I.M.E. Seguro

> Registrar quando uma verificação falha duas vezes na mesma abordagem.
> Uma entrada por falha: o que foi tentado, o que aconteceu, o que passou a ser feito.

## 2026-09-30 — Heredoc longo do bash truncou ao escrever o `AGENTS.md`

Escrever um arquivo grande com `cat > ... <<'EOF'` num comando único falhou com
`unexpected EOF while looking for matching quote`. Passei a montar arquivos grandes
por script Node lendo pedaços de arquivo, ou pela ferramenta de escrita direta.

## 2026-09-30 — Suposição errada sobre o escopo do projeto

Comecei tratando a tarefa como "mover o V.O.Z.E.S. para outro repositório" e
escrevi `AGENTS.md`, `README.md` e os subagentes com as regras do V.O.Z.E.S.
`CLAUDE.md` e `docs/` apareceram depois e mostraram que o produto é outro
(T.I.M.E. Seguro). Lição: conferir `CLAUDE.md` e `docs/` antes de escrever regra
de projeto, e não inferir escopo do nome da pasta.

## 2026-10-01 — Criar usuário de Auth por SQL quebrou o login

Inserir em `auth.users` sem preencher `confirmation_token`, `recovery_token`,
`email_change` e `email_change_token_new` faz o login falhar com
`Database error querying schema`: o GoTrue lê essas colunas em string
não-anulável. Agora o `scripts/bootstrap-dev.mjs` grava `''` nas quatro.

## 2026-10-01 — Primeiro teste negativo reprovou o gate, não o banco

Abri um furo de propósito (`grant select (nome) on colaboradores to anon`) e as
382 verificações continuaram verdes. Causa: `has_table_privilege` não vê grant por
coluna. Foi o que motivou reescrever o gate por ACL. Lição: todo gate novo nasce
com um teste negativo, senão não se sabe se ele é capaz de reprovar.

## 2026-10-01 — Três asserções minhas estavam erradas, não o sistema

No teste de fluxo: (a) esperei zero pontos ao errar o quiz, mas
`presenca_diaria` lança pontos na primeira atividade do dia — a asserção passou a
filtrar por `origem = 'quiz_diario'`; (b) usei `assedio_moral` como categoria de
denúncia, e o schema aceita `moral`/`sexual`/`discriminacao`/`outro`; (c) chutei
nomes de parâmetro das RPCs em vez de ler `pg_get_function_arguments`.

## 2026-10-01 — `\b` virou byte de backspace dentro do arquivo

Ao gerar código por heredoc + script Node, `/\banon\b/` chegou ao arquivo com
backspaces literais (0x08) em vez da âncora de palavra. A asserção existia, mas
nunca casava: o teste negativo passou verde com uma policy aberta a `anon`.
Troquei a regex por uma checagem explícita da lista de papéis. Lição: regex com
escape não sobrevive a camadas de quoting — e sem o teste negativo isso teria
ficado escondido.

## 2026-10-01 — Quatro tropeços no MESMO escape, no mesmo dia

`\n`, `\s` e `\uFEFF` perderam a barra ao passar por heredoc do bash e por
`node -e`, gerando arquivo com quebra de linha literal dentro de string, regex
sem âncora e BOM invisível no fonte. Custou quatro idas e voltas.

Regra que passa a valer: **conteúdo com escape ou regex vai pela ferramenta de
escrita de arquivo, nunca por string embutida em comando de shell.** Para
caractere invisível, usar `String.fromCharCode(0x...)` — é o que
`src/lib/eventos.ts` faz com o BOM do CSV.

## 2026-10-01 — Asserção errada sobre a ordem das checagens da RPC

Afirmei que ativar campanha sem tema devolve `campanha_sem_temas`. A RPC checa
`ja_existe_campanha_ativa` primeiro, e o seed deixa uma campanha ativa — então
aquele caminho não era alcançável. O teste passou a afirmar que a ativação é
recusada com um dos dois motivos conhecidos. Ler a ordem das validações no SQL
antes de escrever a expectativa.

## 2026-10-01 — `/app/inicio` lia um contrato que não existe

A primeira versão da home assumiu `quiz_do_dia` e `posicao.geral`. A RPC
`colaborador_resumo` devolve `quiz_hoje` e `posicao_individual`. A tela
compilava, o `test:fluxo` passava (só exercitava o quiz) e a home simplesmente
não mostrava nada. Reescrita sobre o retorno real, lido do SQL.

Daí nasceu `src/lib/contratos.test.ts`: lê o `jsonb_build_object` de cada RPC nas
migrations e confere as chaves que as telas esperam. Inclui uma asserção negativa
para os nomes que eu havia inventado. **Tipo escrito à mão sobre resposta de RPC
não é contrato; é palpite — precisa de teste contra o SQL.**

## 2026-10-01 — O extrator do teste de contrato mentiu na primeira versão

Procurava o fim do corpo da função por `end $$;`. Função `language sql` fecha com
`$$;` sem `end`, então o corpo de `empresa_publica` invadiu a função seguinte e o
teste a acusou de não devolver `codigo`. Passou a delimitar pelo par de `$$`.

## 2026-10-01 — Quinta vez no mesmo escape, violando regra que eu mesmo escrevi

Gerei `"\n"` por `node -e` dentro de string de shell de novo, depois de ter
registrado a regra contrária algumas horas antes. A regra vale e passou a ser
seguida: **script gerador vai para arquivo pela ferramenta de escrita, nunca
inline no shell.** Quando o texto precisa de caractere de controle na saída,
montar por `JSON.stringify("\n...")` dentro do próprio script.

## Painel "vazio" ao logar pela primeira vez no navegador (01/10/2026)

Primeira vez que o painel foi **renderizado de verdade** (Chrome headless pelo
protocolo DevTools, login com o `.env`). Tres defeitos que nenhum gate pegava
porque nenhum gate abre navegador:

1. `usePerfil` usava `.maybeSingle()` sem filtrar o usuario. O RLS de
   `perfis_tecnicos` libera TODOS os perfis da empresa (o admin lista a equipe em
   Configuracoes), entao com 2 perfis na empresa a consulta falhava e o menu e o
   cabecalho sumiam. Corrigido com `.eq("user_id", ...)`.
2. O guard `_protegido` rodava no servidor, onde nao ha `localStorage`: todo F5 e
   todo link direto jogavam para o login. Corrigido: so valida no navegador.
3. `/painel` (Inicio) era placeholder desde a Fase 2: "Painel em construcao".
   Construido o dashboard do TIME_04 §3.

Licao: "compila + RLS + fluxo SQL passando" NAO prova que a tela funciona. O
script de verificacao no navegador (scratchpad `ver-painel.mjs`) deveria virar
parte do `verify` se houver Chrome na maquina.

Dado sujo: `test:fluxo` deixa colaboradores "TesteFluxo..." na empresa `piloto`
a cada execucao (68 ate agora). Nao apaga por falta de confirmacao do usuario.

## O que a sessão de 02/10/2026 revelou (e que nenhum gate pegava)

1. **O login do colaborador nunca funcionou pela interface.** `app.entrar.tsx`
   chamava `colaborador_login` por `rpcApp` com `p_codigo`, e o `rpcApp`
   acrescenta `p_token` a toda chamada; a função recebe `p_empresa_codigo` e não
   tem token. `tsc`, vitest, RLS e fluxo passaram o tempo todo porque todos
   chamavam a RPC direto, com os nomes certos, e `rpcApp`/`rpcPublica` recebem
   `args` como `Record<string, unknown>` com `as never`. Conserto: login por
   `rpcPublica` + `src/lib/rpc-contratos.test.ts`, que confere o nome de todo
   parâmetro de toda chamada das telas contra `database.types.ts`. Rodado antes
   do conserto, o teste reprovou exatamente nesse ponto e em nenhum outro.
2. **Eu havia dito que o PWA "já funciona".** Não funcionava: manifest do
   V.O.Z.E.S. (`/aluno`), ícones com o coração roxo, `BotaoInstalar` e
   `registrarServiceWorker()` nunca chamados e nenhuma rota `/app`. Regra: antes
   de afirmar que algo funciona, abrir e ver. Agora há `npm run test:pwa`.
3. **Funções novas nascem executáveis por `anon`** quando criadas por esta
   conexão (o `alter default privileges` da 0005 não a alcança). Pego pelo
   `test:rls`; corrigido na 0010, que também fecha o padrão para as próximas.
4. **Tabela nova nasce com GRANT amplo para anon/authenticated** no Supabase:
   `revoke all` explícito em toda tabela nova (feito em `acessos_pin` e
   `solicitacoes_cadastro`).
5. **Defeito de leitura de PostgREST:** `.maybeSingle()` falha com 2 linhas;
   `usePerfil` filtra por `user_id`. O cache do `QueryClient` não era limpo ao
   sair: agora `queryClient.clear()` em `sair()`.
6. Dois `useSetores` com a MESMA chave de cache e colunas diferentes; resta um.

**Lição única:** `npm run test:e2e` (Chrome headless, pela interface) é o único
teste que pegou 1, 2 e 5. Rodar sempre que mexer em tela ou em fluxo de acesso.
