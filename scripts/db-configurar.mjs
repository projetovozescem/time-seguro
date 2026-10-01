// Configurações do projeto Supabase de DESENVOLVIMENTO que não cabem em
// migration: bucket de Storage e ajustes do Auth.
//
// Fontes: docs/TIME_02 §4 (bucket e policy das fotos de relato) e
// docs/TIME_03 §8 (checklist de segurança antes de publicar).
//
// Idempotente. Sem argumentos, só mostra o estado; com `--aplicar`, aplica.
import { consultar, credenciaisApi } from "./_db.mjs";

const APLICAR = process.argv.includes("--aplicar");
const { token, ref } = credenciaisApi();

/** URL do site, usada pelo Auth no link de redefinição de senha. */
const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";
const REDIRECIONAMENTOS = [
  `${SITE_URL}/painel/nova-senha`,
  "http://localhost:3000/painel/nova-senha",
  "http://localhost:5173/painel/nova-senha",
];

function titulo(t) {
  console.log(`\n--- ${t} ---`);
}

function estado(ok, descricao) {
  console.log(`  ${ok ? "ok  " : "FALTA"} ${descricao}`);
  return ok;
}

async function auth(metodo, corpo) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(corpo ? { body: JSON.stringify(corpo) } : {}),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`config/auth http ${r.status}: ${texto.slice(0, 200)}`);
  return texto ? JSON.parse(texto) : {};
}

let pendencias = 0;

// =====================================================================
titulo("Storage: bucket das fotos de relato (docs/TIME_02 §4)");

const buckets = await consultar(
  "select id, public from storage.buckets where id = 'relatos-fotos'",
);
const bucketOk = buckets.length === 1 && buckets[0].public === false;

if (!bucketOk) {
  pendencias++;
  estado(false, "bucket relatos-fotos privado");
  if (APLICAR) {
    await consultar(`
      insert into storage.buckets (id, name, public)
      values ('relatos-fotos', 'relatos-fotos', false)
      on conflict (id) do update set public = false
    `);
    console.log("       -> criado (privado)");
  }
} else {
  estado(true, "bucket relatos-fotos privado");
}

// A policy deixa o técnico ver as fotos da PRÓPRIA empresa: o caminho do
// arquivo começa com o empresa_id. Ninguém faz upload direto — só a Edge
// Function, com URL assinada (docs/TIME_03 §5).
const policies = await consultar(`
  select policyname from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'tecnico le fotos da empresa'
`);

if (policies.length === 0) {
  pendencias++;
  estado(false, "policy de leitura das fotos pelo técnico");
  if (APLICAR) {
    await consultar(`
      create policy "tecnico le fotos da empresa" on storage.objects
        for select to authenticated
        using (
          bucket_id = 'relatos-fotos'
          and (storage.foldername(name))[1] = public.minha_empresa()::text
        )
    `);
    console.log("       -> criada");
  }
} else {
  estado(true, "policy de leitura das fotos pelo técnico");
}

// anon não enxerga nada do bucket.
const policiesAnon = await consultar(`
  select policyname, roles::text from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and roles::text like '%anon%'
`);
if (!estado(policiesAnon.length === 0, "anon sem policy em storage.objects")) pendencias++;

// =====================================================================
titulo("Auth (docs/TIME_03 §8)");

const config = await auth("GET");

const checagens = [
  {
    chave: "disable_signup",
    ok: config.disable_signup === true,
    descricao: "cadastro público desativado",
    valor: { disable_signup: true },
  },
  {
    chave: "site_url",
    ok: config.site_url === SITE_URL,
    descricao: `site_url = ${SITE_URL}`,
    valor: { site_url: SITE_URL },
  },
  {
    chave: "uri_allow_list",
    ok: REDIRECIONAMENTOS.every((u) => (config.uri_allow_list ?? "").includes(u)),
    descricao: "redirecionamento de /painel/nova-senha liberado",
    valor: { uri_allow_list: REDIRECIONAMENTOS.join(",") },
  },
];

const aAplicar = {};
for (const c of checagens) {
  if (!estado(c.ok, c.descricao)) {
    pendencias++;
    Object.assign(aAplicar, c.valor);
  }
}

if (APLICAR && Object.keys(aAplicar).length > 0) {
  await auth("PATCH", aAplicar);
  console.log(`       -> aplicado: ${Object.keys(aAplicar).join(", ")}`);
}

// =====================================================================
console.log(
  pendencias === 0
    ? "\nTudo configurado."
    : APLICAR
      ? `\n${pendencias} item(ns) aplicado(s). Rode de novo sem --aplicar para confirmar.`
      : `\n${pendencias} item(ns) pendente(s). Rode com --aplicar para configurar.`,
);
process.exit(APLICAR || pendencias === 0 ? 0 : 1);
