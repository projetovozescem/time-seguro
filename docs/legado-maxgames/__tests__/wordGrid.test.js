import { describe, it, expect } from 'vitest';
import { generateGrid, validateSelection, sanitizeWord, GRID_SIZE, MAX_WORD_LEN } from '../wordGrid.js';

describe('sanitizeWord', () => {
  it('remove acentos, espaços e cedilha', () => {
    expect(sanitizeWord('Segurança do Trabalho')).toBe('SEGURANCADOTRABALHO');
    expect(sanitizeWord('ATENÇÃO')).toBe('ATENCAO');
  });

  it('tolera valores ausentes', () => {
    expect(sanitizeWord(null)).toBe('');
    expect(sanitizeWord(undefined)).toBe('');
  });
});

describe('generateGrid', () => {
  const words = ['EPI', 'SEGURANCA', 'ALGORITMO', 'PSEUDOCODIGO', 'A'.repeat(MAX_WORD_LEN)];

  it('marca na grade exatamente as letras da palavra', () => {
    for (const w of words) {
      for (let i = 0; i < 25; i++) {
        const { grid, answerCoords, word } = generateGrid(w);
        // Este era o bug: palavras longas iam para o fallback e answerCoords
        // cobria só parte da palavra, enquanto a tela mostrava a palavra inteira.
        expect(answerCoords.length).toBe(word.length);
        for (const c of answerCoords) expect(grid[c.r][c.c]).toBe(c.letter);
      }
    }
  });

  it('devolve a palavra realmente colocada, nunca maior que a grade', () => {
    const { word } = generateGrid('ABCDEFGHIJKLMNOPQRST');
    expect(word.length).toBeLessThanOrEqual(GRID_SIZE);
  });

  it('normaliza acentos antes de posicionar', () => {
    const { word, answerCoords } = generateGrid('Atenção');
    expect(word).toBe('ATENCAO');
    expect(answerCoords).toHaveLength(7);
  });

  it('preenche a grade inteira', () => {
    const { grid } = generateGrid('SEGURANCA');
    expect(grid).toHaveLength(GRID_SIZE);
    for (const row of grid) {
      expect(row).toHaveLength(GRID_SIZE);
      for (const cell of row) expect(cell).toMatch(/^[A-Z0-9]$/);
    }
  });

  it('palavra vazia não gera coordenadas', () => {
    expect(generateGrid('').answerCoords).toEqual([]);
  });
});

describe('validateSelection', () => {
  it('aceita a seleção nos dois sentidos', () => {
    const { answerCoords } = generateGrid('SEGURANCA');
    const first = answerCoords[0];
    const last = answerCoords[answerCoords.length - 1];
    expect(validateSelection(first, last, answerCoords).valid).toBe(true);
    expect(validateSelection(last, first, answerCoords).valid).toBe(true);
  });

  it('rejeita seleção diagonal', () => {
    const { answerCoords } = generateGrid('SEGURANCA');
    expect(validateSelection({ r: 0, c: 0 }, { r: 3, c: 3 }, answerCoords).valid).toBe(false);
  });

  it('sem resposta cadastrada, nenhuma seleção é válida', () => {
    expect(validateSelection({ r: 0, c: 0 }, { r: 0, c: 3 }, []).valid).toBe(false);
  });
});
