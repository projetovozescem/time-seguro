import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SECOES, abaDaRota, secaoDaRota, secoesVisiveis } from "./secoes";

const rotulos = (quem: Parameters<typeof secoesVisiveis>[0]) =>
  secoesVisiveis(quem).map((s) => `${s.rotulo}: ${s.abas.map((a) => a.rotulo).join(",")}`);

describe("menu do painel em seções", () => {
  it("tem 7 seções e nenhuma rota repetida", () => {
    expect(SECOES).toHaveLength(7);
    const rotas = SECOES.flatMap((s) => s.abas.map((a) => a.rota));
    expect(new Set(rotas).size).toBe(rotas.length);
  });

  it("toda tela do painel cai numa seção", () => {
    // _protegido.painel.campanhas.$id.tsx -> /painel/campanhas/$id
    const telas = readdirSync("src/routes")
      .filter((f) => f.startsWith("_protegido.painel") && f.endsWith(".tsx"))
      .map((f) =>
        f
          .replace(/^_protegido\./, "/")
          .replace(/\.tsx$/, "")
          .replace(/\.index$/, "")
          .replaceAll(".", "/"),
      );
    expect(telas.length).toBeGreaterThan(10);
    for (const t of telas) expect(secaoDaRota(t), t).toBeDefined();
  });

  it("subtela fica na aba de prefixo mais longo, não no Início", () => {
    expect(abaDaRota("/painel/campanhas/abc")?.rotulo).toBe("Campanhas");
    expect(abaDaRota("/painel/perguntas/importar")?.rotulo).toBe("Perguntas");
    expect(abaDaRota("/painel/")?.rotulo).toBe("Início");
    expect(secaoDaRota("/painel/respeito")?.rotulo).toBe("Relatos");
  });

  it("admin do comitê vê tudo", () => {
    expect(rotulos({ papel: "admin", comite: true })).toEqual([
      "Início: Início",
      "Pessoas: Pessoas",
      "Campanhas: Campanhas,Perguntas,Eventos,Ranking,Certificados",
      "Relatos: Relatos,Canal de Respeito",
      "Resultados: Painel,Relatórios,Materiais",
      "Modo TV: Modo TV",
      "Configurações: Configurações",
    ]);
  });

  it("técnico sem comitê: sem Configurações e sem Canal", () => {
    expect(rotulos({ papel: "tecnico", comite: false })).toEqual([
      "Início: Início",
      "Pessoas: Pessoas",
      "Campanhas: Campanhas,Perguntas,Eventos,Ranking,Certificados",
      "Relatos: Relatos",
      "Resultados: Painel,Relatórios,Materiais",
      "Modo TV: Modo TV",
    ]);
  });

  it("CIPA: sem Perguntas, Materiais, Modo TV e Configurações", () => {
    expect(rotulos({ papel: "cipa", comite: false })).toEqual([
      "Início: Início",
      "Pessoas: Pessoas",
      "Campanhas: Campanhas,Eventos,Ranking,Certificados",
      "Relatos: Relatos",
      "Resultados: Painel,Relatórios",
    ]);
  });

  it("sem perfil, nenhum menu", () => {
    expect(secoesVisiveis({ papel: undefined, comite: true })).toEqual([]);
  });
});
