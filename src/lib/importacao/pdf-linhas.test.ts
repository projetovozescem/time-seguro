import { describe, expect, it } from "vitest";
import { montarLinhas } from "./pdf-linhas";

/**
 * `montarLinhas` é a parte pura da leitura de PDF: recebe os pedaços que o pdf.js
 * devolve e monta as linhas. Testar isto cobre o que mais quebra na prática —
 * ordem de leitura, pedaço solto no meio da palavra e fonte por linha.
 *
 * `transform` é a matriz do pdf.js: a posição 4 é o `x` e a 5 é o `y`, e o `y`
 * cresce de baixo para cima.
 */
function pedaco(str: string, x: number, y: number, fontName = "g_d0_f1") {
  return { str, fontName, transform: [1, 0, 0, 1, x, y] };
}

describe("montarLinhas", () => {
  it("junta os pedaços da mesma linha na ordem da esquerda para a direita", () => {
    const linhas = montarLinhas([pedaco("mundo", 80, 700), pedaco("Olá", 40, 700)], 1);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]!.text).toBe("Olá mundo");
  });

  it("lê de cima para baixo, não na ordem em que o pdf.js entregou", () => {
    const linhas = montarLinhas(
      [pedaco("terceira", 40, 660), pedaco("primeira", 40, 700), pedaco("segunda", 40, 680)],
      1,
    );
    expect(linhas.map((l) => l.text)).toEqual(["primeira", "segunda", "terceira"]);
  });

  it("tolera diferença mínima de y na mesma linha visual (acento, troca de fonte)", () => {
    const linhas = montarLinhas([pedaco("Ação", 40, 700), pedaco("segura", 80, 701.5)], 1);
    expect(linhas).toHaveLength(1);
  });

  it("y bem diferente é outra linha", () => {
    const linhas = montarLinhas([pedaco("uma", 40, 700), pedaco("outra", 40, 680)], 1);
    expect(linhas).toHaveLength(2);
  });

  it("não duplica espaço quando o pedaço já traz um", () => {
    const linhas = montarLinhas([pedaco("A) ", 40, 700), pedaco("Resposta", 60, 700)], 1);
    expect(linhas[0]!.text).toBe("A) Resposta");
  });

  it("guarda todas as fontes da linha, sem repetir — é o sinal do negrito", () => {
    const linhas = montarLinhas(
      [
        pedaco("A) ", 40, 700, "normal"),
        pedaco("Resposta", 60, 700, "bold"),
        pedaco(" certa", 120, 700, "bold"),
      ],
      1,
    );
    expect(linhas[0]!.fonts).toEqual(["normal", "bold"]);
  });

  it("descarta pedaço só de espaço, que o pdf.js solta entre palavras", () => {
    const linhas = montarLinhas([pedaco("Texto", 40, 700), pedaco("   ", 90, 700)], 1);
    expect(linhas[0]!.text).toBe("Texto");
  });

  it("pedaço sem fonte declarada não vira undefined na lista", () => {
    const linhas = montarLinhas([{ str: "Texto", transform: [1, 0, 0, 1, 40, 700] }], 1);
    expect(linhas[0]!.fonts).toEqual(["desconhecida"]);
  });

  it("marca a página em todas as linhas", () => {
    const linhas = montarLinhas([pedaco("Texto", 40, 700)], 7);
    expect(linhas[0]!.page).toBe(7);
  });

  it("página sem texto devolve lista vazia", () => {
    expect(montarLinhas([], 1)).toEqual([]);
    expect(montarLinhas([pedaco("  ", 40, 700)], 1)).toEqual([]);
  });
});
