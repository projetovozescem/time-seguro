import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import {
  TIPOS_EVENTO,
  agruparPorDia,
  definicaoDoTipo,
  montarCsv,
  paraInputDataHora,
  pontosPadrao,
  validarEvento,
  type EventoForm,
} from "./eventos";

function evento(parcial: Partial<EventoForm> = {}): EventoForm {
  return {
    titulo: "DDS da manhã",
    tipo: "dds",
    inicio: "2026-10-02T07:00",
    fim: "2026-10-02T07:15",
    setor_id: null,
    pontos: 5,
    campanha_id: null,
    descricao: "",
    ...parcial,
  };
}

describe("tipos de evento batem com o CHECK do banco", () => {
  const sql = readdirSync("supabase/migrations")
    .filter((n) => n.endsWith(".sql"))
    .map((n) => readFileSync(`supabase/migrations/${n}`, "utf8"))
    .join("\n");

  it("os quatro tipos da tela são os aceitos pelo schema", () => {
    for (const t of TIPOS_EVENTO) {
      expect(sql).toContain(`'${t.tipo}'`);
    }
    // O CHECK da coluna lista exatamente estes quatro.
    expect(sql).toMatch(/tipo\s+text\s+not null\s+check\s*\(\s*tipo\s+in\s*\(/i);
  });

  it("não há tipo repetido e todos têm emoji e cor", () => {
    expect(new Set(TIPOS_EVENTO.map((t) => t.tipo)).size).toBe(TIPOS_EVENTO.length);
    for (const t of TIPOS_EVENTO) {
      expect(t.emoji.length).toBeGreaterThan(0);
      expect(t.cor).toContain("text-");
    }
  });
});

describe("pontosPadrao (docs/TIME_04 §8)", () => {
  it("DDS 5, SIPAT 15, Treinamento 15", () => {
    expect(pontosPadrao("dds")).toBe(5);
    expect(pontosPadrao("sipat")).toBe(15);
    expect(pontosPadrao("treinamento")).toBe(15);
  });

  it("Outro não pontua por padrão", () => {
    expect(pontosPadrao("outro")).toBe(0);
  });

  it("tipo desconhecido cai em Outro em vez de quebrar", () => {
    expect(definicaoDoTipo("inexistente").tipo).toBe("outro");
    expect(pontosPadrao("inexistente")).toBe(0);
  });
});

describe("validarEvento", () => {
  it("aceita um evento completo", () => {
    expect(validarEvento(evento())).toEqual([]);
  });

  it("exige título e as duas datas", () => {
    expect(validarEvento(evento({ titulo: "ab", inicio: "", fim: "" }))).toHaveLength(3);
  });

  it("recusa fim igual ou antes do início — é o CHECK do banco", () => {
    expect(
      validarEvento(evento({ inicio: "2026-10-02T07:00", fim: "2026-10-02T07:00" })).some((e) =>
        e.includes("depois do início"),
      ),
    ).toBe(true);
    expect(
      validarEvento(evento({ inicio: "2026-10-02T08:00", fim: "2026-10-02T07:00" })),
    ).not.toEqual([]);
  });

  it("limita pontos entre 0 e 100", () => {
    for (const p of [-1, 101, 2.5]) {
      expect(validarEvento(evento({ pontos: p })).some((e) => e.includes("0 a 100"))).toBe(true);
    }
    for (const p of [0, 5, 100]) {
      expect(validarEvento(evento({ pontos: p }))).toEqual([]);
    }
  });
});

describe("montarCsv (docs/TIME_09: sempre ; e BOM)", () => {
  it("começa com BOM e separa por ponto e vírgula", () => {
    const csv = montarCsv(["nome", "setor"], [["Carlos", "Manutenção"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("nome;setor");
    expect(csv).toContain("Carlos;Manutenção");
  });

  it("protege campo que contém o separador", () => {
    const csv = montarCsv(["a"], [["tem ; dentro"]]);
    expect(csv).toContain('"tem ; dentro"');
  });

  it("escapa aspas dobrando", () => {
    const csv = montarCsv(["a"], [['disse "oi"']]);
    expect(csv).toContain('"disse ""oi"""');
  });

  it("protege campo com quebra de linha", () => {
    expect(montarCsv(["a"], [["linha1\nlinha2"]])).toContain('"linha1\nlinha2"');
  });

  it("trata null e undefined como vazio", () => {
    expect(montarCsv(["a", "b"], [[null, undefined]])).toContain("﻿a;b\r\n;\r\n");
  });

  it("usa CRLF entre as linhas", () => {
    expect(montarCsv(["a"], [["1"], ["2"]])).toBe("﻿a\r\n1\r\n2\r\n");
  });
});

describe("paraInputDataHora", () => {
  it("devolve o formato do input datetime-local", () => {
    expect(paraInputDataHora("2026-10-02T07:00:00")).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("devolve vazio para ausente ou inválida", () => {
    expect(paraInputDataHora(null)).toBe("");
    expect(paraInputDataHora("nada")).toBe("");
  });
});

describe("agruparPorDia", () => {
  it("agrupa pela data do início", () => {
    const grupos = agruparPorDia([
      { inicio: "2026-10-02T07:00:00" },
      { inicio: "2026-10-02T14:00:00" },
      { inicio: "2026-10-03T07:00:00" },
    ]);
    expect([...grupos.keys()]).toEqual(["2026-10-02", "2026-10-03"]);
    expect(grupos.get("2026-10-02")).toHaveLength(2);
  });

  it("devolve mapa vazio para lista vazia", () => {
    expect(agruparPorDia([]).size).toBe(0);
  });
});
