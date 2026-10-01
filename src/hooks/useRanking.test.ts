import { describe, expect, it } from "vitest";
import { comPosicao, medalha, ordenarIndividual, type LinhaIndividual } from "./useRanking";

function linha(parcial: Partial<LinhaIndividual> = {}): LinhaIndividual {
  return {
    colaborador_id: "c1",
    nome: "Carlos",
    matricula: "1001",
    setor_id: "s1",
    total: 100,
    conhecimento: 60,
    relatos: 30,
    engajamento: 10,
    ultimo_ponto_em: "2026-10-01T10:00:00Z",
    ...parcial,
  };
}

describe("ordenarIndividual — desempate de docs/TIME_08 §3", () => {
  it("ordena por total, do maior para o menor", () => {
    const r = ordenarIndividual([
      linha({ colaborador_id: "a", total: 50 }),
      linha({ colaborador_id: "b", total: 300 }),
      linha({ colaborador_id: "c", total: 150 }),
    ]);
    expect(r.map((l) => l.colaborador_id)).toEqual(["b", "c", "a"]);
  });

  it("empate no total: quem tem mais pontos em relatos fica na frente", () => {
    const r = ordenarIndividual([
      linha({ colaborador_id: "a", total: 100, relatos: 10, conhecimento: 90 }),
      linha({ colaborador_id: "b", total: 100, relatos: 50, conhecimento: 50 }),
    ]);
    expect(r.map((l) => l.colaborador_id)).toEqual(["b", "a"]);
  });

  it("empate em total e relatos: decide conhecimento", () => {
    const r = ordenarIndividual([
      linha({ colaborador_id: "a", total: 100, relatos: 30, conhecimento: 40, engajamento: 30 }),
      linha({ colaborador_id: "b", total: 100, relatos: 30, conhecimento: 60, engajamento: 10 }),
    ]);
    expect(r.map((l) => l.colaborador_id)).toEqual(["b", "a"]);
  });

  it("empate em tudo: quem chegou primeiro ao total fica na frente", () => {
    const r = ordenarIndividual([
      linha({ colaborador_id: "tarde", ultimo_ponto_em: "2026-10-05T10:00:00Z" }),
      linha({ colaborador_id: "cedo", ultimo_ponto_em: "2026-10-01T10:00:00Z" }),
    ]);
    expect(r.map((l) => l.colaborador_id)).toEqual(["cedo", "tarde"]);
  });

  it("quem não tem data de último ponto vai para o fim", () => {
    const r = ordenarIndividual([
      linha({ colaborador_id: "sem", ultimo_ponto_em: null }),
      linha({ colaborador_id: "com", ultimo_ponto_em: "2026-10-01T10:00:00Z" }),
    ]);
    expect(r.map((l) => l.colaborador_id)).toEqual(["com", "sem"]);
  });

  it("não altera a lista recebida", () => {
    const original = [
      linha({ colaborador_id: "a", total: 10 }),
      linha({ colaborador_id: "b", total: 20 }),
    ];
    ordenarIndividual(original);
    expect(original.map((l) => l.colaborador_id)).toEqual(["a", "b"]);
  });

  it("aguenta lista vazia", () => {
    expect(ordenarIndividual([])).toEqual([]);
  });
});

describe("comPosicao", () => {
  it("numera de 1 em diante", () => {
    const r = comPosicao([{ total: 300 }, { total: 200 }, { total: 100 }]);
    expect(r.map((l) => l.posicao)).toEqual([1, 2, 3]);
  });

  it("empate divide a colocação e a seguinte pula", () => {
    const r = comPosicao([{ total: 300 }, { total: 200 }, { total: 200 }, { total: 100 }]);
    expect(r.map((l) => l.posicao)).toEqual([1, 2, 2, 4]);
  });

  it("todos empatados ficam todos em primeiro", () => {
    const r = comPosicao([{ total: 100 }, { total: 100 }, { total: 100 }]);
    expect(r.map((l) => l.posicao)).toEqual([1, 1, 1]);
  });

  it("lista vazia devolve vazio", () => {
    expect(comPosicao([])).toEqual([]);
  });
});

describe("medalha", () => {
  it("dá medalha só para o pódio", () => {
    expect(medalha(1)).toBe("🥇");
    expect(medalha(2)).toBe("🥈");
    expect(medalha(3)).toBe("🥉");
    expect(medalha(4)).toBeNull();
    expect(medalha(0)).toBeNull();
  });
});
