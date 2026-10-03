// Campanha "Outubro Rosa" (status rascunho, mostrado como "Em breve") com
// algumas perguntas, na empresa `enerpeixe`.
//
//   node scripts/seed-outubro-rosa.mjs
//
// Só INSERE e é idempotente: não apaga nada, não duplica. É o que permite
// rodar sem passar por scripts/seed-enerpeixe.mjs, que recria a empresa inteira.
// Igual à "Violência contra a mulher": uma campanha com um tema e sem lições.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { consultar, raiz } from "./_db.mjs";
import { importarTs } from "./_bundle.mjs";

const CODIGO = "enerpeixe";
const NOME = "Outubro Rosa";

const lit = (v) =>
  v === null || v === undefined ? "null" : "'" + String(v).replace(/'/g, "''") + "'";
const arrayLit = (xs) => "array[" + xs.map(lit).join(", ") + "]::text[]";

const [empresa] = await consultar(`select id from public.empresas where codigo = ${lit(CODIGO)}`);
if (!empresa) {
  console.error(`Empresa "${CODIGO}" não encontrada. Rode scripts/seed-enerpeixe.mjs antes.`);
  process.exit(1);
}

// Tema da empresa.
await consultar(`
  insert into public.temas (empresa_id, slug, nome, icone, cor)
  values (${lit(empresa.id)}, 'outubro-rosa', 'Outubro Rosa · Saúde da Mulher', '🎀', '#D6336C')
  on conflict (empresa_id, slug) do nothing
`);
const [tema] = await consultar(
  `select id from public.temas where empresa_id = ${lit(empresa.id)} and slug = 'outubro-rosa'`,
);

// Campanha "Em breve" (rascunho) e o vínculo com o tema.
const jaExiste = await consultar(
  `select id from public.campanhas where empresa_id = ${lit(empresa.id)} and nome = ${lit(NOME)}`,
);
let campanhaId = jaExiste[0]?.id;
if (campanhaId) {
  console.log(`= campanha "${NOME}" já existe`);
} else {
  [{ id: campanhaId }] = await consultar(`
    insert into public.campanhas
      (empresa_id, nome, descricao, inicio, fim, status, ranking_visivel, perguntas_por_dia)
    values (
      ${lit(empresa.id)}, ${lit(NOME)},
      ${lit("Campanha de conscientização sobre a prevenção e a detecção precoce do câncer de mama: reconhecer os sinais, cuidar da saúde e procurar atendimento.")},
      date '2026-10-01', date '2026-10-31', 'rascunho', true, 3)
    returning id
  `);
  console.log(`✓ campanha "${NOME}" criada (rascunho)`);
}
await consultar(`
  insert into public.campanha_temas (campanha_id, tema_id, empresa_id)
  values (${lit(campanhaId)}, ${lit(tema.id)}, ${lit(empresa.id)})
  on conflict do nothing
`);

// Perguntas, com o MESMO parser do app.
const { lerTxt } = await importarTs(resolve(raiz, "src/lib/importacao/txt.ts"));
const perguntas = lerTxt(readFileSync(resolve(raiz, "scripts/perguntas-outubro-rosa.txt"), "utf8"));
const comAviso = perguntas.filter((p) => p.avisos.length > 0);
if (comAviso.length > 0 || perguntas.length === 0) {
  console.error(`Perguntas lidas: ${perguntas.length}; com aviso: ${comAviso.length}`);
  for (const p of comAviso) console.error(`  - ${p.enunciado}: ${p.avisos.join("; ")}`);
  process.exit(1);
}

const existentes = new Set(
  (await consultar(`select enunciado from public.perguntas where tema_id = ${lit(tema.id)}`)).map(
    (p) => p.enunciado,
  ),
);
const novas = perguntas.filter((p) => !existentes.has(p.enunciado));
if (novas.length > 0) {
  const valores = novas
    .map(
      (p) =>
        `(${lit(empresa.id)}::uuid, ${lit(tema.id)}::uuid, ${lit(p.enunciado)}, ` +
        `${arrayLit(p.alternativas)}, ${p.correta}::smallint, ${lit(p.explicacao ?? null)}, ` +
        `${p.dificuldade ?? 2}::smallint, 'ativa', 'importacao')`,
    )
    .join(",\n    ");
  await consultar(`
    insert into public.perguntas
      (empresa_id, tema_id, enunciado, alternativas, correta, explicacao, dificuldade, status, origem)
    values
      ${valores}
  `);
}
console.log(
  `✓ ${novas.length} pergunta(s) nova(s); ${perguntas.length - novas.length} já existia(m)`,
);
