import { describe, expect, it } from "vitest";
import { calcularEscalaTv } from "./escalaTv";

describe("calcularEscalaTv", () => {
  it("1280×720 é a base: escala 1", () => {
    expect(calcularEscalaTv(1280, 720)).toBe(1);
  });

  it("Full HD (1920×1080) aumenta 1,5×", () => {
    expect(calcularEscalaTv(1920, 1080)).toBe(1.5);
  });

  it("usa o lado que aperta: 1024×768 fica 0,8", () => {
    expect(calcularEscalaTv(1024, 768)).toBe(0.8);
  });

  it("limita nos extremos (4K e janela minúscula)", () => {
    expect(calcularEscalaTv(3840, 2160)).toBe(2.5);
    expect(calcularEscalaTv(400, 300)).toBe(0.75);
  });

  it("tamanho inválido não quebra: volta para 1", () => {
    expect(calcularEscalaTv(0, 0)).toBe(1);
  });
});
