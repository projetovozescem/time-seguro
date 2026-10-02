import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Cada chamada `rpcApp(...)` / `rpcPublica(...)` das telas usa parâmetros que a
 * função do banco realmente tem?
 *
 * Existe porque `rpcApp` e `rpcPublica` recebem `args` como `Record<string,
 * unknown>` (e fazem `as never` na hora de chamar): o compilador NÃO confere os
 * nomes. O login do colaborador ficou meses chamando `colaborador_login` com
 * `p_codigo` e `p_token` — a função recebe `p_empresa_codigo` e não tem token —
 * e nenhum teste de SQL, de fluxo ou de tipo reclamou, porque todos chamavam a
 * RPC direto, com os nomes certos. Só abrir o app pegaria. Este teste pega sem
 * abrir.
 *
 * Fonte da verdade: `database.types.ts`, gerado do banco real.
 */

/** Parâmetros que cada função aceita, lidos de `Functions.<nome>.Args`. */
function assinaturas(): Map<string, Set<string>> {
  const tipos = readFileSync("src/lib/database.types.ts", "utf8");
  const inicio = tipos.indexOf("Functions: {");
  const fim = tipos.indexOf("Enums:", inicio);
  const bloco = tipos.slice(inicio, fim === -1 ? undefined : fim);

  const mapa = new Map<string, Set<string>>();
  for (const m of bloco.matchAll(/\n {6}(\w+): \{\s*Args: (\{[^}]*\}|never)/g)) {
    const params = new Set<string>();
    for (const p of m[2]!.matchAll(/\b(p_\w+)\??:/g)) params.add(p[1]!);
    mapa.set(m[1]!, params);
  }
  return mapa;
}

type Chamada = { arquivo: string; via: "rpcApp" | "rpcPublica"; fn: string; params: string[] };

/** Texto do objeto `{ ... }` que começa em `abre`, respeitando chaves aninhadas. */
function objetoEm(texto: string, abre: number): string {
  let nivel = 0;
  for (let i = abre; i < texto.length; i++) {
    if (texto[i] === "{") nivel++;
    if (texto[i] === "}" && --nivel === 0) return texto.slice(abre, i + 1);
  }
  return texto.slice(abre);
}

function chamadasDasTelas(): Chamada[] {
  const pasta = "src/routes";
  const achadas: Chamada[] = [];
  for (const nome of readdirSync(pasta).filter((n) =>
    /^(app|respeito|verificar).*\.tsx$/.test(n),
  )) {
    const fonte = readFileSync(join(pasta, nome), "utf8");
    for (const m of fonte.matchAll(/(rpcApp|rpcPublica)\s*(?:<[^"]*?>)?\s*\(\s*\n?\s*"(\w+)"/g)) {
      const depois = fonte.slice(m.index! + m[0].length);
      const virgula = /^\s*,\s*\{/.exec(depois);
      const params: string[] = [];
      if (virgula) {
        const abre = m.index! + m[0].length + virgula[0].length - 1;
        // Só chaves do primeiro nível do objeto: `p_x:` ou `p_x,` (atalho).
        const corpo = objetoEm(fonte, abre);
        for (const p of corpo.matchAll(/(?:^|[{,\n])\s*(p_\w+)\s*(?=[:,}])/g)) params.push(p[1]!);
        for (const p of corpo.matchAll(/\.\.\.\([^)]*\?\s*\{\s*(p_\w+)\s*:/g)) params.push(p[1]!);
      }
      achadas.push({ arquivo: nome, via: m[1] as Chamada["via"], fn: m[2]!, params });
    }
  }
  return achadas;
}

const ASSINATURAS = assinaturas();
const CHAMADAS = chamadasDasTelas();

describe("parâmetros das RPCs chamadas pelas telas", () => {
  it("leu as assinaturas e as chamadas (o teste não passa vazio)", () => {
    expect(ASSINATURAS.size).toBeGreaterThan(30);
    expect(CHAMADAS.length).toBeGreaterThan(15);
    expect(ASSINATURAS.get("colaborador_login")).toBeDefined();
  });

  it("toda RPC chamada existe no banco", () => {
    const inexistentes = CHAMADAS.filter((c) => !ASSINATURAS.has(c.fn)).map(
      (c) => `${c.arquivo}: ${c.fn}`,
    );
    expect(inexistentes).toEqual([]);
  });

  it("todo parâmetro passado existe na função (e `p_token` só em rpcApp)", () => {
    const erros: string[] = [];
    for (const c of CHAMADAS) {
      const aceitos = ASSINATURAS.get(c.fn);
      if (!aceitos) continue;
      for (const p of c.params) {
        if (!aceitos.has(p)) erros.push(`${c.arquivo}: ${c.fn} não tem o parâmetro ${p}`);
      }
      // `rpcApp` acrescenta `p_token` sozinho. Se a função não o tem, a chamada falha.
      if (c.via === "rpcApp" && !aceitos.has("p_token")) {
        erros.push(`${c.arquivo}: ${c.fn} não aceita p_token, mas rpcApp sempre o envia`);
      }
      if (c.via === "rpcPublica" && aceitos.has("p_token") && c.fn.startsWith("colaborador_")) {
        erros.push(`${c.arquivo}: ${c.fn} exige token, mas rpcPublica não o envia`);
      }
    }
    expect(erros).toEqual([]);
  });

  it("o login vai por rpcPublica, com p_empresa_codigo", () => {
    const login = CHAMADAS.find((c) => c.fn === "colaborador_login");
    expect(login?.via).toBe("rpcPublica");
    expect(login?.params.sort()).toEqual(["p_empresa_codigo", "p_matricula", "p_pin"]);
  });

  it("o Canal de Respeito nunca passa por rpcApp (nada de token)", () => {
    const respeito = CHAMADAS.filter((c) => c.arquivo.startsWith("respeito"));
    expect(respeito.length).toBeGreaterThan(0);
    expect(respeito.filter((c) => c.via === "rpcApp")).toEqual([]);
  });
});
