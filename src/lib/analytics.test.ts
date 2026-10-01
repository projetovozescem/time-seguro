import { describe, expect, it } from "vitest";
import {
  calorPorLocal,
  contarPor,
  distribuicaoDeSequencias,
  formatarDuracao,
  horaDePico,
  mediaDeHoras,
  percentualResolvidos,
  sequenciaAtual,
  usoPorHora,
  type Relato,
} from "./analytics";

function relato(p: Partial<Relato> = {}): Relato {
  return {
    categoria: "condicao_insegura",
    gravidade: null,
    status: "aberto",
    setor_id: null,
    local_id: null,
    criado_em: "2026-03-01T08:00:00Z",
    validado_em: null,
    ...p,
  };
}

describe("contarPor", () => {
  it("conta e ordena do maior para o menor", () => {
    const itens = [{ t: "a" }, { t: "b" }, { t: "a" }, { t: "c" }, { t: "a" }];
    expect(contarPor(itens, (i) => i.t)).toEqual([
      { rotulo: "a", quantidade: 3 },
      { rotulo: "b", quantidade: 1 },
      { rotulo: "c", quantidade: 1 },
    ]);
  });

  it("empate sai em ordem alfabética do pt-BR", () => {
    const itens = [{ t: "Usinagem" }, { t: "Almoxarifado" }, { t: "Expedição" }];
    expect(contarPor(itens, (i) => i.t).map((c) => c.rotulo)).toEqual([
      "Almoxarifado",
      "Expedição",
      "Usinagem",
    ]);
  });

  it("nulo e vazio caem no mesmo rótulo", () => {
    const itens = [{ t: null }, { t: "" }, { t: "a" }];
    expect(contarPor(itens, (i) => i.t)).toEqual([
      { rotulo: "Sem informação", quantidade: 2 },
      { rotulo: "a", quantidade: 1 },
    ]);
  });
});

describe("mediaDeHoras", () => {
  it("ignora o par incompleto em vez de contá-lo como zero", () => {
    const media = mediaDeHoras([
      { de: "2026-03-01T08:00:00Z", ate: "2026-03-01T12:00:00Z" },
      { de: "2026-03-01T08:00:00Z", ate: null },
    ]);
    expect(media).toBe(4);
  });

  it("sem nenhum par completo devolve null, nunca zero", () => {
    expect(mediaDeHoras([{ de: "2026-03-01T08:00:00Z", ate: null }])).toBeNull();
    expect(mediaDeHoras([])).toBeNull();
  });

  it("descarta par invertido (fechado antes de abrir)", () => {
    expect(mediaDeHoras([{ de: "2026-03-02T08:00:00Z", ate: "2026-03-01T08:00:00Z" }])).toBeNull();
  });
});

describe("formatarDuracao", () => {
  it("null vira travessão, não 0", () => {
    expect(formatarDuracao(null)).toBe("—");
  });

  it("menos de uma hora sai em minutos", () => {
    expect(formatarDuracao(0.5)).toBe("30 min");
  });

  it("até dois dias sai em horas; acima, em dias", () => {
    expect(formatarDuracao(18)).toBe("18 h");
    expect(formatarDuracao(54)).toBe("2 d 6 h");
    expect(formatarDuracao(72)).toBe("3 d");
  });
});

describe("percentualResolvidos", () => {
  it("conta só o status resolvido", () => {
    const relatos = [
      relato({ status: "resolvido" }),
      relato({ status: "resolvido" }),
      relato({ status: "em_correcao" }),
      relato({ status: "aberto" }),
    ];
    expect(percentualResolvidos(relatos)).toBe(50);
  });

  it("sem relato é 0%", () => {
    expect(percentualResolvidos([])).toBe(0);
  });
});

describe("calorPorLocal", () => {
  const nome = (id: string) => ({ l1: "Prensa 03", l2: "Painel QGBT" })[id] ?? id;

  it("ignora relato sem local", () => {
    const r = calorPorLocal([relato(), relato({ local_id: "l1" })], nome);
    expect(r).toEqual([{ local: "Prensa 03", total: 1, graves: 0 }]);
  });

  it("no empate, o local com relato grave vem primeiro", () => {
    const relatos = [
      relato({ local_id: "l1" }),
      relato({ local_id: "l1" }),
      relato({ local_id: "l2", gravidade: "alta" }),
      relato({ local_id: "l2" }),
    ];
    expect(calorPorLocal(relatos, nome).map((c) => c.local)).toEqual(["Painel QGBT", "Prensa 03"]);
  });
});

