import { describe, expect, it } from "vitest";
import { limparPin } from "./pin";

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
