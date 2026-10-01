import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dentroDoPeriodo,
  diaOperacionalISO,
  diasEntre,
  diasRestantes,
  formatarData,
  formatarHora,
  hojeISO,
} from "./datas";

afterEach(() => {
  vi.useRealTimers();
});

describe("formatarData", () => {
  it("converte ISO para dd/MM/yyyy", () => {
    expect(formatarData("2026-10-01")).toBe("01/10/2026");
  });

  it("não desloca o dia por causa de fuso — o bug clássico de `new Date(iso)`", () => {
    // Em UTC-3, `new Date("2026-10-01")` cai em 30/09 às 21h.
    expect(formatarData("2026-10-01")).toBe("01/10/2026");
    expect(formatarData("2026-01-01")).toBe("01/01/2026");
  });

  it("aceita timestamp e usa só a data", () => {
    expect(formatarData("2026-10-01T23:30:00Z")).toBe("01/10/2026");
  });

  it("usa travessão para ausente ou inválida", () => {
    expect(formatarData(null)).toBe("—");
    expect(formatarData(undefined)).toBe("—");
    expect(formatarData("")).toBe("—");
    expect(formatarData("sem-data")).toBe("—");
  });
});

describe("formatarHora", () => {
  it("devolve hora e minuto", () => {
    expect(formatarHora("2026-10-01T14:05:00")).toMatch(/^\d{2}:\d{2}$/);
  });

  it("usa travessão para inválida", () => {
    expect(formatarHora("qualquer coisa")).toBe("—");
    expect(formatarHora(null)).toBe("—");
  });
});

describe("hojeISO", () => {
  it("devolve o dia local no formato do input de data", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 1, 23, 50));
    expect(hojeISO()).toBe("2026-10-01");
  });
});

describe("diaOperacionalISO (docs/TIME_00 §6: o dia vira às 05h)", () => {
  it("às 03h ainda conta como o dia anterior", () => {
    expect(diaOperacionalISO(new Date(2026, 9, 2, 3, 0))).toBe("2026-10-01");
  });

  it("às 06h já é o dia novo", () => {
    expect(diaOperacionalISO(new Date(2026, 9, 2, 6, 0))).toBe("2026-10-02");
  });

  it("exatamente às 05h já virou", () => {
    expect(diaOperacionalISO(new Date(2026, 9, 2, 5, 0))).toBe("2026-10-02");
  });

  it("às 04h59 ainda é o dia anterior", () => {
    expect(diaOperacionalISO(new Date(2026, 9, 2, 4, 59))).toBe("2026-10-01");
  });

  it("atravessa a virada de mês", () => {
    expect(diaOperacionalISO(new Date(2026, 10, 1, 2, 0))).toBe("2026-10-31");
  });
});

describe("diasEntre", () => {
  it("conta dias corridos", () => {
    expect(diasEntre("2026-10-01", "2026-10-08")).toBe(7);
  });

  it("é zero no mesmo dia", () => {
    expect(diasEntre("2026-10-01", "2026-10-01")).toBe(0);
  });

  it("devolve negativo para data no passado", () => {
    expect(diasEntre("2026-10-08", "2026-10-01")).toBe(-7);
  });

  it("atravessa o horário de verão sem errar a conta", () => {
    expect(diasEntre("2026-10-01", "2026-12-31")).toBe(91);
  });

  it("devolve null para entrada inválida", () => {
    expect(diasEntre("nada", "2026-10-01")).toBeNull();
  });
});

describe("diasRestantes", () => {
  it("nunca devolve negativo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 10));
    expect(diasRestantes("2026-10-01")).toBe(0);
    expect(diasRestantes("2026-10-20")).toBe(10);
  });

  it("devolve null sem data", () => {
    expect(diasRestantes(null)).toBeNull();
  });
});

describe("dentroDoPeriodo", () => {
  it("inclui as duas pontas", () => {
    expect(dentroDoPeriodo("2026-10-01", "2026-10-31", "2026-10-01")).toBe(true);
    expect(dentroDoPeriodo("2026-10-01", "2026-10-31", "2026-10-31")).toBe(true);
  });

  it("recusa fora do período", () => {
    expect(dentroDoPeriodo("2026-10-01", "2026-10-31", "2026-09-30")).toBe(false);
    expect(dentroDoPeriodo("2026-10-01", "2026-10-31", "2026-11-01")).toBe(false);
  });

  it("aceita timestamp nas pontas", () => {
    expect(dentroDoPeriodo("2026-10-01T00:00:00Z", "2026-10-31T23:59:00Z", "2026-10-15")).toBe(
      true,
    );
  });
});
