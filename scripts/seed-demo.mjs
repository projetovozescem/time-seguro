// Dados de DEMONSTRAÇÃO (docs/TIME_11 Fase 11 item 2): a "Empresa
// Demonstração" completa, para prints e apresentação.
//
// Põe em ordem as três partes, porque a segunda depende da primeira:
//   1. scripts/seed-demo.sql ............ empresa, setores, locais, 30
//      colaboradores fictícios, campanha, lição, relatos, eventos, check-ins
//      e duas denúncias de demonstração;
//   2. as 36 perguntas do docs/TIME_12 na empresa demo (mesmo parser do app);
//   3. scripts/seed-demo-respostas.sql .. respostas de três semanas, atividade
//      diária e pontos.
//
// ⚠️ docs/TIME_11 §3: dado de demonstração NUNCA pode ser apresentado como
//    resultado real. Todo nome aqui é "Colaborador Demo NN" e a empresa se
//    chama "Empresa Demonstração" para que nenhum print seja confundido.
//
// SOMENTE DESENVOLVIMENTO. Idempotente: roda de novo e recria do zero.
// As credenciais vêm do .env, nunca da linha de comando.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { consultar, raiz } from "./_db.mjs";
import { importarTs } from "./_bundle.mjs";

const CODIGO = "demo";

