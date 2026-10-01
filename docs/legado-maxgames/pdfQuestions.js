import { v4 as uuidv4 } from 'uuid';
import { assignKeywords } from './keyword.js';

// ─── Reconhecimento de formatos ─────────────────────────────────────────────
//
// Este modulo nao conhece o pdf.js: recebe "linhas" ja montadas e devolve
// questoes. Isso o torna testavel sem navegador e sem Vite.
//
// Uma linha tem a forma:
//   { page: number, y: number, text: string, fonts: string[] }
// onde `fonts` sao os nomes de fonte dos pedacos de texto da linha, ja sem o
// marcador da alternativa ("A)").

// "Questao 1", "Questão 1.", "Pergunta 3:", "Item 7", "Q12"
const HEADING_RE = /^(?:quest[aã]o|pergunta|item|q)\s*[.:-]?\s*(\d{1,3})\b\s*[.):-]?\s*/i;

// Numeracao nua: "1.", "1)", "01 -"  (exige espaco depois do delimitador)
const BARE_NUMBER_RE = /^(\d{1,3})\s*[.)-]\s+(?=\S)/;

// "A)", "A.", "A -", "A:", "(A)"  ate a letra E
const OPTION_RE = /^\(?\s*([A-Ea-e])\s*[).:-]\s*(.*)$/;

// Cabecalho da secao de gabarito
const ANSWER_KEY_HEADING_RE = /^\s*(?:gabarito|respostas?|answer\s*key|chave\s+de\s+respostas)\b/i;

// "Q1: C", "1. C", "1 - D", "01) A"
const ANSWER_ENTRY_RE = /(?:^|\s)Q?\s*(\d{1,3})\s*[.:)-]\s*([A-Ea-e])(?![A-Za-z])/g;

// Numero de pagina isolado: "3", "3/9", "3 - 9"
const PAGE_NUMBER_RE = /^\d{1,3}\s*(?:[/|-]\s*\d{1,3})?$/;

const letterToIndex = (letter) => letter.toUpperCase().charCodeAt(0) - 65;

/**
 * Remove cabecalhos e rodapes de forma generica: linhas que se repetem na
 * maioria das paginas, ou numeros de pagina soltos nas bordas.
 *
 * Substitui a lista fixa que existia antes (/^QUIS NR/, /^Seguranca do
 * Trabalho/), que era o cabecalho literal de um unico PDF de exemplo e que
 * descartaria uma questao legitima comecando com essas palavras.
 */
export function stripRunningHeaders(rows, numPages) {
  if (rows.length === 0) return rows;

  // Faixa de topo/rodape de cada pagina (12% das extremidades).
  const bounds = new Map();
  for (const row of rows) {
    const b = bounds.get(row.page) || { min: Infinity, max: -Infinity };
    b.min = Math.min(b.min, row.y);
    b.max = Math.max(b.max, row.y);
    bounds.set(row.page, b);
  }
  const inMargin = (row) => {
    const b = bounds.get(row.page);
    if (!b || b.max === b.min) return false;
    const band = (b.max - b.min) * 0.12;
    return row.y >= b.max - band || row.y <= b.min + band;
  };

  // Quantas paginas distintas contem cada texto de margem.
  const pagesByText = new Map();
  for (const row of rows) {
    if (!inMargin(row)) continue;
    const key = row.text.trim().toLowerCase();
    if (!key) continue;
    if (!pagesByText.has(key)) pagesByText.set(key, new Set());
    pagesByText.get(key).add(row.page);
  }

  return rows.filter((row) => {
    if (!inMargin(row)) return true;
    if (PAGE_NUMBER_RE.test(row.text.trim())) return false;
    if (numPages < 3) return true;
    const seen = pagesByText.get(row.text.trim().toLowerCase());
    return !(seen && seen.size >= Math.ceil(numPages * 0.5));
  });
}

/**
 * Le a secao de gabarito, se existir.
 *
 * Antes a varredura era feita no documento INTEIRO, entao um texto corrido como
 * "conforme Q3: C do anexo" reescrevia silenciosamente a resposta de uma
 * questao. Agora so lemos depois de um cabecalho de gabarito explicito.
 */
export function parseAnswerKey(rows) {
  const map = new Map();
  const startIdx = rows.findIndex((r) => ANSWER_KEY_HEADING_RE.test(r.text));
  if (startIdx === -1) return map;

  for (let i = startIdx; i < rows.length; i++) {
    const text = rows[i].text;
    ANSWER_ENTRY_RE.lastIndex = 0;
    let m;
    while ((m = ANSWER_ENTRY_RE.exec(text)) !== null) {
      map.set(parseInt(m[1], 10), m[2].toUpperCase());
    }
  }
  return map;
}

/**
 * Descobre a fonte usada para destacar a alternativa correta.
 *
 * A versao antiga inferia o negrito da fonte do titulo "Questao N". Isso
 * funcionava por coincidencia em um PDF (titulo e resposta na mesma fonte) e
 * falhava por completo em outro (titulo em fonte propria, nenhuma alternativa
 * destacada). Aqui olhamos apenas as LINHAS DE ALTERNATIVA: a fonte majoritaria
 * e o corpo do texto; qualquer fonte minoritaria e destaque.
 *
 * Devolve null quando o sinal nao e confiavel.
 */
