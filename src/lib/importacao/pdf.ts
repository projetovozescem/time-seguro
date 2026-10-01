import { DIFICULDADE_PADRAO, LETRAS, type Aviso, type PerguntaImportada } from "./tipos";

/**
 * Reconhecimento de perguntas em PDF (docs/TIME_07 §5), portado de
 * `pdfQuestions.js` do Max Games sem mudança de lógica — só tipado e com a
 * saída no formato `PerguntaImportada` do T.I.M.E.
 *
 * Este módulo **não conhece o pdf.js**: recebe linhas já montadas e devolve
 * perguntas. É o que o torna testável sem navegador. A extração do texto do
 * arquivo vive em `pdf-extrair.ts`, que carrega o `pdfjs-dist` sob demanda.
 */

/** Uma linha do PDF: `fonts` são as fontes dos pedaços de texto da linha. */
export type LinhaPdf = {
  page: number;
  /** Coordenada vertical na página, de baixo para cima (como no pdf.js). */
  y: number;
  text: string;
  fonts: string[];
};

/** "Questao 1", "Questão 1.", "Pergunta 3:", "Item 7", "Q12" */
const RE_TITULO = /^(?:quest[aã]o|pergunta|item|q)\s*[.:-]?\s*(\d{1,3})\b\s*[.):-]?\s*/i;

/** Numeração nua: "1.", "1)", "01 -" (exige espaço depois do delimitador). */
const RE_NUMERO_NU = /^(\d{1,3})\s*[.)-]\s+(?=\S)/;

/** "A)", "A.", "A -", "A:", "(A)" até a letra E. */
const RE_ALTERNATIVA = /^\(?\s*([A-Ea-e])\s*[).:-]\s*(.*)$/;

/** Cabeçalho da seção de gabarito. */
const RE_TITULO_GABARITO = /^\s*(?:gabarito|respostas?|answer\s*key|chave\s+de\s+respostas)\b/i;

/** "Q1: C", "1. C", "1 - D", "01) A" */
const RE_ENTRADA_GABARITO = /(?:^|\s)Q?\s*(\d{1,3})\s*[.:)-]\s*([A-Ea-e])(?![A-Za-z])/g;

/** Número de página isolado: "3", "3/9", "3 - 9". */
const RE_NUMERO_DE_PAGINA = /^\d{1,3}\s*(?:[/|-]\s*\d{1,3})?$/;

function indiceDaLetra(letra: string): number {
  return letra.toUpperCase().charCodeAt(0) - 65;
}

/**
 * Remove cabeçalhos e rodapés de forma genérica: linhas que se repetem na
 * maioria das páginas, ou números de página soltos nas bordas.
 *
 * Genérico de propósito. A versão original do Max Games tinha a lista literal
 * do cabeçalho de um único PDF, e isso descartaria uma pergunta legítima que
 * começasse com aquelas palavras.
 */
export function removerCabecalhosRepetidos(
  linhas: readonly LinhaPdf[],
  paginas: number,
): LinhaPdf[] {
  if (linhas.length === 0) return [...linhas];

  // Faixa de topo/rodapé de cada página (12% das extremidades).
  const limites = new Map<number, { min: number; max: number }>();
  for (const linha of linhas) {
    const b = limites.get(linha.page) ?? { min: Infinity, max: -Infinity };
    b.min = Math.min(b.min, linha.y);
    b.max = Math.max(b.max, linha.y);
    limites.set(linha.page, b);
  }

  const naMargem = (linha: LinhaPdf): boolean => {
    const b = limites.get(linha.page);
    if (!b || b.max === b.min) return false;
    const faixa = (b.max - b.min) * 0.12;
    return linha.y >= b.max - faixa || linha.y <= b.min + faixa;
  };

  // Em quantas páginas distintas cada texto de margem aparece.
  const paginasPorTexto = new Map<string, Set<number>>();
  for (const linha of linhas) {
    if (!naMargem(linha)) continue;
    const chave = linha.text.trim().toLowerCase();
    if (!chave) continue;
    if (!paginasPorTexto.has(chave)) paginasPorTexto.set(chave, new Set());
    paginasPorTexto.get(chave)!.add(linha.page);
  }

  return linhas.filter((linha) => {
    if (!naMargem(linha)) return true;
    if (RE_NUMERO_DE_PAGINA.test(linha.text.trim())) return false;
    // Com uma ou duas páginas não há "repetição" que signifique cabeçalho.
    if (paginas < 3) return true;
    const vistas = paginasPorTexto.get(linha.text.trim().toLowerCase());
    return !(vistas && vistas.size >= Math.ceil(paginas * 0.5));
  });
}