const lit = (v) =>
  v === null || v === undefined ? "null" : "'" + String(v).replace(/'/g, "''") + "'";
const arrayLit = (xs) => "array[" + xs.map(lit).join(", ") + "]::text[]";

async function rodarArquivo(nome) {
  const sql = readFileSync(resolve(raiz, "scripts", nome), "utf8");
  await consultar(sql);
  console.log(`✓ ${nome}`);
}

// ---------------------------------------------------------------------
// 1. Estrutura e fatos
// ---------------------------------------------------------------------
await rodarArquivo("seed-demo.sql");

const [empresa] = await consultar(`select id from public.empresas where codigo = ${lit(CODIGO)}`);
if (!empresa) {
  console.error("A empresa demo não foi criada. Veja o erro da parte 1.");
  process.exit(1);
}

// ---------------------------------------------------------------------
// 2. As 36 perguntas do docs/TIME_12, com o MESMO parser do app
// ---------------------------------------------------------------------
const { lerTxt } = await importarTs(resolve(raiz, "src/lib/importacao/txt.ts"));

const doc = readFileSync(resolve(raiz, "docs/TIME_12_BANCO_DE_PERGUNTAS.md"), "utf8");
const bloco = /```\n([\s\S]*?)\n```/.exec(doc)?.[1];
if (!bloco) {
  console.error("Não achei o bloco de perguntas em docs/TIME_12.");
  process.exit(1);
}

const perguntas = lerTxt(bloco);
const comAviso = perguntas.filter((p) => p.avisos.length > 0);
if (comAviso.length > 0) {
  console.error(`${comAviso.length} pergunta(s) do TIME_12 com aviso. Abortando.`);
  process.exit(1);
}

const temas = await consultar(
  `select id, slug from public.temas where empresa_id is null or empresa_id = ${lit(empresa.id)}`,
);
const idDoTema = new Map(temas.map((t) => [t.slug, t.id]));
const semTema = [...new Set(perguntas.map((p) => p.tema))].filter((s) => !idDoTema.has(s));
if (semTema.length > 0) {
  console.error(`Tema do TIME_12 que não existe no banco: ${semTema.join(", ")}`);
  process.exit(1);
}

const valores = perguntas
  .map(
    (p) =>
      `(${lit(empresa.id)}::uuid, ${lit(idDoTema.get(p.tema))}::uuid, ${lit(p.enunciado)}, ` +
      `${arrayLit(p.alternativas)}, ${p.correta}::smallint, ${lit(p.explicacao ?? null)}, ` +
      `${p.dificuldade ?? 2}::smallint, 'ativa', 'importacao')`,
  )
  .join(",\n    ");

const inseridas = await consultar(`
  insert into public.perguntas
    (empresa_id, tema_id, enunciado, alternativas, correta, explicacao, dificuldade, status, origem)
  select * from (values
    ${valores}
  ) as v(empresa_id, tema_id, enunciado, alternativas, correta, explicacao, dificuldade, status, origem)
   where not exists (
     select 1 from public.perguntas p
      where p.empresa_id = v.empresa_id and p.enunciado = v.enunciado
   )
  returning id
`);
console.log(`✓ ${inseridas.length} pergunta(s) do TIME_12 na empresa demo`);

// ---------------------------------------------------------------------
// 3. Respostas, atividade e pontos
// ---------------------------------------------------------------------
await rodarArquivo("seed-demo-respostas.sql");

// ---------------------------------------------------------------------
// 4. Conferência: os números que aparecem nas telas
// ---------------------------------------------------------------------
const contagens = await consultar(`
  with d as (select id from public.empresas where codigo = ${lit(CODIGO)})
  select 'setores' as o, count(*)::int as n from public.setores, d where empresa_id = d.id
  union all select 'locais',        count(*)::int from public.locais, d where empresa_id = d.id
  union all select 'colaboradores', count(*)::int from public.colaboradores, d where empresa_id = d.id
  union all select 'perguntas',     count(*)::int from public.perguntas, d where empresa_id = d.id
  union all select 'respostas',     count(*)::int from public.respostas, d where empresa_id = d.id
  union all select 'dias ativos',   count(*)::int from public.atividade_diaria, d where empresa_id = d.id
  union all select 'relatos',       count(*)::int from public.relatos, d where empresa_id = d.id
  union all select 'eventos',       count(*)::int from public.eventos, d where empresa_id = d.id
  union all select 'check-ins',     count(*)::int from public.checkins, d where empresa_id = d.id
  union all select 'denuncias',     count(*)::int from public.denuncias_assedio, d where empresa_id = d.id
  union all select 'pontos',        coalesce(sum(pontos), 0)::int from public.pontos_lancamentos, d where empresa_id = d.id
`);

console.log("\nEmpresa Demonstração (codigo demo):");
for (const linha of contagens) {
  console.log(`  ${linha.o.padEnd(14)} ${linha.n}`);
}

// Prova de que o mapa de lacunas tem o que mostrar: o setor Produção precisa
// aparecer com taxa baixa em NR-12, senão o print não diz nada.
const lacunas = await consultar(`
  select s.nome as setor, t.slug as tema, l.tentativas, l.taxa_acerto
    from public.v_lacunas l
    join public.setores s on s.id = l.setor_id
    join public.temas t on t.id = l.tema_id
   where l.empresa_id = (select id from public.empresas where codigo = ${lit(CODIGO)})
     and t.slug = 'nr12'
   order by l.taxa_acerto
`);
console.log("\nMapa de lacunas em NR-12 (o contraste da demonstração):");
for (const l of lacunas) {
  console.log(`  ${l.setor.padEnd(14)} ${l.taxa_acerto}% em ${l.tentativas} respostas`);
}

// O PIN agora é fixo e único por colaborador (0008): não há mais um PIN
// "de todos". Mostra alguns para a demonstração poder entrar no app.
const exemplos = await consultar(`
  select c.matricula, c.nome, c.pin_fixo
    from public.colaboradores c
   where c.empresa_id = (select id from public.empresas where codigo = ${lit(CODIGO)})
   order by c.matricula limit 5
`);
console.log("\nPara entrar no app (código da empresa: demo):");
for (const c of exemplos) console.log(`  matrícula ${c.matricula}  PIN ${c.pin_fixo}  — ${c.nome}`);
console.log("Senha das denúncias de demonstração: demo123.");
console.log("Lembre: isto é DEMONSTRAÇÃO DO SISTEMA, nunca resultado de uso real.");
