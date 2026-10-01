import { describe, it, expect } from 'vitest';
import { extractKeyword, assignKeywords, stripOptionPrefix } from '../keyword.js';
import { MAX_WORD_LEN, MIN_WORD_LEN } from '../wordGrid.js';

const isPlayable = (w) =>
  /^[A-Z]+$/.test(w) && w.length >= MIN_WORD_LEN && w.length <= MAX_WORD_LEN;

describe('extractKeyword — regressões dos PDFs reais', () => {
  it('não devolve lixo quando a resposta correta é curta (era "OROU")', () => {
    const word = extractKeyword(
      'OR (OU)',
      'Qual operador requer que apenas uma das condicoes seja verdadeira?'
    );
    expect(word).not.toBe('OROU');
    expect(isPlayable(word)).toBe(true);
  });

  it('nunca corta a palavra no meio (era "RESPONSABILIDAD")', () => {
    const word = extractKeyword(
      'E responsabilidade do empregador fornecer o equipamento',
      'De quem e a responsabilidade de fornecer o EPI?'
    );
    expect(word).not.toBe('RESPONSABILIDAD');
    expect(word.length).toBeLessThanOrEqual(MAX_WORD_LEN);
  });

  it('prefere o termo do assunto, que costuma estar na pergunta', () => {
    expect(extractKeyword('Passos ordenados para resolver um problema', 'O que e um algoritmo?'))
      .toBe('ALGORITMO');
    expect(extractKeyword('A adaptacao das condicoes de trabalho ao trabalhador', 'O que e ergonomia?'))
      .toBe('ERGONOMIA');
  });

  it('descarta palavras genéricas de prova', () => {
    const word = extractKeyword('Verdadeiro', 'A afirmacao sobre pilhas e verdadeira ou falsa?');
    expect(word).not.toBe('VERDADEIRO');
  });

  it('remove acentos e devolve apenas A-Z', () => {
    const word = extractKeyword('A proteção coletiva é obrigatória', 'O que a norma exige?');
    expect(word).toMatch(/^[A-Z]+$/);
  });
});

describe('assignKeywords', () => {
  const q = (id, text, answer) => ({
    id, q: text, options: [`A) ${answer}`, 'B) outra alternativa qualquer'], correct: 0, word: '',
  });

  it('não repete a mesma palavra entre perguntas (era VERDADEIRO x3)', () => {
    const out = assignKeywords([
      q('1', 'A primeira afirmacao e verdadeira?', 'Sim, e verdadeiro'),
      q('2', 'A segunda afirmacao e verdadeira?', 'Sim, e verdadeiro'),
      q('3', 'A terceira afirmacao e verdadeira?', 'Sim, e verdadeiro'),
    ]);
    const words = out.map((x) => x.word).filter(Boolean);
    expect(new Set(words).size).toBe(words.length);
  });

  it('respeita uma palavra já informada, normalizando-a', () => {
    const [out] = assignKeywords([{ ...q('1', 'Qual a capital?', 'Brasilia'), word: 'Brasília' }]);
    expect(out.word).toBe('BRASILIA');
  });

  it('não muta a lista original', () => {
    const input = [q('1', 'O que e um algoritmo?', 'Passos ordenados')];
    assignKeywords(input);
    expect(input[0].word).toBe('');
  });
});

describe('stripOptionPrefix', () => {
  it('remove os marcadores de alternativa', () => {
    expect(stripOptionPrefix('A) Uma peca')).toBe('Uma peca');
    expect(stripOptionPrefix('(C) Terceira')).toBe('Terceira');
    expect(stripOptionPrefix('D - Quarta')).toBe('Quarta');
  });
});