/**
 * Lê a seção de gabarito, se existir.
 *
 * A varredura só começa depois de um cabeçalho explícito de gabarito. Varrendo
 * o documento inteiro, um texto corrido como "conforme Q3: C do anexo"
 * reescreveria a resposta da pergunta 3 sem ninguém notar.
 */
export function lerGabarito(linhas: readonly LinhaPdf[]): Map<number, string> {
  const mapa = new Map<number, string>();
  const inicio = linhas.findIndex((l) => RE_TITULO_GABARITO.test(l.text));
  if (inicio === -1) return mapa;

  for (let i = inicio; i < linhas.length; i++) {
    const texto = linhas[i]!.text;
    RE_ENTRADA_GABARITO.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RE_ENTRADA_GABARITO.exec(texto)) !== null) {
      mapa.set(parseInt(m[1]!, 10), m[2]!.toUpperCase());
    }
  }
  return mapa;
}

/**
 * Descobre a fonte usada para destacar a alternativa correta (o "negrito").
 *
 * Olha **só as linhas de alternativa**: a fonte majoritária é o corpo do texto,
 * e qualquer fonte minoritária é destaque. Devolve `null` quando o sinal não é
 * confiável — melhor exigir revisão do que marcar a resposta errada.
 */
export function detectarFontesDeDestaque(linhas: readonly LinhaPdf[]): Set<string> | null {
  const contagem = new Map<string, number>();
  let linhasDeAlternativa = 0;

  for (const linha of linhas) {
    if (!RE_ALTERNATIVA.test(linha.text)) continue;
    linhasDeAlternativa++;
    for (const fonte of new Set(linha.fonts)) {
      contagem.set(fonte, (contagem.get(fonte) ?? 0) + 1);
    }
  }

  if (linhasDeAlternativa < 4 || contagem.size < 2) return null;

  const dominante = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  const destaque = new Set(
    [...contagem.entries()]
      .filter(([fonte, n]) => fonte !== dominante && n <= linhasDeAlternativa * 0.45)
      .map(([fonte]) => fonte),
  );
  if (destaque.size === 0) return null;

  // Se quase toda alternativa seria "destacada", o sinal não significa nada.
  const marcadas = linhas.filter(
    (l) => RE_ALTERNATIVA.test(l.text) && l.fonts.some((f) => destaque.has(f)),
  ).length;
  if (marcadas > linhasDeAlternativa * 0.45) return null;

  return destaque;
}

/** Marcadores textuais de resposta correta: `**...**`, "(correta)", "✔", "(X)". */
const MARCADORES = [/\*\*(.+?)\*\*/, /\((?:resposta\s+)?correta\)/i, /[✔✓☑]/, /\(x\)/i];

/** Tira o marcador do texto e diz se ele estava lá. */
export function lerMarcador(texto: string): { marcada: boolean; texto: string } {
  let marcada = false;
  let limpo = texto;
  for (const re of MARCADORES) {
    if (!re.test(limpo)) continue;
    marcada = true;
    // O primeiro marcador tem grupo de captura: preserva o conteúdo.
    limpo = re.source.includes("(.+?)") ? limpo.replace(re, "$1") : limpo.replace(re, "");
  }
  return { marcada, texto: limpo.replace(/\s{2,}/g, " ").trim() };
}

type Rascunho = {
  numero: number;
  enunciado: string;
  alternativas: string[];
  correta: number | null;
};

/**
 * Monta as perguntas a partir das linhas do PDF.
 *
 * `tema` é o tema padrão do lote: o PDF normalmente não traz tema, e o técnico
 * escolhe um antes da revisão (docs/TIME_07 §5).
 */
