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
