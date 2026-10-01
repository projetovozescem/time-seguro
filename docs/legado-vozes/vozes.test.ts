import { describe, expect, it } from "vitest";
import {
  LETRAS,
  alternativaTexto,
  formatarData,
  perguntasDoDia,
  pontuacaoTotal,
  tipoEvento,
  type Pergunta,
  type Turma,
} from "./vozes";

function turma(parcial: Partial<Turma> = {}): Turma {
  return {
    id: "t1",
    nome: "1A",
    serie: "1o ano",
    qr_code_url: null,
    quantidade_alunos: 30,
    pontuacao_qrcode: 0,
    pontuacao_quiz_tv: 0,
    pontuacao_compartilhamento: 0,
    status: "ativa",
    created_at: null,
    ...parcial,
  };
}

function pergunta(id: string): Pergunta {
  return {
    id,
    enunciado: `Enunciado ${id}`,
    alternativa_a: `${id}-A`,
    alternativa_b: `${id}-B`,
    alternativa_c: `${id}-C`,
    alternativa_d: `${id}-D`,
    resposta_correta: "A",
    status: "ativa",
    created_at: null,
  };
}

describe("pontuacaoTotal", () => {
  it("soma as três fontes de pontuação", () => {
    expect(
      pontuacaoTotal(
        turma({ pontuacao_qrcode: 10, pontuacao_quiz_tv: 150, pontuacao_compartilhamento: 5 }),
      ),
    ).toBe(165);
  });

  it("trata coluna nula como zero", () => {
    expect(
      pontuacaoTotal(
        turma({ pontuacao_qrcode: null, pontuacao_quiz_tv: 20, pontuacao_compartilhamento: null }),
      ),
    ).toBe(20);
  });
});

describe("alternativaTexto", () => {
  it("devolve o texto de cada letra", () => {
    const p = pergunta("p1");
    expect(LETRAS.map((l) => alternativaTexto(p, l))).toEqual(["p1-A", "p1-B", "p1-C", "p1-D"]);
  });
});

describe("formatarData", () => {
  it("converte ISO para dd/MM/yyyy sem deslocar por fuso", () => {
    expect(formatarData("2026-09-29")).toBe("29/09/2026");
    expect(formatarData("2026-01-01T23:30:00Z")).toBe("01/01/2026");
  });

  it("usa travessão para data ausente ou inválida", () => {
    expect(formatarData(null)).toBe("—");
    expect(formatarData("sem-data")).toBe("—");
  });
});

describe("perguntasDoDia", () => {
  const perguntas = Array.from({ length: 12 }, (_, i) => pergunta(`p${i}`));

  it("é determinístico para a mesma turma e o mesmo dia", () => {
    const a = perguntasDoDia(perguntas, "turma-1", "2026-09-29").map((p) => p.id);
    const b = perguntasDoDia(perguntas, "turma-1", "2026-09-29").map((p) => p.id);
    expect(a).toEqual(b);
  });

  it("devolve todas as perguntas, sem perder nem repetir", () => {
    const ids = perguntasDoDia(perguntas, "turma-1", "2026-09-29").map((p) => p.id);
    expect(ids).toHaveLength(perguntas.length);
    expect(new Set(ids).size).toBe(perguntas.length);
  });

  it("dá ordens diferentes para turmas diferentes", () => {
    const a = perguntasDoDia(perguntas, "turma-1", "2026-09-29").map((p) => p.id);
    const b = perguntasDoDia(perguntas, "turma-2", "2026-09-29").map((p) => p.id);
    expect(a).not.toEqual(b);
  });

  it("respeita um limite explícito", () => {
    expect(perguntasDoDia(perguntas, "turma-1", "2026-09-29", 5)).toHaveLength(5);
  });

  it("aguenta lista vazia", () => {
    expect(perguntasDoDia([], "turma-1", "2026-09-29")).toEqual([]);
  });
});

describe("tipoEvento", () => {
  it("devolve o visual do tipo conhecido", () => {
    expect(tipoEvento("palestra").emoji).toBe("🎤");
  });

  it("cai no padrão para tipo desconhecido ou ausente", () => {
    expect(tipoEvento("inexistente").rotulo).toBe("Geral");
    expect(tipoEvento(null).rotulo).toBe("Geral");
    expect(tipoEvento(undefined).rotulo).toBe("Geral");
  });
});
