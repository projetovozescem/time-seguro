// Bootstrap do projeto de DESENVOLVIMENTO (docs/TIME_02 §1.6).
//
// O documento manda criar o 1º usuário em Authentication > Users e rodar dois
// inserts no SQL Editor. Este script faz as três coisas de uma vez, para o
// ambiente de dev ser reproduzível — e é idempotente.
//
// SOMENTE DESENVOLVIMENTO. Em produção o admin é criado pelo painel do Supabase
// e a senha nasce com a própria pessoa; aqui a senha é provisória e aparece no
// terminal de propósito, para você trocá-la no primeiro acesso.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
import { resolve } from "node:path";
import { consultar, raiz } from "./_db.mjs";

const EMAIL = process.env.BOOTSTRAP_EMAIL ?? "max.eldon@gmail.com";
/**
 * Senha do admin. Nunca tem valor padrao no codigo: ou vem do .env (fora do
 * git), ou e sorteada agora e impressa uma unica vez.
 */
const SENHA = process.env.BOOTSTRAP_SENHA ?? sortearSenha();
const SENHA_SORTEADA = !process.env.BOOTSTRAP_SENHA;

function sortearSenha() {
  const { randomBytes } = require("node:crypto");
  return "Time-" + randomBytes(9).toString("base64url");
}
const EMPRESA = "Empresa Piloto";
const CODIGO = "piloto";

/** Termo LGPD de docs/TIME_03 §7, com os placeholders preenchidos. */
const TERMO = readFileSync(resolve(raiz, "docs/TIME_03_SEGURANCA_LGPD.md"), "utf8")
  .match(/TERMO DE CIÊNCIA E CONSENTIMENTO[\s\S]*?Ao tocar em "Li e aceito"[^\n]*\n/)?.[0]
  ?.replace(/\[NOME DA EMPRESA\]/g, EMPRESA)
  .replace(/\[CONTATO\]/g, "sst@empresapiloto.exemplo");

if (!TERMO) {
  console.error("Não achei o termo LGPD em docs/TIME_03_SEGURANCA_LGPD.md §7.");
  process.exit(1);
}

const lit = (v) => "'" + String(v).replace(/'/g, "''") + "'";

// ---------------------------------------------------------------------
// 1. Usuário de Auth (e-mail já confirmado, para dar login direto)
// ---------------------------------------------------------------------
const [usuario] = await consultar(`
  with novo as (
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      -- O GoTrue le estas colunas em string nao-anulavel: NULL aqui faz o
      -- login morrer com "Database error querying schema".
      confirmation_token, recovery_token, email_change, email_change_token_new
    )
    select '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
           'authenticated', 'authenticated', ${lit(EMAIL)},
           extensions.crypt(${lit(SENHA)}, extensions.gen_salt('bf')),
           now(), now(), now(),
           '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
           '', '', '', ''
     where not exists (select 1 from auth.users where email = ${lit(EMAIL)})
    returning id
  )
  select id, true as criado from novo
  union all
  select id, false from auth.users where email = ${lit(EMAIL)}
   and not exists (select 1 from novo)
`);

if (!usuario) {
  console.error("Não consegui criar nem localizar o usuário de Auth.");
  process.exit(1);
}
const userId = usuario.id;
console.log(usuario.criado ? `+ usuário ${EMAIL} criado` : `= usuário ${EMAIL} já existia`);

// O supabase-js exige a linha em auth.identities para o login por e-mail.
await consultar(`
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  )
  select gen_random_uuid(), ${lit(userId)}, ${lit(userId)},
         jsonb_build_object('sub', ${lit(userId)}, 'email', ${lit(EMAIL)}),
         'email', now(), now(), now()
   where not exists (
     select 1 from auth.identities
      where user_id = ${lit(userId)} and provider = 'email'
   )
`);

// ---------------------------------------------------------------------
// 2. Empresa piloto
// ---------------------------------------------------------------------
const [empresa] = await consultar(`
  with nova as (
    insert into public.empresas (nome, codigo, termo_lgpd_texto)
    select ${lit(EMPRESA)}, ${lit(CODIGO)}, ${lit(TERMO)}
     where not exists (select 1 from public.empresas where codigo = ${lit(CODIGO)})
    returning id
  )
  select id, true as criada from nova
  union all
  select id, false from public.empresas where codigo = ${lit(CODIGO)}
   and not exists (select 1 from nova)
`);
const empresaId = empresa.id;
console.log(empresa.criada ? `+ empresa ${EMPRESA} criada` : `= empresa ${EMPRESA} já existia`);

// ---------------------------------------------------------------------
// 3. Perfil de admin, com a flag do comitê de assédio
// ---------------------------------------------------------------------
const [perfil] = await consultar(`
  with novo as (
    insert into public.perfis_tecnicos (user_id, empresa_id, nome, papel, comite_assedio)
    select ${lit(userId)}, ${lit(empresaId)}, 'Técnico de SST', 'admin', true
     where not exists (select 1 from public.perfis_tecnicos where user_id = ${lit(userId)})
    returning papel, comite_assedio
  )
  select papel, comite_assedio, true as criado from novo
  union all
  select papel, comite_assedio, false from public.perfis_tecnicos
   where user_id = ${lit(userId)} and not exists (select 1 from novo)
`);
console.log(
  perfil.criado
    ? `+ perfil ${perfil.papel} (comitê de assédio: ${perfil.comite_assedio})`
    : `= perfil ${perfil.papel} já existia`,
);

console.log(`
Pronto. Para entrar no painel:
  e-mail: ${EMAIL}
  senha:  ${SENHA}${SENHA_SORTEADA ? "   <- sorteada agora; guarde em BOOTSTRAP_SENHA no .env" : ""}

Código da empresa para o app do colaborador: ${CODIGO}
`);
