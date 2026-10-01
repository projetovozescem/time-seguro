import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildQuestions } from '../pdfQuestions.js';
import { MIN_WORD_LEN, MAX_WORD_LEN } from '../wordGrid.js';

// Mesma montagem de linhas que parseFile.js faz no navegador.
const MARKER_ONLY_RE = /^\(?\s*[A-Ea-e]\s*[).:-]?\s*$/;

async function parse(file) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(fs.readFileSync(file)) }).promise;
  const rows = [];
  for (let page = 1; page <= pdf.numPages; page++) {
    const content = await (await pdf.getPage(page)).getTextContent();
    const pageRows = [];
    // getTextContent devolve TextItem | TextMarkedContent; so o primeiro tem str.
    for (const item of /** @type {any[]} */ (content.items)) {
      if (!item.str || !item.str.trim()) continue;
      const y = item.transform[5];
      const found = pageRows.find((r) => Math.abs(r.y - y) <= 3);
      if (found) found.items.push(item);
      else pageRows.push({ y, items: [item] });
    }
    pageRows.sort((a, b) => b.y - a.y);
    for (const r of pageRows) {
      r.items.sort((a, b) => a.transform[4] - b.transform[4]);
      rows.push({
        page,
        y: r.y,
        text: r.items.map((i) => i.str).join(' ').replace(/\s{2,}/g, ' ').trim(),
        fonts: r.items.filter((i) => !MARKER_ONLY_RE.test(i.str.trim())).map((i) => i.fontName),
      });
    }
  }
  return buildQuestions(rows, pdf.numPages);
}

// quiz.pdf marca a correta por NEGRITO (sem gabarito).
// Quiz_Seguranca... não tem negrito nenhum e depende do GABARITO no fim.
// Juntos cobrem os dois caminhos de detecção.
const CASES = [
  { file: 'quiz.pdf', expected: 30 },
  { file: 'Quiz_Seguranca_do_Trabalho_NR.pdf', expected: 40 },
];

describe('PDFs reais do repositório', () => {
  for (const { file, expected } of CASES) {
    const abs = path.resolve(process.cwd(), file);
    const run = fs.existsSync(abs) ? it : it.skip;

    run(`${file}: extrai ${expected} questões completas`, async () => {
      const qs = await parse(abs);

      expect(qs).toHaveLength(expected);
      // Toda questão precisa de resposta correta — antes, num PDF sem negrito
      // e sem gabarito, as 40 vinham com correct = -1.
      expect(qs.filter((q) => q.correct < 0)).toHaveLength(0);
      expect(qs.every((q) => q.options.length >= 2)).toBe(true);
      expect(qs.every((q) => q.correct < q.options.length)).toBe(true);
      expect(qs.every((q) => q.q.trim().length > 0)).toBe(true);
      // Enunciado não pode começar com espaço (bug do cur.q += ' ' + txt).
      expect(qs.every((q) => q.q === q.q.trim())).toBe(true);
    }, 30000);

    run(`${file}: palavras-chave jogáveis e únicas`, async () => {
      const words = (await parse(abs)).map((q) => q.word);

      for (const w of words) {
        expect(w, `palavra invalida: ${w}`).toMatch(/^[A-Z]+$/);
        expect(w.length, `fora da faixa: ${w}`).toBeGreaterThanOrEqual(MIN_WORD_LEN);
        expect(w.length, `fora da faixa: ${w}`).toBeLessThanOrEqual(MAX_WORD_LEN);
      }
      // Regressões medidas na versão antiga.
      expect(words).not.toContain('OROU');
      expect(words).not.toContain('ON');
      expect(words).not.toContain('RESPONSABILIDAD');
      expect(new Set(words).size, 'palavras repetidas').toBe(words.length);
    }, 30000);
  }
});
