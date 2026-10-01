// Conexão compartilhada pelos scripts de banco.
// Carrega o .env na mão (sem dependência) e recusa produção.
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Ref do projeto de produção. Nenhum script deste repositório pode tocá-lo. */
const REF_PRODUCAO = "irpyxizuwzuquqtyajam";

export function carregarEnv() {
  const arquivo = resolve(raiz, ".env");
  if (!existsSync(arquivo)) return;
  for (const linha of readFileSync(arquivo, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(linha);
    if (!m) continue;
    const [, chave, bruto] = m;
    if (process.env[chave] !== undefined) continue; // ambiente ganha do arquivo
    process.env[chave] = bruto.trim().replace(/^(["'])(.*)\1$/, "$2");
  }
}

export function urlDev() {
  carregarEnv();
  const url = process.env.DATABASE_URL_DEV;
  if (!url) {
    throw new Error(
      "DATABASE_URL_DEV não está definida.\n" +
        "Crie o projeto Supabase de DESENVOLVIMENTO, copie a connection string\n" +
        "(pooler, role postgres) e coloque em .env como DATABASE_URL_DEV.\n" +
        "Modelo em .env.example.",
    );
  }
  if (url.includes(REF_PRODUCAO)) {
    throw new Error(
      `DATABASE_URL_DEV aponta para o projeto de PRODUÇÃO (${REF_PRODUCAO}).\n` +
        "Estes scripts só rodam contra um projeto de desenvolvimento. Abortando.",
    );
  }
  return url;
}

/** Abre uma conexão. O chamador é responsável por fechar com `await sql.end()`. */
export async function conectar() {
  const { default: postgres } = await import("postgres");
  return postgres(urlDev(), { max: 1, onnotice: () => {}, prepare: false });
}
