import { describe, expect, it } from "vitest";
import { LIMITE_CLARO, corClara, corDoTexto, luminancia } from "./cores";

describe("luminancia", () => {
  it("preto é 0 e branco é 1", () => {
    expect(luminancia("#000000")).toBe(0);
    expect(luminancia("#ffffff")).toBeCloseTo(1, 5);
  });

  it("aceita a forma curta de três dígitos", () => {
    expect(luminancia("#fff")).toBeCloseTo(luminancia("#ffffff"), 5);
  });

  it("cor inválida não quebra: vira escura", () => {
    expect(luminancia("vermelho")).toBe(0);
    expect(corDoTexto("")).toBe("text-white");
  });
});

describe("corDoTexto", () => {
  it("sobre o amarelo de segurança o texto é escuro", () => {
    expect(corClara("#ffc400")).toBe(true);
    expect(corDoTexto("#ffc400")).toBe("text-texto");
  });

  it("sobre o marinho industrial o texto é branco", () => {
    expect(corClara("#0b3c5d")).toBe(false);
    expect(corDoTexto("#0b3c5d")).toBe("text-white");
  });

  it("as cores padrão de setor saem com contraste decidido, não por sorte", () => {
    const paleta = ["#0B3C5D", "#F5A300", "#2E86C1", "#C0392B", "#7F8C8D", "#16A085", "#8E44AD"];
    for (const cor of paleta) {
      const esperado = luminancia(cor) >= LIMITE_CLARO ? "text-texto" : "text-white";
      expect(corDoTexto(cor)).toBe(esperado);
    }
  });
});
