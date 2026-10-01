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