export function lerPdf(
  linhasBrutas: readonly LinhaPdf[],
  paginas: number,
  tema: string | null = null,
): PerguntaImportada[] {
  const linhas = removerCabecalhosRepetidos(linhasBrutas, paginas);
  const gabarito = lerGabarito(linhas);
  const fontesDeDestaque = detectarFontesDeDestaque(linhas);

  // A seção de gabarito não deve virar pergunta.
  const inicioDoGabarito = linhas.findIndex((l) => RE_TITULO_GABARITO.test(l.text));
  const corpo = inicioDoGabarito === -1 ? linhas : linhas.slice(0, inicioDoGabarito);

  const rascunhos: Rascunho[] = [];
  let atual: Rascunho | null = null;
  const fechar = () => {
    if (atual) rascunhos.push(atual);
  };

  for (const linha of corpo) {
    const texto = linha.text.trim();
    if (!texto) continue;

    // ── Novo enunciado ──────────────────────────────────────────────
    let numero: number | null = null;
    let resto = "";

    const titulo = texto.match(RE_TITULO);
    if (titulo) {
      numero = parseInt(titulo[1]!, 10);
      resto = texto.slice(titulo[0].length).trim();
    } else if (!atual || atual.alternativas.length > 0) {
      // Numeração nua só vale entre perguntas, nunca no meio de um enunciado:
      // senão uma linha que começa com número quebraria a pergunta em duas.
      const nu = texto.match(RE_NUMERO_NU);
      if (nu && !RE_ALTERNATIVA.test(texto)) {
        numero = parseInt(nu[1]!, 10);
        resto = texto.slice(nu[0].length).trim();
      }
    }

    if (numero !== null) {
      fechar();
      atual = { numero, enunciado: resto, alternativas: [], correta: null };
      continue;
    }

    if (!atual) continue;

    // ── Alternativa ─────────────────────────────────────────────────
    // As letras precisam seguir A, B, C… em ordem: isso elimina o falso
    // positivo de uma frase que por acaso comece com "E - ".
    const alternativa = texto.match(RE_ALTERNATIVA);
    const esperada = LETRAS[atual.alternativas.length];

    if (
      alternativa &&
      esperada !== undefined &&
      alternativa[1]!.toUpperCase() === esperada &&
      atual.alternativas.length < LETRAS.length
    ) {
      const lida = lerMarcador(alternativa[2]!.trim());
      atual.alternativas.push(lida.texto);

      const destacada =
        fontesDeDestaque !== null && linha.fonts.some((f) => fontesDeDestaque.has(f));
      if (lida.marcada || destacada) atual.correta = atual.alternativas.length - 1;
      continue;
    }

    // ── Continuação da linha anterior ───────────────────────────────
    if (atual.alternativas.length > 0) {
      const ultima = atual.alternativas.length - 1;
      const lida = lerMarcador(texto);
      atual.alternativas[ultima] = `${atual.alternativas[ultima]} ${lida.texto}`.trim();

      const destacada =
        fontesDeDestaque !== null && linha.fonts.some((f) => fontesDeDestaque.has(f));
      if (atual.correta === null && (lida.marcada || destacada)) atual.correta = ultima;
    } else {
      atual.enunciado = atual.enunciado ? `${atual.enunciado} ${texto}` : texto;
    }
  }
  fechar();

  // ── O gabarito tem precedência sobre a detecção tipográfica ────────
  for (const r of rascunhos) {
    const letra = gabarito.get(r.numero);
    if (!letra) continue;
    const i = indiceDaLetra(letra);
    if (i >= 0 && i < r.alternativas.length) r.correta = i;
  }

  return rascunhos
    .filter((r) => r.alternativas.length >= 2 && r.enunciado.trim().length > 0)
    .map((r): PerguntaImportada => {
      const avisos: Aviso[] = [];
      if (r.correta === null) avisos.push("resposta_nao_detectada");
      if (!tema) avisos.push("tema_ausente");
      if (r.alternativas.length < 2) avisos.push("poucas_alternativas");
      if (r.enunciado.trim().length < 10) avisos.push("enunciado_curto");

      return {
        enunciado: r.enunciado.trim(),
        alternativas: r.alternativas,
        correta: r.correta,
        tema,
        dificuldade: DIFICULDADE_PADRAO,
        avisos,
      };
    });
}
