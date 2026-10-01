import type { LinhaPdf } from "./pdf";

/**
 * Montagem das linhas a partir dos pedaços de texto que o pdf.js devolve.
 *
 * Mora separado de `pdf-extrair.ts` porque **não depende do pdf.js**: recebe os
 * pedaços como dado. É o que permite testar a ordem de leitura e a junção de
 * pedaços sem navegador — e `pdf-extrair.ts` não é empacotável fora do Vite,
 * por causa do `?url` do worker.
 */

/**
 * Tolerância vertical para juntar pedaços na mesma linha, em pontos do PDF.
 *
 * O pdf.js devolve pedaços de texto soltos, cada um com sua posição. Dois
 * pedaços na mesma linha visual podem ter `y` levemente diferente (acentos,
 * mudança de fonte), então a comparação não pode ser por igualdade exata.
 */
const TOLERANCIA_Y = 2;

export type PedacoDeTexto = {
  str: string;
  fontName?: string;
  transform: number[];
};

/**
 * Agrupa os pedaços de uma página em linhas, da de cima para a de baixo.
 *
 * `transform[5]` é o `y` e `transform[4]` o `x` na matriz do pdf.js. O `y`
 * cresce de baixo para cima, então a ordem de leitura é `y` decrescente.
 */
export function montarLinhas(pedacos: readonly PedacoDeTexto[], pagina: number): LinhaPdf[] {
  const comPosicao = pedacos
    .filter((p) => p.str.trim().length > 0)
    .map((p) => ({
      x: p.transform[4] ?? 0,
      y: p.transform[5] ?? 0,
      texto: p.str,
      fonte: p.fontName ?? "desconhecida",
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const linhas: LinhaPdf[] = [];
  for (const pedaco of comPosicao) {
    const ultima = linhas.at(-1);
    if (ultima && Math.abs(ultima.y - pedaco.y) <= TOLERANCIA_Y) {
      // O pdf.js não garante espaço entre pedaços: junta sem duplicar espaço.
      const precisaEspaco = !ultima.text.endsWith(" ") && !pedaco.texto.startsWith(" ");
      ultima.text += (precisaEspaco ? " " : "") + pedaco.texto;
      if (!ultima.fonts.includes(pedaco.fonte)) ultima.fonts.push(pedaco.fonte);
      continue;
    }
    linhas.push({ page: pagina, y: pedaco.y, text: pedaco.texto, fonts: [pedaco.fonte] });
  }

  return linhas.map((l) => ({ ...l, text: l.text.replace(/\s{2,}/g, " ").trim() }));
}
