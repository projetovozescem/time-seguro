import { describe, expect, it } from "vitest";
import { limparPin, pinBemFormado, pinFraco } from "./pin";

describe("pinBemFormado", () => {
  it("aceita exatamente 6 dígitos", () => {
    expect(pinBemFormado("418275")).toBe(true);
  });

  it("recusa tamanho errado, letras e sinais", () => {
    for (const ruim of ["", "1234", "1234567", "12a456", "12 456", "-12345"]) {
      expect(pinBemFormado(ruim)).toBe(false);
    }
  });
});

describe("pinFraco", () => {
  it("recusa todos os dígitos iguais", () => {
    for (let d = 0; d <= 9; d++) {
      expect(pinFraco(String(d).repeat(6))).toBe(true);
    }
  });

  it("recusa sequência crescente e decrescente", () => {
    for (const ruim of ["123456", "234567", "456789", "654321", "987654", "543210"]) {
      expect(pinFraco(ruim)).toBe(true);
    }
  });

  it("recusa o que não é bem formado", () => {
    expect(pinFraco("12345")).toBe(true);
    expect(pinFraco("abcdef")).toBe(true);
  });

  it("aceita PIN comum", () => {
    for (const bom of ["418275", "900371", "102030", "135792", "246813"]) {
      expect(pinFraco(bom)).toBe(false);
    }
  });

  it("não confunde sequência parcial com sequência inteira", () => {
    // Começa em sequência mas quebra no meio: é aceitável.
    expect(pinFraco("123459")).toBe(false);
    expect(pinFraco("912345")).toBe(false);
  });
});

describe("limparPin", () => {
  it("tira tudo que não é dígito", () => {
    expect(limparPin("41-82 75")).toBe("418275");
    expect(limparPin("abc123")).toBe("123");
  });

  it("corta em 6 dígitos", () => {
    expect(limparPin("1234567890")).toBe("123456");
  });

  it("devolve vazio para entrada sem dígito", () => {
    expect(limparPin("abc")).toBe("");
  });
});
