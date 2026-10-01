import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  ASSINATURAS,
  AVISO_OBRIGATORIO,
  ROTULO_DA_SITUACAO,
  agregarCanal,
  cargaEmHoras,
  resumir,
  situacaoDe,
  type LinhaEvidencia,
} from "./relatorio";

function linha(parcial: Partial<LinhaEvidencia> = {}): LinhaEvidencia {
  return {
    matricula: "1001",
    nome: "Carlos",
    setor: "Manutenção",
    licao: "NR-35",
    concluido_em: "2026-10-01",
    nota: 90,
    tentativas: 1,
    situacao: "aprovado",
    ...parcial,
  };
}

describe("aviso obrigatório (docs/TIME_09 §2.6)", () => {
  it("é o texto do documento, sem corte", () => {
    const doc = readFileSync("docs/TIME_09_RELATORIOS_ANALYTICS.md", "utf8");
    // O documento escreve o aviso como citação (`> `) em várias linhas, com
    // ênfase em `_`. Compara sem a formatação do Markdown.
    const semFormatacao = (t: string) =>
      t.replace(/^>\s?/gm, "").replace(/[_"]/g, "").replace(/\s+/g, " ").trim();
    expect(semFormatacao(doc)).toContain(semFormatacao(AVISO_OBRIGATORIO));
  });

  it("diz explicitamente que não substitui treinamento de NR", () => {
    expect(AVISO_OBRIGATORIO).toContain("Não substitui os treinamentos");
    expect(AVISO_OBRIGATORIO).toContain("Normas Regulamentadoras");
  });

  it("tem os dois campos de assinatura", () => {
    expect([...ASSINATURAS]).toEqual(["Técnico de Segurança do Trabalho", "Representante da CIPA"]);
  });
});

describe("agregarCanal — só número, nunca conteúdo", () => {
  /**
   * O teste mais importante deste arquivo. A função recebe só `recebida_em` e
   * `status`: o dado sensível não chega nela, então não há como vazar para o PDF
   * por descuido.
   */
  it("devolve apenas mês, status e quantidade", () => {
    const r = agregarCanal([
      { recebida_em: "2026-10-01", status: "recebida" },
      { recebida_em: "2026-10-15", status: "recebida" },
      { recebida_em: "2026-10-20", status: "concluida" },
      { recebida_em: "2026-11-02", status: "recebida" },
    ]);

    expect(r).toEqual([
      { mes: "2026-10", status: "concluida", quantidade: 1 },
      { mes: "2026-10", status: "recebida", quantidade: 2 },
      { mes: "2026-11", status: "recebida", quantidade: 1 },
    ]);

    // Nenhuma chave além destas três.
    for (const item of r) {
      expect(Object.keys(item).sort()).toEqual(["mes", "quantidade", "status"]);
    }
  });

  it("não expõe o dia, só o mês", () => {
    const r = agregarCanal([{ recebida_em: "2026-10-17", status: "recebida" }]);
    expect(r[0]!.mes).toBe("2026-10");
    expect(JSON.stringify(r)).not.toContain("17");
  });

  it("campos sensíveis ignorados mesmo se vierem no objeto", () => {
    const r = agregarCanal([
      {
        recebida_em: "2026-10-01",
        status: "recebida",
        // Mesmo que alguém passe isso, não sai no resultado.
        descricao: "conteudo sigiloso",
        protocolo: "RS-12345678",
        categoria: "moral",
      } as never,
    ]);
    const texto = JSON.stringify(r);
    expect(texto).not.toContain("sigiloso");
    expect(texto).not.toContain("RS-");
    expect(texto).not.toContain("moral");
  });

  it("devolve vazio sem denúncia", () => {
    expect(agregarCanal([])).toEqual([]);
  });
});

describe("situacaoDe", () => {
  it("aprovado só com data de aprovação", () => {
    expect(situacaoDe("2026-10-01")).toBe("aprovado");
    expect(situacaoDe(null)).toBe("pendente");
  });

  it("os rótulos não expõem snake_case", () => {
    for (const r of Object.values(ROTULO_DA_SITUACAO)) expect(r).not.toMatch(/_/);
  });
});

describe("resumir", () => {
  const carga = new Map([
    ["NR-35", 30],
    ["EPI", 20],
  ]);

  it("conta colaboradores distintos", () => {
    const r = resumir(
      [
        linha({ matricula: "1" }),
        linha({ matricula: "1", licao: "EPI" }),
        linha({ matricula: "2" }),
      ],
      carga,
    );
    expect(r.colaboradores).toBe(2);
  });

  /** Aprovar uma de duas não conclui a trilha — isso inflaria a evidência. */
  it("concluinte é quem foi aprovado em TODAS as lições do escopo", () => {
    const r = resumir(
      [
        linha({ matricula: "1", licao: "NR-35", situacao: "aprovado" }),
        linha({ matricula: "1", licao: "EPI", situacao: "aprovado" }),
        linha({ matricula: "2", licao: "NR-35", situacao: "aprovado" }),
        linha({ matricula: "2", licao: "EPI", situacao: "pendente", nota: null }),
      ],
      carga,
    );
    expect(r.concluintes).toBe(1);
    expect(r.percentualConclusao).toBe(50);
  });

  it("soma a carga das lições do escopo, sem repetir por pessoa", () => {
    const r = resumir(
      [
        linha({ matricula: "1", licao: "NR-35" }),
        linha({ matricula: "2", licao: "NR-35" }),
        linha({ matricula: "1", licao: "EPI" }),
      ],
      carga,
    );
    expect(r.cargaTotalMinutos).toBe(50);
  });

  it("nota média ignora pendente sem nota", () => {
    const r = resumir(
      [
        linha({ nota: 100 }),
        linha({ matricula: "2", nota: 80 }),
        linha({ matricula: "3", nota: null }),
      ],
      carga,
    );
    expect(r.notaMedia).toBe(90);
  });

  it("escopo vazio não divide por zero", () => {
    const r = resumir([], carga);
    expect(r).toEqual({
      colaboradores: 0,
      concluintes: 0,
      percentualConclusao: 0,
      notaMedia: null,
      cargaTotalMinutos: 0,
    });
  });
});

describe("cargaEmHoras", () => {
  it("formata minutos, horas e mistura", () => {
    expect(cargaEmHoras(45)).toBe("45min");
    expect(cargaEmHoras(120)).toBe("2h");
    expect(cargaEmHoras(150)).toBe("2h30");
    expect(cargaEmHoras(0)).toBe("0min");
  });

  it("zero-padding no resto", () => {
    expect(cargaEmHoras(65)).toBe("1h05");
  });
});
