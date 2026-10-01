import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import {
  CONFIG_CAMPANHA,
  configParaGravar,
  tetoDiarioDoQuiz,
  validarCampanha,
  valorEmVigor,
  type CampanhaForm,
} from "./campanha";

function form(parcial: Partial<CampanhaForm> = {}): CampanhaForm {
  return {
    nome: "Campanha T4 2026",
    descricao: "",
    inicio: "2026-10-01",
    fim: "2026-12-31",
    temas: ["t-nr35"],
    perguntas_por_dia: 5,
    premiacao: "",
    ranking_visivel: true,
    ...parcial,
  };
}

/**
 * O teste que mais importa deste arquivo: a tela de "pontos avançados" só vale se
 * as chaves e os padrões forem os MESMOS que o banco lê. Se alguém mudar um
 * `_cfg(...)` numa migration, isto reprova.
 */
describe("as chaves de config batem com o SQL das migrations", () => {
  const sql = readdirSync("supabase/migrations")
    .filter((n) => n.endsWith(".sql"))
    .map((n) => readFileSync(`supabase/migrations/${n}`, "utf8"))
    .join("\n");

  /**
   * As de sequência são montadas por concatenação no SQL
   * (`_cfg(p_camp, 'pontos_streak_' || v_marco, case ...)`), então não aparecem
   * literalmente. Têm verificação própria mais abaixo.
   */
  const CONCATENADAS = ["pontos_streak_7", "pontos_streak_15", "pontos_streak_30"];

  it("toda chave numérica aparece no SQL com o mesmo padrão", () => {
    const divergentes: string[] = [];

    for (const def of CONFIG_CAMPANHA) {
      if (typeof def.padrao === "boolean") continue;
      if (CONCATENADAS.includes(def.chave)) continue;

      // `_cfg(p_camp, 'chave', 10)` — o terceiro argumento é o padrão.
      const re = new RegExp(`_cfg\\([^,]+,\\s*'${def.chave}',\\s*(\\d+)\\)`);
      const achado = re.exec(sql);
      if (!achado) {
        divergentes.push(`${def.chave}: não encontrada no SQL`);
        continue;
      }
      if (Number(achado[1]) !== def.padrao) {
        divergentes.push(`${def.chave}: SQL usa ${achado[1]}, a tela diz ${def.padrao}`);
      }
    }

    expect(divergentes).toEqual([]);
  });

  it("os bônus de sequência batem com o case do SQL", () => {
    expect(sql).toMatch(/'pontos_streak_'\s*\|\|/);

    // case v_marco when 7 then 20 when 15 then 50 else 100 end
    const caso =
      /case\s+v_marco\s+when\s+7\s+then\s+(\d+)\s+when\s+15\s+then\s+(\d+)\s+else\s+(\d+)\s+end/i.exec(
        sql,
      );
    expect(caso, "o case dos bônus de sequência mudou de forma no SQL").toBeTruthy();

    const noSql = {
      pontos_streak_7: Number(caso![1]),
      pontos_streak_15: Number(caso![2]),
      pontos_streak_30: Number(caso![3]),
    };
    const naTela = Object.fromEntries(
      CONFIG_CAMPANHA.filter((d) => d.chave.startsWith("pontos_streak_")).map((d) => [
        d.chave,
        d.padrao,
      ]),
    );
    expect(naTela).toEqual(noSql);
  });

  it("as chaves de presença e de fim de semana existem no SQL", () => {
    expect(sql).toContain("streak_ignora_fds");
    expect(sql).toMatch(/_cfg\([^,]+,\s*'pontos_presenca',\s*2\)/);
  });

  it("não tem chave repetida", () => {
    const chaves = CONFIG_CAMPANHA.map((d) => d.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it("toda chave tem rótulo, pilar e ajuda", () => {
    for (const d of CONFIG_CAMPANHA) {
      expect(d.rotulo.length).toBeGreaterThan(3);
      expect(d.ajuda.length).toBeGreaterThan(10);
      expect(["conhecimento", "relatos", "engajamento"]).toContain(d.pilar);
    }
  });
});

describe("valorEmVigor", () => {
  const acerto = CONFIG_CAMPANHA.find((d) => d.chave === "pontos_acerto_diario")!;
  const fds = CONFIG_CAMPANHA.find((d) => d.chave === "streak_ignora_fds")!;

  it("usa o padrão quando a campanha não sobrescreve", () => {
    expect(valorEmVigor(null, acerto)).toBe(10);
    expect(valorEmVigor({}, acerto)).toBe(10);
    expect(valorEmVigor(undefined, acerto)).toBe(10);
  });

  it("usa o valor da campanha quando existe", () => {
    expect(valorEmVigor({ pontos_acerto_diario: 25 }, acerto)).toBe(25);
  });

  it("aceita zero como valor de verdade, não como ausência", () => {
    expect(valorEmVigor({ pontos_acerto_diario: 0 }, acerto)).toBe(0);
  });

  it("trata booleano", () => {
    expect(valorEmVigor({}, fds)).toBe(true);
    expect(valorEmVigor({ streak_ignora_fds: false }, fds)).toBe(false);
  });

  it("cai no padrão se o valor gravado não for número", () => {
    expect(valorEmVigor({ pontos_acerto_diario: "muito" as never }, acerto)).toBe(10);
  });
});

describe("configParaGravar", () => {
  it("grava só o que difere do padrão", () => {
    const valores: Record<string, number | boolean> = {};
    for (const d of CONFIG_CAMPANHA) valores[d.chave] = d.padrao;
    expect(configParaGravar(valores)).toEqual({});
  });

  it("guarda o que foi alterado", () => {
    expect(configParaGravar({ pontos_acerto_diario: 25, pontos_presenca: 2 })).toEqual({
      pontos_acerto_diario: 25,
    });
  });

  it("guarda booleano alterado", () => {
    expect(configParaGravar({ streak_ignora_fds: false })).toEqual({ streak_ignora_fds: false });
  });

  it("ignora campo vazio em vez de gravar zero", () => {
    expect(configParaGravar({ pontos_acerto_diario: "" as never })).toEqual({});
  });

  it("não inventa chave que não está no catálogo", () => {
    expect(configParaGravar({ chave_inventada: 99 })).toEqual({});
  });

  it("zero explícito é gravado, porque difere do padrão", () => {
    expect(configParaGravar({ pontos_presenca: 0 })).toEqual({ pontos_presenca: 0 });
  });
});

describe("validarCampanha", () => {
  it("aceita um formulário completo", () => {
    expect(validarCampanha(form())).toEqual([]);
  });

  it("exige nome, datas e tema", () => {
    const erros = validarCampanha(form({ nome: "ab", inicio: "", fim: "", temas: [] }));
    expect(erros).toHaveLength(4);
  });

  it("recusa fim antes do início", () => {
    const erros = validarCampanha(form({ inicio: "2026-12-31", fim: "2026-10-01" }));
    expect(erros.some((e) => e.includes("antes do início"))).toBe(true);
  });

  it("aceita início e fim no mesmo dia", () => {
    expect(validarCampanha(form({ inicio: "2026-10-01", fim: "2026-10-01" }))).toEqual([]);
  });

  it("limita perguntas por dia entre 1 e 20", () => {
    for (const n of [0, 21, -3, 2.5]) {
      expect(
        validarCampanha(form({ perguntas_por_dia: n })).some((e) => e.includes("1 a 20")),
      ).toBe(true);
    }
    for (const n of [1, 5, 20]) {
      expect(validarCampanha(form({ perguntas_por_dia: n }))).toEqual([]);
    }
  });
});

describe("tetoDiarioDoQuiz", () => {
  it("multiplica perguntas por pontos", () => {
    expect(tetoDiarioDoQuiz(5, 10)).toBe(50);
  });

  it("não devolve negativo", () => {
    expect(tetoDiarioDoQuiz(-1, 10)).toBe(0);
    expect(tetoDiarioDoQuiz(5, -10)).toBe(0);
  });
});
