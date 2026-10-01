import { DIFICULDADE_PADRAO, LETRAS, type Aviso, type PerguntaImportada } from "./tipos";

/**
 * Parser do formato TXT (docs/TIME_07 §3). Portado de `parseFile.js` do Max
 * Games, com os campos novos `Tema`, `Explicação` e `Dificuldade`.
 *
 * Tolerâncias que o documento pede:
 * - `Tema:` vale para a pergunta e as seguintes, até outro `Tema:`;
 * - `Resposta:` é sinônimo de `Correta:`;
 * - `Explicacao` sem acento também vale;
 * - alternativas em `A)`, `A.`, `A -`, `(A)`.
 */

/** `Pergunta:` / `Questao:` / `Questão:` */
const RE_PERGUNTA = /^\s*(?:pergunta|quest[aã]o)\s*:\s*(.*)$/i;
/** `Tema:` / `Assunto:` */
const RE_TEMA = /^\s*(?:tema|assunto)\s*:\s*(.*)$/i;
/** `Correta:` / `Resposta:` / `Gabarito:` */
const RE_CORRETA = /^\s*(?:correta|resposta|gabarito)\s*:\s*(.*)$/i;
/** `Explicação:` / `Explicacao:` / `Justificativa:` */
const RE_EXPLICACAO = /^\s*(?:explica[cç][aã]o|justificativa)\s*:\s*(.*)$/i;
const RE_DIFICULDADE = /^\s*dificuldade\s*:\s*(.*)$/i;
/** `A) texto`, `A. texto`, `A - texto`, `(A) texto` */
const RE_ALTERNATIVA = /^\s*\(?([A-Ea-e])\)?\s*[).\-–:]\s*(.*)$/;

type Rascunho = {
  enunciado: string;
  alternativas: string[];
  letraCorreta: string | null;
  tema: string | null;
  explicacao?: string;
  dificuldade?: number;
};

function novoRascunho(tema: string | null): Rascunho {
  return { enunciado: "", alternativas: [], letraCorreta: null, tema };
}

/** Converte a resposta do arquivo (letra ou número) em índice 0-based. */
export function indiceDaCorreta(bruto: string | null, quantas: number): number | null {
  if (!bruto) return null;
  const texto = bruto.trim();
  if (!texto) return null;

  const letra = /^\(?([A-Ea-e])\)?$/.exec(texto);
  if (letra) {
    const i = LETRAS.indexOf(letra[1]!.toUpperCase() as (typeof LETRAS)[number]);
    return i >= 0 && i < quantas ? i : null;
  }

  const numero = /^([1-5])$/.exec(texto);
  if (numero) {
    const i = Number(numero[1]) - 1;
    return i < quantas ? i : null;
  }

  return null;
}

function dificuldadeValida(bruto: number | undefined): 1 | 2 | 3 {
  if (bruto === 1 || bruto === 2 || bruto === 3) return bruto;
  return DIFICULDADE_PADRAO;
}

/** Fecha um rascunho, calculando avisos. Devolve null se estiver vazio. */
function finalizar(r: Rascunho): PerguntaImportada | null {
  if (!r.enunciado.trim() && r.alternativas.length === 0) return null;

  const alternativas = r.alternativas.map((a) => a.trim()).filter((a) => a.length > 0);
  const correta = indiceDaCorreta(r.letraCorreta, alternativas.length);
  const avisos: Aviso[] = [];

  if (r.enunciado.trim().length < 10) avisos.push("enunciado_curto");
  if (alternativas.length < 2) avisos.push("poucas_alternativas");
  if (alternativas.length > 5) avisos.push("muitas_alternativas");
  if (correta === null) {
    // Distingue "não disse" de "disse algo que não existe nas alternativas".
    avisos.push(
      r.letraCorreta && r.letraCorreta.trim() ? "correta_fora_da_faixa" : "resposta_nao_detectada",
    );
  }
  if (!r.tema) avisos.push("tema_ausente");

  const pergunta: PerguntaImportada = {
    enunciado: r.enunciado.trim(),
    alternativas: alternativas.slice(0, 5),
    correta,
    tema: r.tema,
    dificuldade: dificuldadeValida(r.dificuldade),
    avisos,
  };
  if (r.explicacao?.trim()) pergunta.explicacao = r.explicacao.trim();
  return pergunta;
}

