import { stripOptionPrefix } from './keyword';

/**
 * Exportacao do banco de perguntas.
 *
 * O formato TXT e exatamente o que o importador aceita de volta
 * (Pergunta/alternativas/Correta/Palavra), entao serve tanto de backup quanto
 * de ponte entre instrutores sem passar pelo Firestore.
 */

/** @param {import('../types.js').Question[]} questions */
export function toJSON(questions) {
  return JSON.stringify(
    questions.map((q) => ({
      q: q.q,
      options: q.options.map(stripOptionPrefix),
      correct: q.correct,
      word: q.word,
    })),
    null,
    2
  );
}

/** @param {import('../types.js').Question[]} questions */
export function toTXT(questions) {
  return questions.map((q) => {
    const linhas = [`Pergunta: ${q.q}`];
    q.options.forEach((opt, i) => {
      linhas.push(`${String.fromCharCode(65 + i)}) ${stripOptionPrefix(opt)}`);
    });
    if (q.correct >= 0) linhas.push(`Correta: ${String.fromCharCode(65 + q.correct)}`);
    if (q.word) linhas.push(`Palavra: ${q.word}`);
    return linhas.join('\n');
  }).join('\n\n');
}

/** Dispara o download de um texto como arquivo. */
export function downloadText(filename, content, mime = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Libera a memoria do blob depois que o navegador iniciou o download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Nome de arquivo seguro a partir do nome do jogo. */
export function safeFilename(name, extension) {
  const base = String(name || 'perguntas')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'perguntas';
  return `${base}.${extension}`;
}
