// Seed de DESENVOLVIMENTO: carrega perguntas do docs/TIME_12 na Empresa Piloto,
// cria uma campanha ativa e um colaborador de teste.
//
// Serve para exercitar o app de ponta a ponta. Os dados são claramente de
// demonstração — docs/TIME_11 §3 é explícito: dado de demonstração nunca pode
// ser apresentado como resultado real.
//
// SOMENTE DESENVOLVIMENTO. Idempotente.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { consultar, raiz } from "./_db.mjs";
import { importarTs } from "./_bundle.mjs";

/** Quantas perguntas por tema entram no seed (docs/TIME_13 §3b: 2 por tema). */
const POR_TEMA = Number(process.env.SEED_POR_TEMA ?? 2);
const CODIGO_EMPRESA = "piloto";
const MATRICULA = "1001";

const lit = (v) =>
  v === null || v === undefined ? "null" : "'" + String(v).replace(/'/g, "''") + "'";
const arrayLit = (xs) => "array[" + xs.map(lit).join(", ") + "]::text[]";

// ---------------------------------------------------------------------
// 1. Lê o banco de perguntas do documento com o parser do projeto
// ---------------------------------------------------------------------
// Usa o MESMO parser do app, em vez de duplicar a logica aqui.
const { lerTxt } = await importarTs(resolve(raiz, "src/lib/importacao/txt.ts"));

const doc = readFileSync(resolve(raiz, "docs/TIME_12_BANCO_DE_PERGUNTAS.md"), "utf8");
const bloco = /```\n([\s\S]*?)\n```/.exec(doc)?.[1];
if (!bloco) {
  console.error("Não achei o bloco de perguntas em docs/TIME_12.");
  process.exit(1);
}

const todas = lerTxt(bloco);
const comAviso = todas.filter((p) => p.avisos.length > 0);
if (comAviso.length > 0) {
  console.error(`${comAviso.length} pergunta(s) do TIME_12 com aviso. Abortando.`);
  process.exit(1);
}

// 2 primeiras de cada tema, preservando a ordem do documento.
const porTema = new Map();
for (const p of todas) {
  const lista = porTema.get(p.tema) ?? [];
  if (lista.length < POR_TEMA) lista.push(p);
  porTema.set(p.tema, lista);
}
const escolhidas = [...porTema.values()].flat();
console.log(
  `${escolhidas.length} perguntas escolhidas (${POR_TEMA} por tema, ${porTema.size} temas)`,
);

// ---------------------------------------------------------------------
// 2. Empresa e temas
// ---------------------------------------------------------------------
const [empresa] = await consultar(
  `select id from public.empresas where codigo = ${lit(CODIGO_EMPRESA)}`,
);
if (!empresa) {
  console.error(`Empresa "${CODIGO_EMPRESA}" não existe. Rode npm run db:bootstrap primeiro.`);
  process.exit(1);
}
const empresaId = empresa.id;

const temas = await consultar(
  `select id, slug from public.temas where empresa_id is null or empresa_id = ${lit(empresaId)}`,
);
const idDoTema = new Map(temas.map((t) => [t.slug, t.id]));

const semTema = [...porTema.keys()].filter((s) => !idDoTema.has(s));
if (semTema.length > 0) {
  console.error(`Tema do TIME_12 que não existe no banco: ${semTema.join(", ")}`);
  process.exit(1);
}

// ---------------------------------------------------------------------
// 3. Perguntas (idempotente pelo enunciado dentro da empresa)
// ---------------------------------------------------------------------
const valores = escolhidas
  .map(
    (p) =>
      `(${lit(empresaId)}::uuid, ${lit(idDoTema.get(p.tema))}::uuid, ${lit(p.enunciado)}, ` +
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
console.log(`+ ${inseridas.length} pergunta(s) inserida(s)`);

// ---------------------------------------------------------------------
// 4. Campanha ativa com todos os temas
// ---------------------------------------------------------------------
const [campanha] = await consultar(`
  with nova as (
    insert into public.campanhas
      (empresa_id, nome, inicio, fim, status, premiacao, ranking_visivel, perguntas_por_dia)
    select ${lit(empresaId)}, 'Campanha de Demonstração T4 2026',
           current_date - 7, current_date + 60, 'rascunho',
           'Brinde de demonstração (dados fictícios)', true, 5
     where not exists (
       select 1 from public.campanhas
        where empresa_id = ${lit(empresaId)} and nome = 'Campanha de Demonstração T4 2026'
     )
    returning id, status
  )
  select id, status, true as criada from nova
  union all
  select id, status, false from public.campanhas
   where empresa_id = ${lit(empresaId)} and nome = 'Campanha de Demonstração T4 2026'
     and not exists (select 1 from nova)
`);
const campanhaId = campanha.id;
console.log(campanha.criada ? "+ campanha criada" : `= campanha já existia (${campanha.status})`);

await consultar(`
  insert into public.campanha_temas (campanha_id, tema_id, empresa_id)
  select ${lit(campanhaId)}, t.id, ${lit(empresaId)}
    from public.temas t
   where (t.empresa_id is null or t.empresa_id = ${lit(empresaId)})
     and t.slug = any(${arrayLit([...porTema.keys()])})
     and not exists (
       select 1 from public.campanha_temas ct
        where ct.campanha_id = ${lit(campanhaId)} and ct.tema_id = t.id
     )
`);
const [{ vinculados }] = await consultar(
  `select count(*)::int as vinculados from public.campanha_temas where campanha_id = ${lit(campanhaId)}`,
);
console.log(`= ${vinculados} tema(s) vinculado(s) à campanha`);

// ---------------------------------------------------------------------
// 5. Setor e colaborador de teste
// ---------------------------------------------------------------------
const [setor] = await consultar(`
  with novo as (
    insert into public.setores (empresa_id, nome)
    select ${lit(empresaId)}, 'Manutenção'
     where not exists (
       select 1 from public.setores where empresa_id = ${lit(empresaId)} and nome = 'Manutenção'
     )
    returning id
  )
  select id from novo
  union all
  select id from public.setores
   where empresa_id = ${lit(empresaId)} and nome = 'Manutenção'
     and not exists (select 1 from novo)
`);

const [colaborador] = await consultar(`
  with novo as (
    insert into public.colaboradores (empresa_id, setor_id, matricula, nome, turno)
    select ${lit(empresaId)}, ${lit(setor.id)}, ${lit(MATRICULA)}, 'Carlos Demonstração', 'manha'
     where not exists (
       select 1 from public.colaboradores
        where empresa_id = ${lit(empresaId)} and matricula = ${lit(MATRICULA)}
     )
    returning id
  )
  select id, true as criado from novo
  union all
  select id, false from public.colaboradores
   where empresa_id = ${lit(empresaId)} and matricula = ${lit(MATRICULA)}
     and not exists (select 1 from novo)
`);
console.log(
  colaborador.criado
    ? `+ colaborador ${MATRICULA} criado`
    : `= colaborador ${MATRICULA} já existia`,
);

console.log(`
Seed de demonstração pronto.
  empresa .......... ${CODIGO_EMPRESA}
  campanha ......... ${campanhaId} (status: ${campanha.status})
  colaborador ...... matrícula ${MATRICULA}

A campanha nasce em RASCUNHO: ative pelo painel ou por tecnico_ativar_campanha.
O PIN e fixo: veja em Colaboradores > PIN no painel, ou em tecnico_ver_pin.
`);
