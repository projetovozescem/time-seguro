import { describe, it, expect } from 'vitest';
import { buildQuestions } from '../pdfQuestions.js';

// Monta "linhas" no formato que o extrator do pdf.js produz.
const rows = (lines, page = 1) =>
  lines.map((l, i) => (typeof l === 'string'
    ? { page, y: 700 - i * 20, text: l, fonts: ['body'] }
    : { page: l.page ?? page, y: l.y ?? 700 - i * 20, text: l.text, fonts: l.fonts ?? ['body'] }));

describe('buildQuestions — formatos de enunciado', () => {
  it('aceita "Questao N"', () => {
    const qs = buildQuestions(rows([
      'Questao 1', 'Qual o maior planeta?',
      'A) Terra', 'B) Marte', 'C) Jupiter', 'D) Venus',
    ]), 1);
    expect(qs).toHaveLength(1);
    expect(qs[0].q).toBe('Qual o maior planeta?');
    expect(qs[0].options).toHaveLength(4);
  });

  it('aceita numeração nua "1." e alternativas "A."', () => {
    const qs = buildQuestions(rows([
      '1. Qual e a capital do Brasil?',
      'A. Buenos Aires', 'B. Rio de Janeiro', 'C. Brasilia', 'D. Sao Paulo',
    ]), 1);
    expect(qs).toHaveLength(1);
    expect(qs[0].options).toHaveLength(4);
  });

  it('aceita "Pergunta N", "(A)" e cinco alternativas', () => {
    const qs = buildQuestions(rows([
      'Pergunta 1: Qual gas as plantas absorvem?',
      '(A) Oxigenio', '(B) Dioxido de carbono', '(C) Nitrogenio', '(D) Hidrogenio', '(E) Helio',
    ]), 1);
    expect(qs[0].options).toHaveLength(5);
  });

  it('não confunde uma frase iniciada por "E -" com a alternativa E', () => {
    const qs = buildQuestions(rows([
      'Questao 1', 'O que e seguranca do trabalho?',
      'A) Um conjunto de medidas preventivas',
      'B) Uma etapa opcional da producao',
      'E - isso vale para toda a industria brasileira',
    ]), 1);
    expect(qs[0].options).toHaveLength(2);
    expect(qs[0].options[1]).toContain('industria brasileira');
  });

  it('junta enunciado e alternativa quebrados em várias linhas', () => {
    const qs = buildQuestions(rows([
      'Questao 1',
      'Uma maquina esta com a protecao danificada.',
      'O que deve ser feito?',
      'A) Continuar usando normalmente',
      'B) Parar a maquina e avisar o supervisor',
      'ate que o reparo seja concluido',
    ]), 1);
    expect(qs[0].q).toBe('Uma maquina esta com a protecao danificada. O que deve ser feito?');
    expect(qs[0].options[1]).toContain('reparo seja concluido');
  });
});

