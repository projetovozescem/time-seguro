import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import {
  CARTOES_POR_FOLHA,
  MODELO_CSV_COLABORADORES,
  TURNOS,
  emFolhas,
  lerCsvColaboradores,
  paraImportar,
  rotuloDoTurno,
} from "./colaboradores";

describe("lerCsvColaboradores", () => {
  const csv = [
    "matricula;nome;setor;turno",
    "1001;Carlos Souza;Manutenção;manha",
    "1002;Ana Lima;Expedição;tarde",
  ].join("\n");

  it("lê as colunas do formato de docs/TIME_04 §6", () => {
    const linhas = lerCsvColaboradores(csv);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({
      linha: 2,
      matricula: "1001",
      nome: "Carlos Souza",
      setor: "Manutenção",
      turno: "manha",
      erros: [],
    });
  });

  it("numera as linhas como o técnico vê: a primeira de dado é a 2", () => {
    expect(lerCsvColaboradores(csv).map((l) => l.linha)).toEqual([2, 3]);
  });

  it("aceita vírgula como separador", () => {
    const linhas = lerCsvColaboradores("matricula,nome,setor,turno\n1001,Carlos,Manutenção,manha");
    expect(linhas[0]!.nome).toBe("Carlos");
  });

  it("aceita cabeçalho em qualquer ordem e sem acento", () => {
    const linhas = lerCsvColaboradores("Nome;Turno;Matricula;Setor\nCarlos;manha;1001;Manutenção");
    expect(linhas[0]).toMatchObject({ matricula: "1001", nome: "Carlos", turno: "manha" });
  });

  it("ignora o BOM do Excel", () => {
    const linhas = lerCsvColaboradores("﻿matricula;nome\n1001;Carlos");
    expect(linhas[0]!.matricula).toBe("1001");
    expect(linhas[0]!.erros).toEqual([]);
  });

  it("aponta matrícula e nome vazios, sem rejeitar o arquivo", () => {
    const linhas = lerCsvColaboradores("matricula;nome\n;Carlos\n1002;");
    expect(linhas).toHaveLength(2);
    expect(linhas[0]!.erros).toContain("Matrícula vazia.");
    expect(linhas[1]!.erros).toContain("Nome vazio.");
  });

  it("aponta turno que não existe, citando os válidos", () => {
    const linhas = lerCsvColaboradores("matricula;nome;turno\n1001;Carlos;madrugada");
    expect(linhas[0]!.erros[0]).toContain("madrugada");
    expect(linhas[0]!.erros[0]).toContain("manha");
  });

  it("turno vazio é aceito — é campo opcional", () => {
    const linhas = lerCsvColaboradores("matricula;nome;turno\n1001;Carlos;");
    expect(linhas[0]!.erros).toEqual([]);
  });

  it("aponta matrícula repetida no arquivo, marcando só a segunda", () => {
    const linhas = lerCsvColaboradores("matricula;nome\n1001;Carlos\n1001;Outro");
    expect(linhas[0]!.erros).toEqual([]);
    expect(linhas[1]!.erros).toContain("Matrícula repetida no arquivo.");
  });

  it("devolve vazio para arquivo só com cabeçalho ou vazio", () => {
    expect(lerCsvColaboradores("matricula;nome")).toEqual([]);
    expect(lerCsvColaboradores("")).toEqual([]);
  });

  it("o modelo para download é importável sem erro", () => {
    const linhas = lerCsvColaboradores(MODELO_CSV_COLABORADORES);
    expect(linhas).toHaveLength(2);
    expect(linhas.every((l) => l.erros.length === 0)).toBe(true);
  });
});

describe("turnos", () => {
  /**
   * `colaboradores.turno` é `text` LIVRE no schema: não há CHECK. A lista de
   * TURNOS é convenção desta interface, não regra do banco — está registrado em
   * memory/duvidas.md. O teste afirma o que de fato vale: o schema não
   * restringe, e a tela não quebra com um turno fora da lista.
   */
  it("o schema NÃO restringe turno — a lista é convenção da tela", () => {
    const sql = readdirSync("supabase/migrations")
      .filter((n) => n.endsWith(".sql"))
      .map((n) => readFileSync(`supabase/migrations/${n}`, "utf8"))
      .join("\n");
    expect(sql).toMatch(/turno\s+text,?\s*$/m);
    expect(sql).not.toMatch(/turno\s+text[^,\n]*check/i);
  });

  it("todo turno tem rótulo sem snake_case", () => {
    for (const t of TURNOS) {
      expect(rotuloDoTurno(t)).not.toBe(t);
      expect(rotuloDoTurno(t)).not.toMatch(/_/);
    }
  });

  it("turno nulo ou desconhecido não quebra a tela", () => {
    expect(rotuloDoTurno(null)).toBe("—");
    expect(rotuloDoTurno("inventado")).toBe("inventado");
  });
});

describe("paraImportar", () => {
  it("manda só as linhas sem erro", () => {
    const linhas = lerCsvColaboradores("matricula;nome\n1001;Carlos\n;SemMatricula\n1003;Ana");
    const prontas = paraImportar(linhas);
    expect(prontas).toHaveLength(2);
    expect(prontas.map((p) => p.matricula)).toEqual(["1001", "1003"]);
  });

  it("devolve só os quatro campos que a RPC espera", () => {
    const [p] = paraImportar(
      lerCsvColaboradores("matricula;nome;setor;turno\n1001;Carlos;Manut;manha"),
    );
    expect(Object.keys(p!).sort()).toEqual(["matricula", "nome", "setor", "turno"]);
  });

  it("nada para importar devolve lista vazia", () => {
    expect(paraImportar(lerCsvColaboradores("matricula;nome\n;"))).toEqual([]);
  });
});

describe("emFolhas", () => {
  it("quebra de 8 em 8, como a folha A4 de cartões", () => {
    expect(CARTOES_POR_FOLHA).toBe(8);
    const folhas = emFolhas(Array.from({ length: 19 }, (_, i) => i));
    expect(folhas.map((f) => f.length)).toEqual([8, 8, 3]);
  });

  it("lista vazia não gera folha", () => {
    expect(emFolhas([])).toEqual([]);
  });
});
