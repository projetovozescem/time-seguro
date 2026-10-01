import { describe, it, expect } from 'vitest';
import { toJSON, toTXT, safeFilename } from '../exportQuestions.js';
import { parseFile } from '../parseFile.js';

const questions = [
  { id: 'q1', q: 'O que e um algoritmo?', options: ['A) Uma peca', 'B) Passos ordenados'], correct: 1, word: 'ALGORITMO' },
  { id: 'q2', q: 'O que e um fluxograma?', options: ['A) Memoria', 'B) Representacao grafica'], correct: 1, word: 'FLUXOGRAMA' },
];

describe('exportação', () => {
  it('TXT sai no formato que o importador aceita de volta', async () => {
    const texto = toTXT(questions);
    const file = new File([texto], 'export.txt', { type: 'text/plain' });
    const voltou = await parseFile(file);

    expect(voltou).toHaveLength(2);
    expect(voltou[0].q).toBe('O que e um algoritmo?');
    expect(voltou[0].correct).toBe(1);
    expect(voltou[0].word).toBe('ALGORITMO');
    expect(voltou[1].word).toBe('FLUXOGRAMA');
  });

  it('JSON preserva os campos sem o prefixo das alternativas', () => {
    const data = JSON.parse(toJSON(questions));
    expect(data[0].options).toEqual(['Uma peca', 'Passos ordenados']);
    expect(data[0].correct).toBe(1);
  });

  it('gera nome de arquivo seguro', () => {
    expect(safeFilename('Revisão Prova 1º Bimestre', 'txt')).toBe('revisao-prova-1-bimestre.txt');
    expect(safeFilename('', 'json')).toBe('perguntas.json');
  });
});

describe('importação de CSV', () => {
  const csv = [
    'pergunta,a,b,c,d,correta,palavra',
    '"O que e um algoritmo?","Uma peca","Passos ordenados","Um metal","Um planeta",B,ALGORITMO',
    'Qual a capital do Brasil?,Buenos Aires,Rio de Janeiro,Brasilia,Sao Paulo,3,BRASILIA',
  ].join('\n');

  it('lê cabeçalho, alternativas e gabarito por letra ou número', async () => {
    const out = await parseFile(new File([csv], 'perguntas.csv', { type: 'text/csv' }));
    expect(out).toHaveLength(2);
    expect(out[0].correct).toBe(1);
    expect(out[0].word).toBe('ALGORITMO');
    expect(out[1].correct).toBe(2);
    expect(out[1].options).toHaveLength(4);
  });

  it('recusa CSV sem a coluna pergunta', async () => {
    const ruim = 'a,b,correta\numa,outra,A';
    await expect(parseFile(new File([ruim], 'x.csv'))).rejects.toThrow(/coluna chamada "pergunta"/i);
  });
});

describe('deduplicação na importação', () => {
  it('descarta perguntas com o mesmo enunciado', async () => {
    const txt = [
      'Pergunta: O que e um algoritmo?', 'A) Uma peca', 'B) Passos ordenados', 'Correta: B',
      '', 'Pergunta: O QUE É UM ALGORITMO?', 'A) Outra', 'B) Coisa', 'Correta: A',
    ].join('\n');
    const out = await parseFile(new File([txt], 'dup.txt', { type: 'text/plain' }));
    expect(out).toHaveLength(1);
  });
});
