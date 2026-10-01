import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

/**
 * Importa um módulo `.ts` do `src/` dentro de um script Node.
 *
 * O Node já tira os tipos de um `.ts`, mas não resolve import sem extensão
 * (`./tipos`), e os módulos do projeto são escritos assim. Então o arquivo
 * passa por um bundler antes.
 *
 * O bundler sai do próprio Vite e **muda de nome entre versões**: o Vite 7 traz
 * o `rolldown`, as versões anteriores traziam o `esbuild`. Por isso a tentativa
 * é em ordem, e a falha diz o que instalar em vez de estourar um
 * `ERR_MODULE_NOT_FOUND` cru.
 */
export async function importarTs(caminhoAbsoluto) {
  const destino = resolve(mkdtempSync(resolve(tmpdir(), "time-bundle-")), "modulo.mjs");

  const comRolldown = async () => {
    const { rolldown } = await import("rolldown");
    const bundle = await rolldown({ input: caminhoAbsoluto, logLevel: "silent" });
    await bundle.write({ file: destino, format: "esm" });
    await bundle.close();
  };

  const comEsbuild = async () => {
    const { build } = await import("esbuild");
    await build({
      entryPoints: [caminhoAbsoluto],
      outfile: destino,
      bundle: true,
      format: "esm",
      platform: "node",
      logLevel: "silent",
    });
  };

  const erros = [];
  for (const tentativa of [comRolldown, comEsbuild]) {
    try {
      await tentativa();
      return import(`file://${destino}`);
    } catch (e) {
      erros.push(e instanceof Error ? e.message : String(e));
    }
  }

  throw new Error(
    `Não consegui empacotar ${caminhoAbsoluto}. Nem rolldown nem esbuild funcionaram:\n` +
      erros.map((m) => `  - ${m}`).join("\n"),
  );
}
