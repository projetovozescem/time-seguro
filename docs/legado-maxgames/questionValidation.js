import { sanitizeWord, MAX_WORD_LEN, MIN_WORD_LEN } from './wordGrid';

/**
 * Regras que uma pergunta precisa cumprir para ser jogavel.
 * Compartilhado entre a tela de importacao e a de edicao para que as duas
 * cobrem exatamente as mesmas condicoes.
 *
 * Espera { q, options, correct, word }, onde `correct` pode ser null ou -1
 * quando a resposta ainda nao foi definida.
 */
/**
 * @param {Partial<import('../types.js').Question> & {correct?: number|null}} question
 * @param {Map<string, number>} [wordCounts]
 * @returns {string[]} lista de problemas; vazia = pergunta jogavel
 */
export function findQuestionIssues(question, wordCounts) {
  const issues = [];
  const { q = '', options = [], correct, word = '' } = question;

  if (!String(q).trim()) issues.push('Enunciado vazio');
  if (options.length < 2) issues.push('Menos de 2 alternativas');

  if (correct === null || correct === undefined || correct < 0) {
    issues.push('Resposta correta nao marcada');
  } else if (correct >= options.length) {
    issues.push('Resposta correta aponta para uma alternativa inexistente');
  }

  const clean = sanitizeWord(word);
  if (!clean) issues.push('Palavra-chave vazia');
  else if (clean.length < MIN_WORD_LEN) issues.push(`Palavra muito curta (minimo ${MIN_WORD_LEN} letras)`);
  else if (clean.length > MAX_WORD_LEN) issues.push(`Palavra muito longa (maximo ${MAX_WORD_LEN} letras)`);
  else if (wordCounts && (wordCounts.get(clean) || 0) > 1) issues.push('Palavra repetida em outra pergunta');

  return issues;
}

/** Conta quantas perguntas usam cada palavra, para detectar repeticao. */
export function countWords(questions) {
  const counts = new Map();
  for (const question of questions) {
    const clean = sanitizeWord(question.word);
    if (clean) counts.set(clean, (counts.get(clean) || 0) + 1);
  }
  return counts;
}
