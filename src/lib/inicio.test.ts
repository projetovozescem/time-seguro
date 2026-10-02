import { describe, expect, it } from "vitest";
import {
  alertasDeAcesso,
  aguardandoValidacao,
  gravesParados,
  participacao7dias,
  pessoasAtivasPorDia,
  ultimosDias,
} from "./inicio";

describe("ultimosDias", () => {
  it("termina em hoje, do mais antigo ao mais novo", () => {
    expect(ultimosDias(3, "2026-03-02")).toEqual(["2026-02-28", "2026-03-01", "2026-03-02"]);
  });
  it("devolve a quantidade pedida", () => {
    expect(ultimosDias(30, "2026-03-31")).toHaveLength(30);
  });
});

describe("pessoasAtivasPorDia", () => {
  it("conta pessoas distintas e preenche dia sem atividade com zero", () => {
    const r = pessoasAtivasPorDia(
      [
        { colaborador_id: "a", dia: "2026-03-01" },
        { colaborador_id: "a", dia: "2026-03-01" },
        { colaborador_id: "b", dia: "2026-03-01" },
      ],
      ["2026-03-01", "2026-03-02"],
    );
    expect(r).toEqual([
      { dia: "2026-03-01", pessoas: 2 },
      { dia: "2026-03-02", pessoas: 0 },
    ]);
  });
});

describe("participacao7dias", () => {
  const hoje = "2026-03-10";
  it("conta quem teve atividade nos últimos 7 dias", () => {
    const at = [
      { colaborador_id: "a", dia: "2026-03-09" },
      { colaborador_id: "b", dia: "2026-03-01" }, // fora da janela
    ];
    expect(participacao7dias(at, ["a", "b", "c", "d"], hoje)).toBe(25);
  });
  it("atividade de quem não é mais ativo não infla o número", () => {
    const at = [{ colaborador_id: "desligado", dia: "2026-03-09" }];
    expect(participacao7dias(at, ["a"], hoje)).toBe(0);
  });
  it("sem efetivo é zero", () => {
    expect(participacao7dias([], [], hoje)).toBe(0);
  });
});

describe("relatos", () => {
  const base = {
    status: "aberto",
    validado: false,
    gravidade: null,
    criado_em: "2026-03-01T08:00:00Z",
  };
  it("aguardando validação: só aberto e não validado", () => {
    expect(
      aguardandoValidacao([base, { ...base, status: "em_analise" }, { ...base, validado: true }]),
    ).toBe(1);
  });
  const agora = new Date("2026-03-10T12:00:00Z");
  it("grave parado: alta, não encerrado, há mais de 3 dias", () => {
    expect(
      gravesParados(
        [
          { ...base, gravidade: "alta" },
          { ...base, gravidade: "alta", status: "resolvido" },
          { ...base, gravidade: "media" },
          { ...base, gravidade: "alta", criado_em: "2026-03-09T08:00:00Z" }, // recente
        ],
        agora,
      ),
    ).toBe(1);
  });
});

describe("alertasDeAcesso", () => {
  const agora = new Date("2026-03-10T12:00:00Z");
  const c = {
    ativo: true,
    anonimizado: false,
    lgpd_aceite_em: "2026-03-01T08:00:00Z" as string | null,
    bloqueado_ate: null,
  };
  it("conta bloqueados com bloqueio vigente e quem ainda não fez o primeiro acesso", () => {
    const r = alertasDeAcesso(
      [
        { ...c, bloqueado_ate: "2026-03-10T12:10:00Z" },
        { ...c, bloqueado_ate: "2026-03-10T11:00:00Z" }, // já expirou
        { ...c, lgpd_aceite_em: null },
        { ...c, ativo: false, lgpd_aceite_em: null },
      ],
      agora,
    );
    expect(r).toEqual({ bloqueados: 1, semPrimeiroAcesso: 1 });
  });
});
