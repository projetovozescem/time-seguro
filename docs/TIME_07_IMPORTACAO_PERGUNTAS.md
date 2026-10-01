# TIME_07 — Importação de Perguntas (portado do Max Games)

Objetivo: **o técnico não digita nada**. Ele envia o arquivo que já usa (PDF de treinamento,
TXT, planilha CSV) ou cola um texto, revisa e salva.

## 1. O que portar do Max Games

| Arquivo original (JS)                            | Destino (TS)                         | Mudanças                                        |
| ------------------------------------------------ | ------------------------------------ | ----------------------------------------------- |
| `src/utils/parseFile.js`                         | `src/lib/importacao/parseFile.ts`    | + campos `Tema`, `Explicação`, `Dificuldade`    |
| `src/utils/pdfQuestions.js`                      | `src/lib/importacao/pdfQuestions.ts` | sem mudança de lógica; tipar                    |
| `src/components/QuestionTextParser.jsx` (lógica) | `src/lib/importacao/textoLivre.ts`   | tipar                                           |
| `src/utils/questionValidation.js`                | `src/lib/importacao/validacao.ts`    | remover regras de `palavra`; + tema obrigatório |
| `src/utils/exportQuestions.js`                   | `src/lib/importacao/exportar.ts`     | exportar no formato TXT abaixo                  |
| `src/utils/__tests__/*`                          | `src/lib/importacao/__tests__/*`     | manter os testes e adaptar                      |

**Não portar**: `wordGrid.js`, `keyword.js` (palavra-chave só servia ao caça-palavras/forca).
`pdfjs-dist` continua carregado **sob demanda** (import dinâmico).

## 2. Tipo interno

```ts
export type PerguntaImportada = {
  enunciado: string;
  alternativas: string[]; // 2 a 5
  correta: number | null; // 0-based; null = não detectada (revisão obrigatória)
  tema: string | null; // slug ou nome, resolvido para tema_id na revisão
  explicacao?: string;
  dificuldade?: 1 | 2 | 3;
  avisos: string[]; // ex.: 'resposta_nao_detectada', 'tema_desconhecido', 'duplicada_no_banco'
};
```

## 3. Formato TXT

```
Tema: nr35
Pergunta: A partir de qual altura a NR-35 considera trabalho em altura?
A) Acima de 1,00 m
B) Acima de 1,50 m
C) Acima de 2,00 m do nível inferior, com risco de queda
D) Acima de 3,00 m
Correta: C
Explicação: A NR-35 considera trabalho em altura toda atividade acima de 2,00 m do nível inferior onde haja risco de queda.
Dificuldade: 1
```

- Perguntas separadas por linha em branco (ou pelo próximo `Pergunta:`).
- `Tema:` vale para a pergunta **e as seguintes** até aparecer outro `Tema:` (economiza digitação).
- Aceitar variações: `Explicacao`, `Explicação`, `Resposta:` como sinônimo de `Correta:`,
  alternativas `A)`, `A.`, `A -`, `(A)`.
- `Dificuldade` opcional (padrão 2).

## 4. Formato CSV

Cabeçalho (qualquer ordem, sem acento, separador `;` ou `,`):

```
tema;pergunta;a;b;c;d;e;correta;explicacao;dificuldade
nr10;O que significa "desenergizar" antes de intervir num circuito?;Desligar só o disjuntor;Seguir a sequência de desligamento, impedimento de reenergização, constatação de ausência de tensão, aterramento e sinalização;Usar luva;Avisar o colega;;B;A NR-10 define uma sequência completa de desenergização, não basta desligar.;2
```

`correta` aceita letra (A–E) ou número (1–5). Botão "Baixar modelo CSV" na tela.

## 5. PDF

Igual ao Max Games: detecta `Questão 1`, `1.`, `Q12`…, alternativas `A)`–`E)`, resposta por
**negrito** na alternativa ou **gabarito no fim** do documento. Remove cabeçalho/rodapé repetido.
Tema: o PDF normalmente não traz → o técnico escolhe **um tema padrão** para o lote antes de revisar.

## 6. Tela `/painel/perguntas/importar`

Três abas (combináveis no mesmo lote, como no Max Games):

1. 📄 **Enviar arquivo** (PDF, TXT, CSV — até 25 MB, arrastar e soltar)
2. 📝 **Colar texto**
3. 🌐 **Banco global** (copiar perguntas de `perguntas` com `empresa_id` nulo, filtradas por tema)

Depois: **Tema padrão do lote** (select) → **Revisão**.

### Revisão (um card por pergunta)

- Enunciado editável, alternativas editáveis (adicionar/remover até 5), **tocar para marcar a correta**.
- Select de tema (mostra o tema lido do arquivo; se desconhecido, fica vermelho).
- Explicação (recomendado; aviso amarelo se vazio) e dificuldade.
- Avisos em destaque:
  - 🔴 sem resposta correta · 🔴 menos de 2 alternativas · 🔴 sem tema → **bloqueiam salvar**
  - 🟡 duplicada no lote (removida automaticamente, mantendo a 1ª)
  - 🟡 já existe no banco (mesmo enunciado normalizado: minúsculas, sem acento, sem pontuação) → desmarcada por padrão
- Barra fixa: "36 perguntas · 2 com pendência" + botões **Excluir selecionadas** e **Salvar no banco**.

### Salvar

Insert em lote (supabase-js, RLS da empresa), em blocos de 100:

```ts
{ empresa_id, tema_id, enunciado, alternativas, correta, explicacao, dificuldade, origem: 'importacao' }
```

Resultado: "34 perguntas importadas. 2 ignoradas (já existiam)." + botão "Ver no banco".

## 7. Testes (Vitest)

- TXT com `Tema:` herdado entre perguntas
- TXT com `Resposta:` e alternativas `(A)`
- CSV com `;` e com `,`, `correta` em letra e número
- 5 alternativas (A–E)
- Pergunta sem correta → aviso `resposta_nao_detectada`
- Normalização para detectar duplicadas
- Exportar TXT → importar de novo → mesmo resultado (ida e volta)
