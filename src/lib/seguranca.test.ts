import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Checklist de segurança do docs/TIME_03 §8, na parte que se verifica no código.
 *
 * Os outros itens têm prova em outro lugar e estão anotados aqui para a revisão
 * ficar completa:
 *  • cadastro público desativado e bucket `relatos-fotos` privado →
 *    `npm run db:configurar` (imprime o estado de cada um);
 *  • `anon` sem `select` em tabela nenhuma → `npm run test:rls`;
 *  • gabarito ausente antes de responder → `contratos.test.ts` e
 *    `npm run test:fluxo`;
 *  • `/respeito` sem nenhuma chamada com token → `respeito.test.ts`.
 */

/** Todos os arquivos de código do front. */
function arquivosDoFront(): string[] {
  const achados: string[] = [];
  const anda = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) {
        anda(caminho);
        continue;
      }
      // Caminho sempre com barra normal: no Windows o `join` usa contrabarra,
      // e o teste compara com caminho escrito a mao.
      if (/\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome)) {
        achados.push(caminho.split(/[\\/]/).join("/"));
      }
    }
  };
  anda("src");
  return achados;
}

const ARQUIVOS = arquivosDoFront();
const FONTES = new Map(ARQUIVOS.map((f) => [f, readFileSync(f, "utf8")]));

describe("TIME_03 §8 — variáveis de ambiente no front", () => {
  /**
   * `import.meta.env` vai para o bundle público. Só podem aparecer as duas
   * variáveis que o documento autoriza, mais a `DEV` do próprio Vite.
   */
  const PERMITIDAS = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "DEV", "PROD", "MODE"];

  it("o front lê apenas as variáveis autorizadas", () => {
    const encontradas = new Map<string, string[]>();
    for (const [arquivo, fonte] of FONTES) {
      for (const m of fonte.matchAll(/import\.meta\.env(?:\.|\[")([A-Za-z_][A-Za-z0-9_]*)/g)) {
        const nome = m[1]!;
        encontradas.set(nome, [...(encontradas.get(nome) ?? []), arquivo]);
      }
    }
    const proibidas = [...encontradas.entries()].filter(([nome]) => !PERMITIDAS.includes(nome));
    expect(proibidas.map(([nome, onde]) => `${nome} em ${onde.join(", ")}`)).toEqual([]);
  });

  it("nenhuma chave de serviço aparece no código do front", () => {
    // O prefixo `sb_secret_` pode aparecer numa GUARDA (que recusa a chave
    // errada); o que não pode é uma chave inteira escrita no código.
    const comChave = [...FONTES.entries()].filter(([, fonte]) =>
      /sb_secret_[A-Za-z0-9_-]{10,}/.test(fonte),
    );
    expect(comChave.map(([arquivo]) => arquivo)).toEqual([]);
  });

  it("o cliente com service role vive só no servidor e ninguém do front o importa", () => {
    const servidor = "src/integrations/supabase/client.server.ts";
    expect(FONTES.has(servidor)).toBe(true);
    expect(FONTES.get(servidor)).toMatch(/process\.env/);

    const importam = [...FONTES.entries()]
      .filter(([arquivo]) => arquivo !== servidor)
      .filter(([, fonte]) => /client\.server/.test(fonte))
      .map(([arquivo]) => arquivo);
    expect(importam).toEqual([]);
  });
});

describe("TIME_03 §8 — nenhum segredo no repositório", () => {
  it("o .env não é versionado", () => {
    const ignore = readFileSync(".gitignore", "utf8");
    expect(ignore).toMatch(/^\.env$/m);
    expect(ignore).toMatch(/^\.mcp\.json$/m);
  });

  it("nenhum token de acesso do Supabase escrito em código ou migration", () => {
    const suspeitos: string[] = [];
    for (const [arquivo, fonte] of FONTES) {
      // `sbp_` é o prefixo do token de acesso pessoal da plataforma.
      if (/sbp_[A-Za-z0-9]{20,}/.test(fonte)) suspeitos.push(arquivo);
    }
    for (const nome of readdirSync("supabase/migrations")) {
      const fonte = readFileSync(join("supabase/migrations", nome), "utf8");
      if (/sbp_[A-Za-z0-9]{20,}/.test(fonte)) suspeitos.push(nome);
    }
    expect(suspeitos).toEqual([]);
  });
});
