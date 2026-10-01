// Gera src/lib/database.types.ts a partir do schema do projeto de
// DESENVOLVIMENTO (CLAUDE.md regra 10, docs/TIME_02 §1.5).
//
// Equivale a `npx supabase gen types typescript --linked`, mas pela Management
// API: não exige projeto linkado nem senha do Postgres. As credenciais vêm do
// .env, nunca da linha de comando.
//
// Rodar sempre depois de aplicar migration.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { credenciaisApi, raiz } from "./_db.mjs";

const DESTINO = resolve(raiz, "src/lib/database.types.ts");

const { token, ref } = credenciaisApi();

const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/types/typescript`, {
  headers: { Authorization: `Bearer ${token}` },
});

if (!r.ok) {
  console.error(`ERRO http ${r.status}: ${await r.text()}`);
  process.exit(1);
}

const { types } = await r.json();

if (typeof types !== "string" || types.length === 0) {
  console.error("A API não devolveu os tipos.");
  process.exit(1);
}

const cabecalho = [
  "// GERADO por scripts/db-tipos.mjs a partir do schema do projeto de",
  "// desenvolvimento. NAO EDITAR A MAO: rode `npm run db:tipos` depois de",
  "// aplicar qualquer migration.",
  "",
].join("\n");

writeFileSync(DESTINO, cabecalho + types);
console.log(`src/lib/database.types.ts escrito: ${types.split("\n").length} linhas`);
