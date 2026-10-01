import { v4 as uuidv4 } from 'uuid';
import { buildQuestions } from './pdfQuestions';
import { assignKeywords } from './keyword';

/** Erro com mensagem ja pronta para mostrar ao instrutor. */
export class ParseError extends Error {}

/** Lancado quando o instrutor cancela a leitura. */
export class ParseCancelled extends Error {}

// Itens que sao apenas o marcador da alternativa ("A)", "(B)"). A fonte deles
// nao conta na deteccao de destaque, porque costuma ser a do corpo do texto
// mesmo quando a resposta esta em negrito.
const MARKER_ONLY_RE = /^\(?\s*[A-Ea-e]\s*[).:-]?\s*$/;

const MAX_QUESTION_CHARS = 400;

/** Aceita PDF/TXT/CSV por MIME ou por extensao. */
export function isSupportedFile(file) {
  const name = String(file?.name || '').toLowerCase();
  return (
    file?.type === 'application/pdf' || name.endsWith('.pdf') ||
    file?.type === 'text/plain' || name.endsWith('.txt') ||
    name.endsWith('.csv')
  );
}

/**
 * Devolve uma lista de perguntas no formato:
 * { id, q, options: string[], correct: number (0-based, -1 = desconhecida), word: string }
 *
 * @param {File} file
 * @param {{onProgress?: (done: number, total: number) => void, signal?: AbortSignal}} [options]
 * @returns {Promise<import('../types.js').Question[]>}
 */
export async function parseFile(file, options = {}) {
  const name = String(file?.name || '').toLowerCase();

  if (file?.type === 'application/pdf' || name.endsWith('.pdf')) {
    return parsePDF(file, options);
  }
  if (name.endsWith('.csv')) {
    return parseCSV(await file.text());
  }
  if (file?.type === 'text/plain' || name.endsWith('.txt')) {
    return parseTextFormat(await file.text());
  }
  throw new ParseError('Apenas arquivos PDF, TXT ou CSV sao suportados.');
}

// ─── Formato TXT ─────────────────────────────────────────────────────────────

function valueAfterColon(line) {
  // slice em vez de split(':')[1]: "Palavra: NR:12" precisa manter "NR:12".
  return line.slice(line.indexOf(':') + 1).trim();
}

function parseTextFormat(rawText) {
  const questions = [];
  const lines = String(rawText || '').split('\n').map((l) => l.trim()).filter(Boolean);
  let cur = null;

  const flush = () => {
    if (cur && cur.options.length >= 2 && cur.q) questions.push(cur);
  };

  for (const line of lines) {
    if (/^pergunta\s*:/i.test(line)) {
      flush();
      cur = { id: uuidv4(), q: valueAfterColon(line), options: [], correct: -1, word: '' };
      continue;
    }
    if (!cur) continue;

    if (/^\(?[A-Ea-e]\s*[).:-]\s*\S/.test(line)) {
      cur.options.push(line);
    } else if (/^correta\s*:/i.test(line)) {
      const letter = valueAfterColon(line).toUpperCase().charAt(0);
      const idx = letter.charCodeAt(0) - 65;
      // Antes um "Correta:" vazio virava NaN e passava pela validacao.
      cur.correct = Number.isInteger(idx) && idx >= 0 && idx <= 4 ? idx : -1;
    } else if (/^palavra\s*:/i.test(line)) {
      cur.word = valueAfterColon(line);
    }
  }
  flush();

  return dedupeQuestions(assignKeywords(questions));
}

// ─── Formato CSV ─────────────────────────────────────────────────────────────

/** Divide uma linha de CSV respeitando aspas duplas. */
function splitCsvLine(line) {
  const cells = [];
  let cur = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',' || ch === ';') {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

/**
 * CSV com cabecalho. Colunas aceitas (sem acento, maiusculas/minusculas):
 * pergunta, a, b, c, d, e, correta, palavra
 */
function parseCSV(rawText) {
  const lines = String(rawText || '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    throw new ParseError('O CSV precisa de uma linha de cabecalho e ao menos uma pergunta.');
  }

  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const header = splitCsvLine(lines[0]).map(norm);
  const col = (nome) => header.indexOf(nome);

  const iQ = col('pergunta');
  if (iQ === -1) {
    throw new ParseError('O CSV precisa de uma coluna chamada "pergunta".');
  }
  const letterCols = ['a', 'b', 'c', 'd', 'e'].map(col);
  const iCorreta = col('correta');
  const iPalavra = col('palavra');

  const questions = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const q = (cells[iQ] || '').trim();
    if (!q) continue;

    const options = [];
    letterCols.forEach((idx, n) => {
      const text = idx >= 0 ? (cells[idx] || '').trim() : '';
      if (text) options.push(`${String.fromCharCode(65 + n)}) ${text}`);
    });
    if (options.length < 2) continue;

    let correct = -1;
    if (iCorreta >= 0) {
      const raw = (cells[iCorreta] || '').trim().toUpperCase();
      const byLetter = raw.charCodeAt(0) - 65;
      const byNumber = parseInt(raw, 10);
      if (byLetter >= 0 && byLetter < options.length) correct = byLetter;
      else if (Number.isInteger(byNumber) && byNumber >= 1 && byNumber <= options.length) {
        correct = byNumber - 1;
      }
    }

    questions.push({
      id: uuidv4(),
      q,
      options,
      correct,
      word: iPalavra >= 0 ? (cells[iPalavra] || '').trim() : '',
    });
  }

  if (questions.length === 0) {
    throw new ParseError('Nenhuma pergunta valida no CSV. Cada linha precisa de enunciado e ao menos 2 alternativas.');
  }
  return dedupeQuestions(assignKeywords(questions));
}

