import { describe, expect, it } from "vitest";
import { lerBlocos } from "./materiais";

describe("lerBlocos (conteúdo do material vindo do banco)", () => {
  it("aceita a lista de blocos gravada pelo seed", () => {
    expect(
      lerBlocos([{ icone: "Hand", titulo: "Direito de recusa", texto: "Pare e avise." }]),
    ).toEqual([{ icone: "Hand", titulo: "Direito de recusa", texto: "Pare e avise." }]);
  });

  it("ícone desconhecido ou ausente vira o ícone padrão", () => {
    expect(lerBlocos([{ titulo: "A", texto: "B", icone: "Inexistente" }])[0]?.icone).toBe(
      "BookOpen",
    );
    expect(lerBlocos([{ titulo: "A", texto: "B" }])[0]?.icone).toBe("BookOpen");
  });

  it("descarta bloco sem título ou sem texto e entrada que não é lista", () => {
    expect(lerBlocos([{ titulo: "", texto: "B" }, { titulo: "A" }, null, 3])).toEqual([]);
    expect(lerBlocos({ titulo: "A", texto: "B" })).toEqual([]);
    expect(lerBlocos(null)).toEqual([]);
  });
});