describe('buildQuestions — resposta correta', () => {
  const base = [
    'Questao 1', 'Qual o maior planeta?',
    'A) Terra', 'B) Marte', 'C) Jupiter', 'D) Venus',
    'Questao 2', 'Qual o menor planeta?',
    'A) Mercurio', 'B) Marte', 'C) Jupiter', 'D) Saturno',
  ];

  it('sem gabarito e sem destaque, deixa a resposta indefinida', () => {
    const qs = buildQuestions(rows(base), 1);
    expect(qs.every((q) => q.correct === -1)).toBe(true);
  });

  it('lê o gabarito no fim do documento', () => {
    const qs = buildQuestions(rows([...base, 'Gabarito Oficial', 'Q1: C   Q2: A']), 1);
    expect(qs[0].correct).toBe(2);
    expect(qs[1].correct).toBe(0);
  });

  it('aceita gabarito no formato "1 - C"', () => {
    const qs = buildQuestions(rows([...base, 'Respostas', '1 - C', '2 - A']), 1);
    expect(qs[0].correct).toBe(2);
    expect(qs[1].correct).toBe(0);
  });

  it('ignora "Q3: C" solto no corpo do texto', () => {
    const qs = buildQuestions(rows([
      'Questao 3', 'O que diz o anexo, conforme Q3: C do manual?',
      'A) Uma coisa', 'B) Outra coisa', 'C) Terceira', 'D) Quarta',
    ]), 1);
    expect(qs[0].correct).toBe(-1);
  });

  it('detecta a alternativa em fonte destacada', () => {
    const qs = buildQuestions(rows([
      'Questao 1', 'Qual o objetivo da NR-12?',
      { text: 'A) Prevenir acidentes com maquinas', fonts: ['bold'] },
      'B) Definir a jornada de trabalho',
      'C) Fixar o salario minimo',
      'D) Exigir maquinas antigas',
      'Questao 2', 'O que significa EPI?',
      { text: 'A) Equipamento de Protecao Individual', fonts: ['bold'] },
      'B) Equipamento de Producao Industrial',
      'C) Especificacao de Padrao Industrial',
      'D) Estrutura de Protecao Integrada',
    ]), 1);
    expect(qs[0].correct).toBe(0);
    expect(qs[1].correct).toBe(0);
  });

  it('reconhece o marcador **negrito** no texto', () => {
    const qs = buildQuestions(rows([
      'Questao 1', 'Qual gas as plantas absorvem?',
      'A) Oxigenio', 'B) **Dioxido de carbono**', 'C) Nitrogenio', 'D) Helio',
    ]), 1);
    expect(qs[0].correct).toBe(1);
    expect(qs[0].options[1]).not.toContain('*');
  });
});

describe('buildQuestions — cabeçalhos e rodapés', () => {
  it('remove linhas repetidas nas margens de todas as páginas', () => {
    const input = [];
    for (let page = 1; page <= 3; page++) {
      input.push({ page, y: 780, text: 'QUIS NR-12 Seguranca do Trabalho', fonts: ['body'] });
      input.push({ page, y: 700, text: `Questao ${page}`, fonts: ['body'] });
      input.push({ page, y: 680, text: `Pergunta numero ${page}?`, fonts: ['body'] });
      input.push({ page, y: 660, text: 'A) Primeira opcao', fonts: ['body'] });
      input.push({ page, y: 640, text: 'B) Segunda opcao', fonts: ['body'] });
      input.push({ page, y: 30, text: `${page} / 3`, fonts: ['body'] });
    }
    const qs = buildQuestions(input, 3);
    expect(qs).toHaveLength(3);
    for (const q of qs) {
      expect(q.q).not.toContain('QUIS NR-12');
      expect(q.options.join(' ')).not.toContain('/ 3');
    }
  });
});

describe('buildQuestions — contrato de saída', () => {
  it('devolve palavras jogáveis e sem repetição', () => {
    const qs = buildQuestions(rows([
      'Questao 1', 'O que e um algoritmo?',
      'A) Uma peca de computador', 'B) Passos ordenados para resolver um problema',
      'Questao 2', 'O que e um fluxograma?',
      'A) Um tipo de memoria', 'B) A representacao grafica de um processo',
      'Gabarito', 'Q1: B  Q2: B',
    ]), 1);
    const words = qs.map((q) => q.word);
    expect(words.every((w) => /^[A-Z]+$/.test(w))).toBe(true);
    expect(new Set(words).size).toBe(words.length);
  });

  it('descarta questões com menos de duas alternativas', () => {
    const qs = buildQuestions(rows([
      'Questao 1', 'Pergunta sem alternativas suficientes?', 'A) Unica opcao',
    ]), 1);
    expect(qs).toHaveLength(0);
  });

  it('não expõe o número da questão no objeto final', () => {
    const qs = buildQuestions(rows([
      'Questao 7', 'Alguma pergunta?', 'A) Sim', 'B) Nao',
    ]), 1);
    expect(Object.keys(qs[0]).sort()).toEqual(['correct', 'id', 'options', 'q', 'word']);
  });
});
