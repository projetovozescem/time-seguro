// Aplica as migrations de supabase/migrations/ no projeto de DESENVOLVIMENTO
// pela Management API do Supabase.
//
// Por que não `supabase db push`: ele exige a senha do Postgres ou um projeto
// linkado. Este caminho usa só o token de acesso (SUPABASE_ACCESS_TOKEN) e
// registra o que aplicou em supabase_migrations.schema_migrations — a mesma
// tabela do CLI, então `db push` continua funcionando depois.
//
// Idempotente: pula o que já está registrado. Para no primeiro erro.
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { consultar as rodar, raiz } from "./_db.mjs";

const PASTA = resolve(raiz, "supabase/migrations");

// A tabela de controle do CLI do Supabase.
await rodar(`
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version text primary key,
    statements text[],
    name text
  );
`);

const aplicadas = new Set(
  (await rodar("select version from supabase_migrations.schema_migrations")).map((r) => r.version),
);

const arquivos = readdirSync(PASTA)
  .filter((n) => n.endsWith(".sql"))
  .sort(); // prefixo de timestamp => ordem alfabética é a cronológica

let aplicou = 0;
for (const arquivo of arquivos) {
  const versao = arquivo.split("_")[0];
  const nome = arquivo.slice(versao.length + 1, -4);

  if (aplicadas.has(versao)) {
    console.log(`= ${arquivo} (já aplicada)`);
    continue;
  }

  const sql = readFileSync(resolve(PASTA, arquivo), "utf8");
  process.stdout.write(`+ ${arquivo} ... `);
  try {
    await rodar(sql);
    await rodar(
      `insert into supabase_migrations.schema_migrations (version, name)
         values ('${versao}', '${nome.replace(/'/g, "''")}')
         on conflict (version) do nothing`,
    );
    console.log("ok");
    aplicou++;
  } catch (erro) {
    console.log("FALHOU");
    console.error(`\n${erro.message}\n`);
    console.error("Nada depois desta migration foi aplicado.");
    process.exit(1);
  }
}

console.log(
  aplicou === 0
    ? `\n0 migrations pendentes (${aplicadas.size} já aplicadas).`
    : `\n${aplicou} migration(s) aplicada(s).`,
);
