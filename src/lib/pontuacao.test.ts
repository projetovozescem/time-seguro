import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import {
  EMOJI_DO_PILAR,
  TEXTO_DA_ORIGEM,
  agruparExtratoPorDia,
  ordenarSelos,
  somarPorPilar,
  textoDaOrigem,
  type LinhaExtrato,
  type Selo,
} from "./pontuacao";

const SQL = readdirSync("supabase/migrations")
  .filter((n) => n.endsWith(".sql"))
  .map((n) => readFileSync(`supabase/migrations/${n}`, "utf8"))
  .join("\n");

describe("toda origem que o SQL lança tem texto (docs/TIME_08 §7)", () => {
  it("as origens fixas estão traduzidas", () => {
    // `_lancar_pontos(campanha, colab, setor, 'pilar', 'origem', ...)`
    const origens = new Set(
      [
        ...SQL.matchAll(
          /_lancar_pontos\([^)]*?'(?:conhecimento|relatos|engajamento)',\s*'([a-z_0-9]+)'/g,
        ),
      ].map((m) => m[1]!),
    );

    expect(origens.size, "nenhuma origem encontrada no SQL").toBeGreaterThan(5);

    // `streak_` vem da concatenação `'streak_' || v_marco`; tem asserção própria.
    const semTexto = [...origens].filter((o) => o !== "streak_" && !(o in TEXTO_DA_ORIGEM));
    expect(semTexto).toEqual([]);
  });

  it("as três sequências estão traduzidas, mesmo sendo montadas por concatenação", () => {
    expect(SQL).toMatch(/'streak_'\s*\|\|/);
    for (const marco of [7, 15, 30]) {
      expect(TEXTO_DA_ORIGEM[`streak_${marco}`]).toBeTruthy();
    }
  });

  it("nenhum texto expõe o código cru", () => {
    for (const [chave, texto] of Object.entries(TEXTO_DA_ORIGEM)) {
      expect(texto).not.toBe(chave);
      expect(texto).not.toMatch(/_/);
    }
  });

  it("os três pilares têm emoji", () => {
    expect(Object.keys(EMOJI_DO_PILAR)).toEqual(["conhecimento", "relatos", "engajamento"]);
  });
});

describe("textoDaOrigem", () => {
  it("traduz o que conhece", () => {
    expect(textoDaOrigem("quiz_diario")).toBe("Acerto no quiz do dia");
    expect(textoDaOrigem("checkin")).toBe("Presença em DDS/SIPAT");
  });

  it("origem desconhecida não vira código na tela", () => {
    expect(textoDaOrigem("streak_60")).toBe("Pontos ganhos");
    expect(textoDaOrigem(null)).toBe("Pontos ganhos");
    expect(textoDaOrigem("")).toBe("Pontos ganhos");
  });
});

function linha(parcial: Partial<LinhaExtrato> = {}): LinhaExtrato {
  return {
    pilar: "conhecimento",
    origem: "quiz_diario",
    pontos: 10,
    em: "2026-10-02T08:00:00Z",
    ...parcial,
  };
}

describe("somarPorPilar", () => {
  it("soma cada pilar separado", () => {
    expect(
      somarPorPilar([
        linha({ pilar: "conhecimento", pontos: 10 }),
        linha({ pilar: "conhecimento", pontos: 30 }),
        linha({ pilar: "relatos", pontos: 40 }),
        linha({ pilar: "engajamento", pontos: 2 }),
      ]),
    ).toEqual({ conhecimento: 40, relatos: 40, engajamento: 2 });
  });

  it("devolve zeros para extrato vazio", () => {
    expect(somarPorPilar([])).toEqual({ conhecimento: 0, relatos: 0, engajamento: 0 });
  });

  it("ignora pilar que não existe em vez de quebrar", () => {
    expect(somarPorPilar([linha({ pilar: "inventado" as never, pontos: 99 })])).toEqual({
      conhecimento: 0,
      relatos: 0,
      engajamento: 0,
    });
  });
});

describe("agruparExtratoPorDia", () => {
  it("agrupa e soma por dia, do mais recente para o mais antigo", () => {
    const grupos = agruparExtratoPorDia([
      linha({ em: "2026-10-01T08:00:00Z", pontos: 10 }),
      linha({ em: "2026-10-02T08:00:00Z", pontos: 30 }),
      linha({ em: "2026-10-02T09:00:00Z", pontos: 10 }),
    ]);

    expect(grupos.map((g) => g.dia)).toEqual(["2026-10-02", "2026-10-01"]);
    expect(grupos[0]!.total).toBe(40);
    expect(grupos[0]!.linhas).toHaveLength(2);
    expect(grupos[1]!.total).toBe(10);
  });

  it("devolve lista vazia para extrato vazio", () => {
    expect(agruparExtratoPorDia([])).toEqual([]);
  });
});

function selo(parcial: Partial<Selo> = {}): Selo {
  return {
    slug: "primeiro-passo",
    nome: "Primeiro Passo",
    descricao: "Respondeu a primeira pergunta",
    icone: "👣",
    conquistado: false,
    em: null,
    ...parcial,
  };
}

describe("ordenarSelos", () => {
  it("põe os conquistados primeiro", () => {
    const ordenados = ordenarSelos([
      selo({ slug: "a", conquistado: false }),
      selo({ slug: "b", conquistado: true }),
      selo({ slug: "c", conquistado: false }),
      selo({ slug: "d", conquistado: true }),
    ]);
    expect(ordenados.map((s) => s.slug)).toEqual(["b", "d", "a", "c"]);
  });

  it("não altera a lista recebida", () => {
    const original = [selo({ slug: "a" }), selo({ slug: "b", conquistado: true })];
    ordenarSelos(original);
    expect(original.map((s) => s.slug)).toEqual(["a", "b"]);
  });

  it("os 10 selos do seed têm slug distinto", () => {
    const slugs = [...SQL.matchAll(/insert into public\.selos[\s\S]*?on conflict/g)]
      .flatMap((m) => [...m[0].matchAll(/\('([a-z-]+)',/g)])
      .map((m) => m[1]!);
    expect(slugs.length).toBe(10);
    expect(new Set(slugs).size).toBe(10);
  });
});
