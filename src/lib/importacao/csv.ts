import { DIFICULDADE_PADRAO, type Aviso, type PerguntaImportada } from "./tipos";
import { indiceDaCorreta } from "./txt";

/**
 * Parser do formato CSV (docs/TIME_07 §4).
 *
 * Cabeçalho em qualquer ordem, sem acento, separador `;` ou `,`:
 *   tema;pergunta;a;b;c;d;e;correta;explicacao;dificuldade
 * `correta` aceita letra (A–E) ou número (1–5).
 */

/** Descobre o separador pela linha de cabeçalho: o que aparece mais. */
export function detectarSeparador(cabecalho: string): ";" | "," | "\t" {
  const fora = cabecalho.replace(/"[^"]*"/g, "");
  const contagem = {
    ";": (fora.match(/;/g) ?? []).length,
    ",": (fora.match(/,/g) ?? []).length,
    "\t": (fora.match(/\t/g) ?? []).length,
  };
  const vencedor = Object.entries(contagem).sort((a, b) => b[1] - a[1])[0]!;
  return vencedor[1] > 0 ? (vencedor[0] as ";" | "," | "\t") : ";";
}

/** Quebra uma linha de CSV respeitando campos entre aspas e `""` escapado. */
export function quebrarLinha(linha: string, sep: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let dentroDeAspas = false;

  for (let i = 0; i < linha.length; i++) {
    const c = linha[i]!;
    if (dentroDeAspas) {
      if (c === '"') {
        if (linha[i + 1] === '"') {
          atual += '"';
          i++;
        } else {
          dentroDeAspas = false;
        }
      } else {
        atual += c;
      }
    } else if (c === '"') {
      dentroDeAspas = true;
    } else if (c === sep) {
      campos.push(atual);
      atual = "";
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

/** Normaliza o nome da coluna: sem acento, minúsculo, sem espaço. */
function chave(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function lerCsv(conteudo: string): PerguntaImportada[] {
  // BOM do Excel atrapalha o nome da primeira coluna.
  const texto = conteudo.replace(/^\uFEFF/, "");
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (linhas.length < 2) return [];

  const sep = detectarSeparador(linhas[0]!);
  const colunas = quebrarLinha(linhas[0]!, sep).map(chave);
  const indice = (nome: string) => colunas.indexOf(nome);

  const iPergunta = indice("pergunta");
  const iTema = indice("tema");
  const iCorreta = indice("correta");
  const iExplicacao = indice("explicacao");
  const iDificuldade = indice("dificuldade");
  const iAlternativas = ["a", "b", "c", "d", "e"].map(indice);

  const perguntas: PerguntaImportada[] = [];

  for (const linha of linhas.slice(1)) {
    const campos = quebrarLinha(linha, sep);
    const pegar = (i: number) => (i >= 0 ? (campos[i] ?? "").trim() : "");

    const enunciado = pegar(iPergunta);
    const alternativas = iAlternativas.map(pegar).filter((a) => a.length > 0);

    if (!enunciado && alternativas.length === 0) continue;

    const correta = indiceDaCorreta(pegar(iCorreta) || null, alternativas.length);
    const avisos: Aviso[] = [];

    if (enunciado.length < 10) avisos.push("enunciado_curto");
    if (alternativas.length < 2) avisos.push("poucas_alternativas");
    if (alternativas.length > 5) avisos.push("muitas_alternativas");
    if (correta === null) {
      avisos.push(pegar(iCorreta) ? "correta_fora_da_faixa" : "resposta_nao_detectada");
    }

    const tema = pegar(iTema) || null;
    if (!tema) avisos.push("tema_ausente");

    const bruta = Number(pegar(iDificuldade));
    const dificuldade = bruta === 1 || bruta === 2 || bruta === 3 ? bruta : DIFICULDADE_PADRAO;

    const pergunta: PerguntaImportada = {
      enunciado,
      alternativas: alternativas.slice(0, 5),
      correta,
      tema,
      dificuldade,
      avisos,
    };
    const explicacao = pegar(iExplicacao);
    if (explicacao) pergunta.explicacao = explicacao;

    perguntas.push(pergunta);
  }

  return perguntas;
}

/** Modelo para o botão "Baixar modelo CSV" (docs/TIME_07 §4). */
export const MODELO_CSV = [
  "tema;pergunta;a;b;c;d;e;correta;explicacao;dificuldade",
  'nr35;A partir de qual altura a NR-35 considera trabalho em altura?;Acima de 1,00 m;Acima de 1,50 m;"Acima de 2,00 m do nível inferior, com risco de queda";Acima de 3,00 m;;C;A NR-35 considera trabalho em altura acima de 2,00 m do nível inferior onde haja risco de queda.;1',
].join("\n");
