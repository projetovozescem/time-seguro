import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import {
  CATEGORIAS,
  COLUNAS_KANBAN,
  GRAVIDADES,
  MINIMO_DESCRICAO,
  STATUS,
  STATUS_DE_ANDAMENTO,
  corDoStatus,
  definicaoDaCategoria,
  descricaoValida,
  rotuloDaCategoria,
  rotuloDoStatus,
} from "./relatos";

const SQL = readdirSync("supabase/migrations")
  .filter((n) => n.endsWith(".sql"))
  .map((n) => readFileSync(`supabase/migrations/${n}`, "utf8"))
  .join("\n");

/** Extrai os valores de um `check (coluna in ('a','b'))` do SQL. */
function valoresDoCheck(tabela: string, coluna: string): string[] {
  const inicio = SQL.indexOf(`create table public.${tabela}`);
  expect(inicio, `tabela ${tabela} não encontrada`).toBeGreaterThan(-1);
  const corpo = SQL.slice(inicio, SQL.indexOf(");", inicio));
  const re = new RegExp(
    `${coluna}\\s+text[^,]*?check\\s*\\(\\s*${coluna}\\s+in\\s*\\(([^)]+)\\)`,
    "i",
  );
  const achado = re.exec(corpo);
  expect(achado, `check de ${tabela}.${coluna} não encontrado`).toBeTruthy();
  return [...achado![1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);
}

describe("categorias batem com o CHECK do banco", () => {
  it("as quatro categorias da tela são exatamente as do schema", () => {
    const noBanco = valoresDoCheck("relatos", "categoria");
    expect([...CATEGORIAS.map((c) => c.categoria)].sort()).toEqual([...noBanco].sort());
  });

  it("cada categoria tem rótulo, emoji e ajuda em linguagem simples", () => {
    for (const c of CATEGORIAS) {
      expect(c.rotulo.length).toBeGreaterThan(3);
      expect(c.emoji.length).toBeGreaterThan(0);
      expect(c.ajuda.length).toBeGreaterThan(20);
      expect(c.ajuda).not.toMatch(/_/);
    }
  });

  it("rotuloDaCategoria nunca devolve o código cru", () => {
    for (const c of CATEGORIAS) {
      expect(rotuloDaCategoria(c.categoria)).not.toBe(c.categoria);
    }
    expect(rotuloDaCategoria("inventada")).toBe("Relato");
    expect(definicaoDaCategoria("inventada")).toBeNull();
  });
});

describe("status batem com o CHECK do banco", () => {
  it("todo status do schema tem rótulo e cor na tela", () => {
    const noBanco = valoresDoCheck("relatos", "status");
    const semRotulo = noBanco.filter((s) => !(s in STATUS));
    expect(semRotulo).toEqual([]);
  });

  it("nenhum rótulo expõe snake_case", () => {
    for (const { rotulo } of Object.values(STATUS)) {
      expect(rotulo).not.toMatch(/_/);
    }
  });

  it("status desconhecido não quebra a tela", () => {
    expect(rotuloDoStatus("inventado")).toBe("inventado");
    expect(corDoStatus("inventado")).toContain("bg-");
  });

  it("o kanban cobre o fluxo até resolvido, sem rejeitado nem duplicado", () => {
    const colunas = COLUNAS_KANBAN.map((c) => c.status);
    expect(colunas).toEqual(["aberto", "em_analise", "em_correcao", "resolvido"]);
    expect(colunas).not.toContain("rejeitado");
    expect(colunas).not.toContain("duplicado");
  });
});

describe("gravidades batem com o que a RPC de validação aceita", () => {
  it("as três gravidades aparecem no SQL com a chave de pontos", () => {
    for (const g of GRAVIDADES) {
      expect(SQL).toContain(`pontos_relato_${g.gravidade}`);
    }
  });

  it("gravidade do schema e da tela são as mesmas", () => {
    const noBanco = valoresDoCheck("relatos", "gravidade");
    expect([...GRAVIDADES.map((g) => g.gravidade)].sort()).toEqual([...noBanco].sort());
  });
});

describe("STATUS_DE_ANDAMENTO é o que tecnico_atualizar_relato aceita", () => {
  it("são os três do SQL", () => {
    expect([...STATUS_DE_ANDAMENTO]).toEqual(["em_analise", "em_correcao", "resolvido"]);
    // A RPC compara com esta lista antes de devolver `status_invalido`.
    expect(SQL).toMatch(/'em_analise',\s*'em_correcao',\s*'resolvido'/);
  });
});

describe("descricaoValida", () => {
  it("exige o mínimo que o banco exige", () => {
    expect(MINIMO_DESCRICAO).toBe(10);
    // `colaborador_criar_relato` devolve `descricao_curta` abaixo de 10.
    // (O Canal de Respeito usa 20 — é outra RPC, com outra regra.)
    expect(SQL).toMatch(/char_length\(coalesce\(trim\(p_descricao\), ''\)\)\s*<\s*10/);
  });

  it("recusa curta e só espaço", () => {
    expect(descricaoValida("")).toBe(false);
    expect(descricaoValida("curto")).toBe(false);
    expect(descricaoValida("          ")).toBe(false);
  });

  it("aceita a partir de 10 caracteres úteis", () => {
    expect(descricaoValida("dez letras")).toBe(true);
    expect(descricaoValida("  piso molhado no corredor  ")).toBe(true);
  });
});
