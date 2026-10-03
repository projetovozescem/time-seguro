// Dados da Enerpeixe S.A. (Usina Hidrelétrica): campanha "Foco Total na NR-1".
//
// Põe em ordem as três partes, porque cada uma depende da anterior:
//   1. scripts/seed-enerpeixe.sql ........... limpa a empresa (mantém o login
//      do admin), apaga a `demo`, cria setores, locais, colaboradores, as duas
//      campanhas, as 6 lições, o material NR-1, eventos e relatos;
//   2. scripts/perguntas-nr1.txt ............ 30 perguntas (mesmo parser do app),
//      ligadas às lições;
//   3. scripts/seed-enerpeixe-respostas.sql . respostas, trilha e pontos;
//   4. scripts/seed-enerpeixe-extras.sql .... cadastro pendente e denúncias.
//
// Idempotente: roda de novo e recria do zero. Credenciais vêm do .env.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { consultar, raiz } from "./_db.mjs";
import { importarTs } from "./_bundle.mjs";

const CODIGO = "enerpeixe";

/** Quantas perguntas do TXT, na ordem do arquivo, vão para cada lição (ordem 1..6). */
const PERGUNTAS_POR_LICAO = [5, 6, 4, 6, 4, 5];

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
await rodarArquivo("seed-enerpeixe.sql");

const [empresa] = await consultar(`select id from public.empresas where codigo = ${lit(CODIGO)}`);
const [tema] = await consultar(
  `select id from public.temas where empresa_id = ${lit(empresa.id)} and slug = 'nr1'`,
);

// ---------------------------------------------------------------------
// 2. Perguntas NR-1, com o MESMO parser do app
// ---------------------------------------------------------------------
const { lerTxt } = await importarTs(resolve(raiz, "src/lib/importacao/txt.ts"));
const perguntas = lerTxt(readFileSync(resolve(raiz, "scripts/perguntas-nr1.txt"), "utf8"));

const total = PERGUNTAS_POR_LICAO.reduce((a, b) => a + b, 0);
const comAviso = perguntas.filter((p) => p.avisos.length > 0);
if (comAviso.length > 0 || perguntas.length !== total) {
  console.error(`Perguntas lidas: ${perguntas.length} (esperado ${total}); com aviso: ${comAviso.length}`);
  for (const p of comAviso) console.error(`  - ${p.enunciado}: ${p.avisos.join("; ")}`);
  process.exit(1);
}

const valores = perguntas
  .map(
    (p) =>
      `(${lit(empresa.id)}::uuid, ${lit(tema.id)}::uuid, ${lit(p.enunciado)}, ` +
      `${arrayLit(p.alternativas)}, ${p.correta}::smallint, ${lit(p.explicacao ?? null)}, ` +
      `${p.dificuldade ?? 2}::smallint, 'ativa', 'importacao')`,
  )
  .join(",\n    ");

const inseridas = await consultar(`
  insert into public.perguntas
    (empresa_id, tema_id, enunciado, alternativas, correta, explicacao, dificuldade, status, origem)
  values
    ${valores}
  returning id, enunciado
`);
console.log(`✓ ${inseridas.length} pergunta(s) NR-1`);

// Liga cada pergunta à sua lição pela posição no arquivo.
const idPorEnunciado = new Map(inseridas.map((p) => [p.enunciado, p.id]));
const licoes = await consultar(
  `select l.id, l.ordem from public.licoes l
     join public.campanhas c on c.id = l.campanha_id
    where l.empresa_id = ${lit(empresa.id)} and c.status = 'ativa' order by l.ordem`,
);
const ligacoes = [];
let k = 0;
PERGUNTAS_POR_LICAO.forEach((n, i) => {
  for (let o = 1; o <= n; o++, k++) {
    ligacoes.push(
      `(${lit(licoes[i].id)}::uuid, ${lit(idPorEnunciado.get(perguntas[k].enunciado))}::uuid, ${lit(empresa.id)}::uuid, ${o})`,
    );
  }
});
await consultar(`
  insert into public.licao_perguntas (licao_id, pergunta_id, empresa_id, ordem)
  values ${ligacoes.join(",\n    ")}
`);
console.log(`✓ ${ligacoes.length} pergunta(s) ligadas às ${licoes.length} lições`);

// ---------------------------------------------------------------------
// 3. Respostas, trilha e pontos
// ---------------------------------------------------------------------
await rodarArquivo("seed-enerpeixe-respostas.sql");

// ---------------------------------------------------------------------
// 4. Extras: cadastro pendente e denúncias do Canal de Respeito
// ---------------------------------------------------------------------
await rodarArquivo("seed-enerpeixe-extras.sql");

// ---------------------------------------------------------------------
// 5. Conferência
// ---------------------------------------------------------------------
const contagens = await consultar(`
  with d as (select id from public.empresas where codigo = ${lit(CODIGO)})
  select 'setores' as o, count(*)::int as n from public.setores, d where empresa_id = d.id
  union all select 'locais',        count(*)::int from public.locais, d where empresa_id = d.id
  union all select 'colaboradores', count(*)::int from public.colaboradores, d where empresa_id = d.id
  union all select 'perguntas',     count(*)::int from public.perguntas, d where empresa_id = d.id
  union all select 'campanhas',     count(*)::int from public.campanhas, d where empresa_id = d.id
  union all select 'lições',        count(*)::int from public.licoes, d where empresa_id = d.id
  union all select 'materiais',     count(*)::int from public.materiais, d where empresa_id = d.id
  union all select 'respostas',     count(*)::int from public.respostas, d where empresa_id = d.id
  union all select 'trilha',        count(*)::int from public.progresso_licoes, d where empresa_id = d.id
  union all select 'relatos',       count(*)::int from public.relatos, d where empresa_id = d.id
  union all select 'eventos',       count(*)::int from public.eventos, d where empresa_id = d.id
  union all select 'check-ins',     count(*)::int from public.checkins, d where empresa_id = d.id
  union all select 'denuncias',     count(*)::int from public.denuncias_assedio, d where empresa_id = d.id
  union all select 'pendentes',     count(*)::int from public.solicitacoes_cadastro, d where empresa_id = d.id and status = 'pendente'
  union all select 'pontos',        coalesce(sum(pontos), 0)::int from public.pontos_lancamentos, d where empresa_id = d.id
`);
console.log("\nEnerpeixe S.A. (codigo enerpeixe):");
for (const linha of contagens) console.log(`  ${linha.o.padEnd(14)} ${linha.n}`);

const campanhas = await consultar(`
  select nome, status, inicio, fim from public.campanhas
   where empresa_id = ${lit(empresa.id)} order by inicio`);
console.log("\nCampanhas:");
for (const c of campanhas) console.log(`  ${c.nome} — ${c.status} (${c.inicio} a ${c.fim})`);

const exemplos = await consultar(`
  select c.matricula, c.nome, c.pin_fixo, s.nome as setor
    from public.colaboradores c join public.setores s on s.id = c.setor_id
   where c.empresa_id = ${lit(empresa.id)}
   order by c.matricula limit 6
`);
console.log("\nPara entrar no app (código da empresa: enerpeixe):");
for (const c of exemplos) {
  console.log(`  matrícula ${c.matricula}  PIN ${c.pin_fixo}  — ${c.nome} (${c.setor})`);
}
console.log("\nMaterial público: /m/enerpeixe/nr1");