export function detectEmphasisFonts(rows) {
  const counts = new Map();
  let optionRows = 0;

  for (const row of rows) {
    if (!OPTION_RE.test(row.text)) continue;
    optionRows++;
    for (const font of new Set(row.fonts)) {
      counts.set(font, (counts.get(font) || 0) + 1);
    }
  }

  if (optionRows < 4 || counts.size < 2) return null;

  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const emphasis = new Set(
    [...counts.entries()]
      .filter(([font, n]) => font !== dominant && n <= optionRows * 0.45)
      .map(([font]) => font)
  );

  if (emphasis.size === 0) return null;

  // Se quase toda alternativa seria "destacada", o sinal nao significa nada.
  const flagged = rows.filter(
    (r) => OPTION_RE.test(r.text) && r.fonts.some((f) => emphasis.has(f))
  ).length;
  if (flagged > optionRows * 0.45) return null;

  return emphasis;
}

// Marcadores textuais de resposta correta: "**...**", "(correta)", "✔", "X)"
const INLINE_MARKERS = [
  /\*\*(.+?)\*\*/,
  /\((?:resposta\s+)?correta\)/i,
  /[✔✓☑]/,
  /\(x\)/i,
];

function readInlineMarker(text) {
  let marked = false;
  let clean = text;
  for (const re of INLINE_MARKERS) {
    if (!re.test(clean)) continue;
    marked = true;
    clean = re.source.includes('(.+?)')
      ? clean.replace(re, '$1')
      : clean.replace(re, '');
  }
  return { marked, text: clean.replace(/\s{2,}/g, ' ').trim() };
}

/**
 * Monta as questoes a partir das linhas do PDF.
 *
 * `rows`: [{ page, y, text, fonts }]  — ver o topo deste arquivo.
 */
/**
 * @param {{page:number, y:number, text:string, fonts:string[]}[]} rawRows
 * @param {number} numPages
 * @returns {import('../types.js').Question[]}
 */
export function buildQuestions(rawRows, numPages) {
  const rows = stripRunningHeaders(rawRows, numPages);
  const answerKey = parseAnswerKey(rows);
  const emphasisFonts = detectEmphasisFonts(rows);

  // A secao de gabarito nao deve virar questao.
  const keyIdx = rows.findIndex((r) => ANSWER_KEY_HEADING_RE.test(r.text));
  const body = keyIdx === -1 ? rows : rows.slice(0, keyIdx);

  const questions = [];
  let cur = null;
  const flush = () => { if (cur) questions.push(cur); };

  for (const row of body) {
    const text = row.text.trim();
    if (!text) continue;

    // ── Novo enunciado ──────────────────────────────────────────────
    let number = null;
    let rest = '';

    const heading = text.match(HEADING_RE);
    if (heading) {
      number = parseInt(heading[1], 10);
      rest = text.slice(heading[0].length).trim();
    } else if (!cur || cur.options.length > 0) {
      // Numeracao nua so e aceita entre questoes, nunca no meio de um
      // enunciado, para nao confundir com uma linha que comeca com numero.
      const bare = text.match(BARE_NUMBER_RE);
      if (bare && !OPTION_RE.test(text)) {
        number = parseInt(bare[1], 10);
        rest = text.slice(bare[0].length).trim();
      }
    }

    if (number !== null) {
      flush();
      cur = { id: uuidv4(), number, q: rest, options: [], correct: -1, word: '' };
      continue;
    }

    if (!cur) continue;

    // ── Alternativa ─────────────────────────────────────────────────
    // As letras precisam seguir A, B, C... em ordem. Essa checagem elimina
    // falsos positivos (uma frase que por acaso comece com "E - ").
    const opt = text.match(OPTION_RE);
    const expected = String.fromCharCode(65 + cur.options.length);

    if (opt && opt[1].toUpperCase() === expected && cur.options.length < 5) {
      const parsed = readInlineMarker(opt[2].trim());
      cur.options.push(`${expected}) ${parsed.text}`);

      const emphasized = emphasisFonts && row.fonts.some((f) => emphasisFonts.has(f));
      if (parsed.marked || emphasized) cur.correct = cur.options.length - 1;
      continue;
    }

    // ── Continuacao ─────────────────────────────────────────────────
    if (cur.options.length > 0) {
      const last = cur.options.length - 1;
      const parsed = readInlineMarker(text);
      cur.options[last] = `${cur.options[last]} ${parsed.text}`.trim();

      const emphasized = emphasisFonts && row.fonts.some((f) => emphasisFonts.has(f));
      if (cur.correct === -1 && (parsed.marked || emphasized)) cur.correct = last;
    } else {
      // Sem o ternario o enunciado saia com um espaco inicial.
      cur.q = cur.q ? `${cur.q} ${text}` : text;
    }
  }
  flush();

  // ── Gabarito tem precedencia sobre a deteccao tipografica ──────────
  for (const q of questions) {
    const letter = answerKey.get(q.number);
    if (!letter) continue;
    const idx = letterToIndex(letter);
    if (idx >= 0 && idx < q.options.length) q.correct = idx;
  }

  const usable = questions.filter((q) => q.options.length >= 2 && q.q.trim().length > 0);

  // Palavras-chave com deduplicacao global entre todas as questoes importadas.
  // O numero da questao so serve para casar com o gabarito; nao vai para o jogo.
  return assignKeywords(usable).map((q) => ({
    id: q.id, q: q.q, options: q.options, correct: q.correct, word: q.word,
  }));
}