describe("sequenciaAtual", () => {
  it("conta dias seguidos terminando hoje", () => {
    expect(sequenciaAtual(["2026-03-08", "2026-03-09", "2026-03-10"], "2026-03-10")).toBe(3);
  });

  it("quem fez ontem e ainda não fez hoje mantém a sequência", () => {
    expect(sequenciaAtual(["2026-03-08", "2026-03-09"], "2026-03-10")).toBe(2);
  });

  it("dois dias de buraco zera", () => {
    expect(sequenciaAtual(["2026-03-07", "2026-03-08"], "2026-03-10")).toBe(0);
  });

  it("conta só até o buraco mais recente", () => {
    expect(
      sequenciaAtual(["2026-03-01", "2026-03-02", "2026-03-09", "2026-03-10"], "2026-03-10"),
    ).toBe(2);
  });

  it("atravessa a virada do mês", () => {
    expect(sequenciaAtual(["2026-02-27", "2026-02-28", "2026-03-01"], "2026-03-01")).toBe(3);
  });

  it("dia repetido não conta duas vezes", () => {
    expect(sequenciaAtual(["2026-03-10", "2026-03-10"], "2026-03-10")).toBe(1);
  });

  it("sem dia nenhum é zero", () => {
    expect(sequenciaAtual([], "2026-03-10")).toBe(0);
  });

  it("aceita timestamp completo, não só a data", () => {
    expect(sequenciaAtual(["2026-03-10T07:30:00Z"], "2026-03-10")).toBe(1);
  });
});

describe("distribuicaoDeSequencias", () => {
  it("quem nunca abriu o app entra como sem sequência", () => {
    const dias = new Map([["c1", ["2026-03-09", "2026-03-10"]]]);
    const d = distribuicaoDeSequencias(dias, ["c1", "c2", "c3"], "2026-03-10");
    expect(d).toEqual([
      { rotulo: "sem sequência", quantidade: 2 },
      { rotulo: "1 a 6 dias", quantidade: 1 },
      { rotulo: "7 a 14 dias", quantidade: 0 },
      { rotulo: "15 dias ou mais", quantidade: 0 },
    ]);
  });

  it("a soma fecha com o número de ativos", () => {
    const ativos = ["a", "b", "c", "d"];
    const dias = new Map([
      ["a", Array.from({ length: 20 }, (_, i) => `2026-03-${String(i + 1).padStart(2, "0")}`)],
      [
        "b",
        [
          "2026-03-04",
          "2026-03-05",
          "2026-03-06",
          "2026-03-07",
          "2026-03-08",
          "2026-03-09",
          "2026-03-10",
        ],
      ],
    ]);
    const d = distribuicaoDeSequencias(dias, ativos, "2026-03-20");
    expect(d.reduce((s, f) => s + f.quantidade, 0)).toBe(4);
    expect(d.find((f) => f.rotulo === "15 dias ou mais")!.quantidade).toBe(1);
  });
});

describe("usoPorHora", () => {
  it("devolve sempre as 24 horas, inclusive as vazias", () => {
    const horas = usoPorHora(["2026-03-10T10:00:00"]);
    expect(horas).toHaveLength(24);
    expect(horas.map((h) => h.hora)).toEqual(Array.from({ length: 24 }, (_, i) => i));
  });

  it("agrupa na hora local do navegador", () => {
    const horas = usoPorHora(["2026-03-10T07:10:00", "2026-03-10T07:50:00"]);
    expect(horas[7]).toEqual({ hora: 7, quantidade: 2 });
  });

  it("hora de pico é null quando não há dado", () => {
    expect(horaDePico([])).toBeNull();
  });

  it("hora de pico é a de maior uso", () => {
    expect(horaDePico(["2026-03-10T06:00:00", "2026-03-10T13:00:00", "2026-03-10T13:30:00"])).toBe(
      13,
    );
  });
});