/** Lê o TXT inteiro e devolve as perguntas na ordem do arquivo. */
export function lerTxt(conteudo: string): PerguntaImportada[] {
  const perguntas: PerguntaImportada[] = [];
  let temaAtual: string | null = null;
  let atual: Rascunho | null = null;
  /** Onde cai texto solto: continuação do enunciado ou da explicação. */
  let ultimoCampo: "enunciado" | "explicacao" | null = null;

  const fechar = () => {
    if (!atual) return;
    const p = finalizar(atual);
    if (p) perguntas.push(p);
    atual = null;
    ultimoCampo = null;
  };

  for (const linhaBruta of conteudo.split(/\r?\n/)) {
    const linha = linhaBruta.trimEnd();

    if (!linha.trim()) {
      // Linha em branco separa perguntas (docs/TIME_07 §3).
      fechar();
      continue;
    }

    const tema = RE_TEMA.exec(linha);
    if (tema) {
      // Só muda o tema corrente; não fecha a pergunta em andamento.
      temaAtual = tema[1]!.trim() || null;
      if (atual && !atual.enunciado) atual.tema = temaAtual;
      continue;
    }

    const pergunta = RE_PERGUNTA.exec(linha);
    if (pergunta) {
      fechar();
      atual = novoRascunho(temaAtual);
      atual.enunciado = pergunta[1]!.trim();
      ultimoCampo = "enunciado";
      continue;
    }

    if (!atual) {
      // Texto antes de qualquer `Pergunta:` vira o enunciado do primeiro item.
      atual = novoRascunho(temaAtual);
      atual.enunciado = linha.trim();
      ultimoCampo = "enunciado";
      continue;
    }

    const alternativa = RE_ALTERNATIVA.exec(linha);
    if (alternativa) {
      atual.alternativas.push(alternativa[2]!);
      ultimoCampo = null;
      continue;
    }

    const correta = RE_CORRETA.exec(linha);
    if (correta) {
      atual.letraCorreta = correta[1]!.trim();
      ultimoCampo = null;
      continue;
    }

    const explicacao = RE_EXPLICACAO.exec(linha);
    if (explicacao) {
      atual.explicacao = explicacao[1]!.trim();
      ultimoCampo = "explicacao";
      continue;
    }

    const dificuldade = RE_DIFICULDADE.exec(linha);
    if (dificuldade) {
      atual.dificuldade = Number(dificuldade[1]!.trim());
      ultimoCampo = null;
      continue;
    }

    // Texto solto: continua o último campo de texto livre.
    if (ultimoCampo === "enunciado") atual.enunciado += " " + linha.trim();
    else if (ultimoCampo === "explicacao") atual.explicacao += " " + linha.trim();
  }

  fechar();
  return perguntas;
}

/**
 * Escreve no formato TXT (docs/TIME_07 §1, `exportar.ts`). Agrupa por tema para
 * aproveitar a herança do `Tema:` — e é a volta do teste de ida e volta.
 */
export function escreverTxt(perguntas: PerguntaImportada[]): string {
  const blocos: string[] = [];
  let temaEscrito: string | null = null;

  for (const p of perguntas) {
    const linhas: string[] = [];
    if (p.tema && p.tema !== temaEscrito) {
      linhas.push(`Tema: ${p.tema}`);
      temaEscrito = p.tema;
    }
    linhas.push(`Pergunta: ${p.enunciado}`);
    p.alternativas.forEach((a, i) => linhas.push(`${LETRAS[i]}) ${a}`));
    if (p.correta !== null) linhas.push(`Correta: ${LETRAS[p.correta]}`);
    if (p.explicacao) linhas.push(`Explicação: ${p.explicacao}`);
    linhas.push(`Dificuldade: ${p.dificuldade ?? DIFICULDADE_PADRAO}`);
    blocos.push(linhas.join("\n"));
  }

  return blocos.join("\n\n") + "\n";
}