// ─── Deduplicação ────────────────────────────────────────────────────────────

/** Chave de comparacao: enunciado sem acento, pontuacao nem caixa. */
export function questionKey(question) {
  return String(question?.q || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/** Remove perguntas com o mesmo enunciado, mantendo a primeira. */
export function dedupeQuestions(questions) {
  const seen = new Set();
  return questions.filter((q) => {
    const key = questionKey(q);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Formato PDF ─────────────────────────────────────────────────────────────

// pdf.js so e baixado quando o instrutor realmente importa um PDF: sao ~400 kB
// que antes pesavam no carregamento inicial de toda a aplicacao.
let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const [pdfjsLib, worker] = await Promise.all([
        import('pdfjs-dist'),
        // Worker empacotado pelo Vite. Antes vinha de um CDN, o que fazia a
        // importacao morrer em qualquer sala de aula sem internet.
        import('pdfjs-dist/build/pdf.worker.mjs?url'),
      ]);
      pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjsLib;
    })();
  }
  return pdfjsPromise;
}

/**
 * Decide se a pagina tem duas colunas.
 *
 * Sem isso, uma linha da coluna esquerda e outra da direita na mesma altura
 * viravam uma linha so, embaralhando enunciado e alternativas.
 */
function detectColumnSplit(items, pageWidth) {
  const mid = pageWidth / 2;
  const margin = pageWidth * 0.04;

  let left = 0;
  let right = 0;
  let crossing = 0;

  for (const item of items) {
    const x = item.transform[4];
    const end = x + (item.width || 0);
    if (end < mid - margin) left++;
    else if (x > mid + margin) right++;
    else crossing++;
  }

  const total = left + right + crossing;
  if (total === 0) return null;

  // Duas colunas de verdade: os dois lados tem conteudo relevante e quase nada
  // atravessa o meio da pagina.
  const balanced = left > total * 0.2 && right > total * 0.2;
  const clean = crossing < total * 0.1;
  return balanced && clean ? mid : null;
}

function groupIntoRows(items, page) {
  const rows = [];
  for (const item of items) {
    if (!item.str || !item.str.trim()) continue;
    const y = item.transform[5];
    const found = rows.find((r) => Math.abs(r.y - y) <= 3);
    if (found) found.items.push(item);
    else rows.push({ y, items: [item] });
  }

  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) => {
    r.items.sort((a, b) => a.transform[4] - b.transform[4]);
    return {
      page,
      y: r.y,
      text: r.items.map((i) => i.str).join(' ').replace(/\s{2,}/g, ' ').trim(),
      fonts: r.items
        .filter((i) => !MARKER_ONLY_RE.test(i.str.trim()))
        .map((i) => i.fontName),
    };
  });
}

/**
 * Agrupa os itens de texto do pdf.js em linhas: mesma coordenada Y (tolerancia
 * de 3pt), de cima para baixo e da esquerda para a direita. Em paginas de duas
 * colunas, a coluna da esquerda vem inteira antes da direita.
 */
async function extractRows(pdf, { onProgress, signal }) {
  const rows = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    if (signal?.aborted) throw new ParseCancelled('Leitura cancelada.');

    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const usable = content.items.filter((i) => i.str && i.str.trim());
    const split = detectColumnSplit(usable, page.getViewport({ scale: 1 }).width);

    if (split === null) {
      rows.push(...groupIntoRows(usable, pageNum));
    } else {
      const left = usable.filter((i) => i.transform[4] <= split);
      const right = usable.filter((i) => i.transform[4] > split);
      rows.push(...groupIntoRows(left, pageNum), ...groupIntoRows(right, pageNum));
    }

    page.cleanup();
    onProgress?.(pageNum, pdf.numPages);
  }

  return rows;
}

/**
 * @param {File} file
 * @param {{onProgress?: (done: number, total: number) => void, signal?: AbortSignal}} [options]
 */
async function parsePDF(file, options = {}) {
  const { onProgress, signal } = options;
  const arrayBuffer = await file.arrayBuffer();
  let pdf = null;

  try {
    const pdfjsLib = await loadPdfjs();
    if (signal?.aborted) throw new ParseCancelled('Leitura cancelada.');

    pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const rows = await extractRows(pdf, { onProgress, signal });

    if (rows.length === 0) {
      throw new ParseError(
        'Este PDF nao tem texto selecionavel — parece ser digitalizado (imagem). ' +
        'Use um PDF gerado por computador ou passe o arquivo por um OCR antes de importar.'
      );
    }

    return dedupeQuestions(buildQuestions(rows, pdf.numPages))
      .map((q) => ({ ...q, q: q.q.slice(0, MAX_QUESTION_CHARS) }));
  } catch (err) {
    if (err instanceof ParseError || err instanceof ParseCancelled) throw err;
    // Nao vazamos mensagens cruas do pdf.js ("Setting up fake worker failed").
    console.error('Falha ao ler PDF:', err);
    throw new ParseError(
      'Nao foi possivel ler este PDF. Verifique se o arquivo nao esta corrompido ou protegido por senha.'
    );
  } finally {
    // Antes cada importacao deixava o documento e o worker vivos.
    if (pdf) await pdf.destroy().catch(() => {});
  }
}
