import { montarLinhas } from "./pdf-linhas";
import type { PedacoDeTexto } from "./pdf-linhas";
import type { LinhaPdf } from "./pdf";

/**
 * Extração do texto de um PDF com o `pdfjs-dist` (docs/TIME_07 §5).
 *
 * A biblioteca é carregada **sob demanda** (docs/TIME_07 §1): só vai para a rede
 * quando o técnico escolhe um PDF, e o app do colaborador nunca a baixa.
 *
 * Este arquivo é a única camada que conhece o pdf.js. Quem monta as linhas é
 * `pdf-linhas.ts` e quem reconhece as perguntas é `pdf.ts` — os dois testáveis
 * sem navegador.
 */

/** Acima disto o arquivo provavelmente não é um banco de perguntas. */
export const MAXIMO_DE_PAGINAS = 60;

/** O que `lerPdf` precisa receber. */
export type TextoDoPdf = { linhas: LinhaPdf[]; paginas: number };

export async function extrairLinhas(arquivo: File | ArrayBuffer): Promise<TextoDoPdf> {
  const pdfjs = await import("pdfjs-dist");
  // O worker vem do próprio pacote, como URL: sem isto o pdf.js tenta buscar um
  // caminho que não existe no build e falha com "Setting up fake worker".
  const { default: urlDoWorker } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = urlDoWorker;

  const dados = arquivo instanceof ArrayBuffer ? arquivo : await (arquivo as File).arrayBuffer();

  // `destroy()` é da TAREFA de carregamento, não do documento: é ela que
  // derruba o worker.
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(dados) });
  const documento = await tarefa.promise;
  try {
    const paginas = Math.min(documento.numPages, MAXIMO_DE_PAGINAS);
    const linhas: LinhaPdf[] = [];

    for (let n = 1; n <= paginas; n++) {
      const pagina = await documento.getPage(n);
      const conteudo = await pagina.getTextContent();
      linhas.push(...montarLinhas(conteudo.items as PedacoDeTexto[], n));
      pagina.cleanup();
    }

    return { linhas, paginas };
  } finally {
    // Sem isto o worker fica vivo e segura memória depois da importação.
    await tarefa.destroy();
  }
}
