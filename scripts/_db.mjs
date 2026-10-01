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

/**
 * Credenciais da Management API, lidas do `.env` (que está fora do git).
 * Nenhum script deste repositório recebe token por linha de comando.
 */
export function credenciaisApi() {
  carregarEnv();
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (!token || !ref) {
    throw new Error(
      "Falta SUPABASE_ACCESS_TOKEN ou SUPABASE_PROJECT_REF no .env.\n" +
        "Pegue o token em Supabase > Account > Access Tokens e o ref do projeto\n" +
        "de DESENVOLVIMENTO. Modelo em .env.example.",
    );
  }
  if (ref === REF_PRODUCAO) {
    throw new Error(
      `SUPABASE_PROJECT_REF é a PRODUÇÃO do V.O.Z.E.S. (${REF_PRODUCAO}). Abortando.`,
    );
  }
  return { token, ref };
}

/**
 * Roda SQL no projeto de desenvolvimento pela Management API.
 * Lança com a mensagem do Postgres quando a consulta falha — é o que permite
 * mostrar, como evidência, as consultas que DEVEM falhar.
 */
export async function consultar(query) {
  const { token, ref } = credenciaisApi();
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const texto = await r.text();
  if (!r.ok) {
    let detalhe = texto;
    try {
      const j = JSON.parse(texto);
      detalhe = j.message ?? j.error ?? texto;
    } catch {
      /* mantém o texto cru */
    }
    throw new Error(`http ${r.status}: ${detalhe}`);
  }
  return texto ? JSON.parse(texto) : [];
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
