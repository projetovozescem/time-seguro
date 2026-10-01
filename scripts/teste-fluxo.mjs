// Teste de fluxo de ponta a ponta no projeto de DESENVOLVIMENTO.
//
// Cobre as seis famílias que docs/TIME_13 §3f exige, por HTTP real (não por
// inspeção de catálogo — isso é o scripts/test-rls.mjs):
//   1. pontuação idempotente
//   2. gabarito oculto antes de responder
//   3. bloqueio depois de 5 PINs errados
//   4. anon sem acesso a tabela
//   5. pin_hash ilegível pelo painel
//   6. cipa sem comite_assedio não lê denúncias
//
// Escreve no banco de desenvolvimento (responde quiz, ativa campanha). Não
// rodar contra nada que não seja dev.
import { carregarEnv, consultar } from "./_db.mjs";

carregarEnv();
const URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
if (!URL || !ANON) {
  console.error("Falta VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY no .env.");
  process.exit(1);
}

const ADMIN_EMAIL = process.env.BOOTSTRAP_EMAIL;
const ADMIN_SENHA = process.env.BOOTSTRAP_SENHA;
const CIPA_EMAIL = "cipa.demo@exemplo.invalid";
/** Senha do usuario de teste da CIPA: derivada da do admin, nao versionada. */
const CIPA_SENHA = ADMIN_SENHA ? ADMIN_SENHA + "-cipa" : null;

if (!ADMIN_EMAIL || !ADMIN_SENHA) {
  console.error(
    "Falta BOOTSTRAP_EMAIL ou BOOTSTRAP_SENHA no .env.\n" +
      "São as credenciais do admin criado por npm run db:bootstrap.",
  );
  process.exit(1);
}

const lit = (v) => (v === null ? "null" : "'" + String(v).replace(/'/g, "''") + "'");

let falhas = 0;
let total = 0;
function checar(ok, descricao, detalhe) {
  total++;
  if (ok) {
    console.log(`  ok   ${descricao}`);
  } else {
    falhas++;
    console.log(`  FALHOU ${descricao}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

/** Chama uma RPC. Sem `jwt`, chama como anon. */
async function rpc(nome, args = {}, jwt) {
  const r = await fetch(`${URL}/rest/v1/rpc/${nome}`, {
    method: "POST",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${jwt ?? ANON}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const texto = await r.text();
  let corpo;
  try {
    corpo = JSON.parse(texto);
  } catch {
    corpo = texto;
  }
  return { status: r.status, corpo };
}

async function entrar(email, senha) {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: senha }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`login de ${email} falhou: ${JSON.stringify(j).slice(0, 160)}`);
  return j.access_token;
}

/** Cria um usuário de Auth por SQL, do jeito que o GoTrue aceita. */
async function criarUsuario(email, senha) {
  const [u] = await consultar(`
    with novo as (
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change, email_change_token_new
      )
      select '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
             'authenticated', 'authenticated', ${lit(email)},
             extensions.crypt(${lit(senha)}, extensions.gen_salt('bf')),
             now(), now(), now(),
             '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
             '', '', '', ''
       where not exists (select 1 from auth.users where email = ${lit(email)})
      returning id
    )
    select id from novo
    union all
    select id from auth.users where email = ${lit(email)}
     and not exists (select 1 from novo)
  `);
  // Dev: se o usuario ja existia, sincroniza a senha para o teste poder entrar.
  await consultar(`
    update auth.users
       set encrypted_password = extensions.crypt(${lit(senha)}, extensions.gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           confirmation_token = coalesce(confirmation_token, ''),
           recovery_token = coalesce(recovery_token, ''),
           email_change = coalesce(email_change, ''),
           email_change_token_new = coalesce(email_change_token_new, '')
     where id = ${lit(u.id)}
  `);

  await consultar(`
    insert into auth.identities (id, user_id, provider_id, identity_data, provider,
                                 last_sign_in_at, created_at, updated_at)
    select gen_random_uuid(), ${lit(u.id)}, ${lit(u.id)},
           jsonb_build_object('sub', ${lit(u.id)}, 'email', ${lit(email)}),
           'email', now(), now(), now()
     where not exists (
       select 1 from auth.identities where user_id = ${lit(u.id)} and provider = 'email'
     )
  `);
  return u.id;
}

// =====================================================================
console.log("\n--- preparação ---");

const [empresa] = await consultar("select id, codigo from public.empresas where codigo = 'piloto'");
if (!empresa) {
  console.error("Empresa piloto não existe. Rode npm run db:bootstrap e npm run db:seed.");
  process.exit(1);
}

const jwtAdmin = await entrar(ADMIN_EMAIL, ADMIN_SENHA);
console.log(`  admin autenticado (${ADMIN_EMAIL})`);

// Campanha ativa
const [campanha] = await consultar(`
  select id, status from public.campanhas
   where empresa_id = ${lit(empresa.id)} order by criado_em desc limit 1
`);
if (campanha.status !== "ativa") {
  const r = await rpc("tecnico_ativar_campanha", { p_campanha: campanha.id }, jwtAdmin);
  checar(r.corpo?.ok === true, "tecnico_ativar_campanha", JSON.stringify(r.corpo).slice(0, 120));
} else {
  console.log("  campanha já estava ativa");
}

/**
 * Dois colaboradores descartáveis por execução: um para o fluxo do quiz, outro
 * para queimar tentativas de PIN.
 *
 * Por que novos a cada rodada, e não os 1001/1002 do seed: o quiz do dia só pode
 * ser respondido uma vez, então reusar o mesmo colaborador faria o teste passar
 * na primeira execução e falhar nas seguintes. A alternativa seria apagar as
 * respostas do dia, e apagar dado é coisa que este projeto não faz sem pedir.
 * Os 1001/1002 ficam intactos para testar a interface à mão.
 */
const selo = Date.now().toString().slice(-9);
const novos = await consultar(`
  insert into public.colaboradores (empresa_id, setor_id, matricula, nome, turno)
  select ${lit(empresa.id)},
         (select id from public.setores where empresa_id = ${lit(empresa.id)} limit 1),
         v.matricula, v.nome, 'manha'
    from (values
      ('t${selo}a', 'Teste Fluxo ${selo} (automático)'),
      ('t${selo}b', 'Teste Bloqueio ${selo} (automático)')
    ) as v(matricula, nome)
  returning id, matricula
`);
const fluxo = novos.find((c) => c.matricula.endsWith("a"));
const cobaia = novos.find((c) => c.matricula.endsWith("b"));
console.log(`  colaboradores de teste: ${fluxo.matricula}, ${cobaia.matricula}`);

// PINs provisórios (a RPC devolve uma única vez)
const pins = await rpc("tecnico_gerar_pins", { p_colaboradores: [fluxo.id, cobaia.id] }, jwtAdmin);
// A RPC devolve TABLE(colaborador_id, matricula, nome, setor, pin), ou seja,
// um array de linhas. O PIN só aparece aqui, uma vez (docs/TIME_03 §3).
const linhasPin = Array.isArray(pins.corpo) ? pins.corpo : [];
const porId = new Map(linhasPin.map((p) => [p.colaborador_id, p.pin]));
const pinFluxo = porId.get(fluxo.id);
const pinCobaia = porId.get(cobaia.id);
checar(
  typeof pinFluxo === "string" && pinFluxo.length === 6,
  "tecnico_gerar_pins devolve PIN de 6 dígitos",
  JSON.stringify(pins.corpo).slice(0, 160),
);
if (!pinFluxo) {
  console.error("\nSem PIN não há como seguir. Abortando.");
  process.exit(1);
}

// =====================================================================
console.log("\n--- família 4: anon sem acesso a tabela ---");
for (const tabela of [
  "colaboradores",
  "empresas",
  "perguntas",
  "denuncias_assedio",
  "pontos_lancamentos",
]) {
  const r = await fetch(`${URL}/rest/v1/${tabela}?select=*&limit=1`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  checar(r.status === 401 || r.status === 403, `anon recusado em ${tabela} (http ${r.status})`);
}

console.log("\n--- família 5: pin_hash ilegível pelo painel ---");
{
  const r = await fetch(`${URL}/rest/v1/colaboradores?select=pin_hash&limit=1`, {
    headers: { apikey: ANON, Authorization: `Bearer ${jwtAdmin}` },
  });
  checar(r.status === 403, `admin recusado em colaboradores.pin_hash (http ${r.status})`);
  const ok = await fetch(`${URL}/rest/v1/colaboradores?select=nome,matricula&limit=1`, {
    headers: { apikey: ANON, Authorization: `Bearer ${jwtAdmin}` },
  });
  checar(ok.status === 200, `admin lê nome e matrícula (http ${ok.status})`);
}

// =====================================================================
console.log("\n--- fluxo do colaborador: login, PIN, termo ---");
const login1 = await rpc("colaborador_login", {
  p_empresa_codigo: empresa.codigo,
  p_matricula: fluxo.matricula,
  p_pin: pinFluxo,
});
checar(
  login1.corpo?.ok === true,
  "login com PIN provisório",
  JSON.stringify(login1.corpo).slice(0, 140),
);
checar(
  login1.corpo?.pendencia === "trocar_pin",
  `pendência é trocar_pin (veio ${login1.corpo?.pendencia})`,
);
const token = login1.corpo?.token;

const novoPin = "418275";
const troca = await rpc("colaborador_trocar_pin", {
  p_token: token,
  p_pin_atual: pinFluxo,
  p_pin_novo: novoPin,
});
checar(troca.corpo?.ok === true, "troca de PIN", JSON.stringify(troca.corpo).slice(0, 140));

const fraco = await rpc("colaborador_trocar_pin", {
  p_token: token,
  p_pin_atual: novoPin,
  p_pin_novo: "123456",
});
checar(fraco.corpo?.motivo === "pin_fraco", "servidor recusa PIN em sequência (pin_fraco)");

const termo = await rpc("colaborador_termo_lgpd", { p_token: token });
checar(typeof termo.corpo?.texto === "string", "termo LGPD devolvido");
const aceite = await rpc("colaborador_aceitar_lgpd", { p_token: token });
checar(aceite.corpo?.ok === true, "aceite do termo registrado");

// =====================================================================
console.log("\n--- família 2: gabarito oculto antes de responder ---");
const doDia = await rpc("colaborador_perguntas_do_dia", { p_token: token });
checar(doDia.corpo?.ok === true, "perguntas do dia", JSON.stringify(doDia.corpo).slice(0, 140));
const perguntas = doDia.corpo?.perguntas ?? [];
checar(perguntas.length > 0, `veio ${perguntas.length} pergunta(s)`);

const naoRespondidas = perguntas.filter((p) => !p.respondida);
checar(
  naoRespondidas.length > 0 && naoRespondidas.every((p) => p.correta === null),
  "nenhuma pergunta não respondida traz `correta`",
  JSON.stringify(naoRespondidas.map((p) => p.correta)),
);
checar(
  naoRespondidas.every((p) => p.explicacao === null),
  "nenhuma pergunta não respondida traz `explicacao`",
);

// =====================================================================
console.log("\n--- família 1: pontuação idempotente ---");
const alvo = naoRespondidas[0];
// Olha SO a origem do quiz: `presenca_diaria` tambem lanca pontos na primeira
// atividade do dia, e misturar as duas origens esconderia dupla contagem.
const contar = async () =>
  (
    await consultar(`
      select coalesce(sum(pontos) filter (where origem = 'quiz_diario'), 0)::int as quiz,
             count(*) filter (where origem = 'quiz_diario')::int as lancamentos_quiz,
             coalesce(sum(pontos), 0)::int as total
        from public.pontos_lancamentos where colaborador_id = ${lit(fluxo.id)}
    `)
  )[0];
const antes = [await contar()];

const resposta1 = await rpc("colaborador_responder_pergunta", {
  p_token: token,
  p_pergunta_id: alvo.id,
  p_alternativa: 0,
  p_tempo_ms: 1234,
});
checar(
  resposta1.corpo?.ok === true,
  "resposta aceita",
  JSON.stringify(resposta1.corpo).slice(0, 140),
);
checar(typeof resposta1.corpo?.correta === "number", "o gabarito volta DEPOIS de responder");

const resposta2 = await rpc("colaborador_responder_pergunta", {
  p_token: token,
  p_pergunta_id: alvo.id,
  p_alternativa: 0,
  p_tempo_ms: 1234,
});
checar(resposta2.corpo?.motivo === "ja_respondida", "segunda tentativa devolve ja_respondida");

const depois = [await contar()];
const ganhosQuiz = depois[0].quiz - antes[0].quiz;
const novosDoQuiz = depois[0].lancamentos_quiz - antes[0].lancamentos_quiz;
checar(novosDoQuiz <= 1, `no máximo 1 lançamento de quiz_diario (foram ${novosDoQuiz})`);
checar(
  resposta1.corpo?.acertou ? ganhosQuiz > 0 : ganhosQuiz === 0,
  `quiz_diario só pontua no acerto (acertou=${resposta1.corpo?.acertou}, ganhou=${ganhosQuiz})`,
);
checar(
  resposta1.corpo?.pontos === ganhosQuiz,
  `a RPC informa os pontos que gravou (disse ${resposta1.corpo?.pontos}, gravou ${ganhosQuiz})`,
);

// Índice único: tentar lançar a mesma origem duas vezes tem de falhar.
const [{ duplicou }] = await consultar(`
  select exists (
    select 1 from pg_indexes
     where schemaname='public' and tablename='pontos_lancamentos'
       and indexdef ilike '%UNIQUE%' and indexdef ilike '%origem%'
  ) as duplicou
`);
checar(duplicou === true, "índice único por origem existe no livro-razão");

// =====================================================================
console.log("\n--- família 3: bloqueio depois de 5 PINs errados ---");
let bloqueou = null;
for (let i = 1; i <= 6; i++) {
  const r = await rpc("colaborador_login", {
    p_empresa_codigo: empresa.codigo,
    p_matricula: cobaia.matricula,
    p_pin: "000000",
  });
  if (r.corpo?.motivo === "bloqueado") {
    bloqueou = i;
    break;
  }
  checar(
    r.corpo?.motivo === "credenciais_invalidas",
    `tentativa ${i} devolve credenciais_invalidas (não revela matrícula)`,
  );
}
checar(bloqueou !== null && bloqueou <= 6, `bloqueou na tentativa ${bloqueou}`);

const comPinCerto = await rpc("colaborador_login", {
  p_empresa_codigo: empresa.codigo,
  p_matricula: cobaia.matricula,
  p_pin: pinCobaia ?? "000000",
});
checar(
  comPinCerto.corpo?.motivo === "bloqueado",
  "bloqueado recusa até o PIN correto",
  JSON.stringify(comPinCerto.corpo).slice(0, 120),
);
// Libera a cobaia para a próxima rodada do teste.
await rpc("tecnico_desbloquear_colaborador", { p_colaborador: cobaia.id }, jwtAdmin);

// =====================================================================
console.log("\n--- família 6: cipa sem comite_assedio não lê denúncias ---");
const cipaId = await criarUsuario(CIPA_EMAIL, CIPA_SENHA);
await consultar(`
  insert into public.perfis_tecnicos (user_id, empresa_id, nome, papel, comite_assedio)
  select ${lit(cipaId)}, ${lit(empresa.id)}, 'Membro da CIPA', 'cipa', false
   where not exists (select 1 from public.perfis_tecnicos where user_id = ${lit(cipaId)})
`);
await consultar(`
  update public.perfis_tecnicos set papel = 'cipa', comite_assedio = false
   where user_id = ${lit(cipaId)}
`);

// Uma denúncia para haver o que esconder.
const denuncia = await rpc("registrar_denuncia_assedio", {
  p_empresa_codigo: empresa.codigo,
  p_categoria: "moral",
  p_descricao: "Relato de demonstração para teste de acesso do comitê.",
  p_local: "Setor de demonstração",
  p_periodo: "Última semana",
  p_quer_retorno: false,
});
checar(
  denuncia.corpo?.ok === true,
  "anon registra denúncia sem token",
  JSON.stringify(denuncia.corpo).slice(0, 140),
);

const jwtCipa = await entrar(CIPA_EMAIL, CIPA_SENHA);
const leituraCipa = await fetch(`${URL}/rest/v1/denuncias_assedio?select=protocolo,descricao`, {
  headers: { apikey: ANON, Authorization: `Bearer ${jwtCipa}` },
});
const linhasCipa = await leituraCipa.json();
checar(
  Array.isArray(linhasCipa) && linhasCipa.length === 0,
  `cipa sem flag não vê denúncia nenhuma (veio ${JSON.stringify(linhasCipa).slice(0, 80)})`,
);

const leituraComite = await fetch(`${URL}/rest/v1/denuncias_assedio?select=protocolo`, {
  headers: { apikey: ANON, Authorization: `Bearer ${jwtAdmin}` },
});
const linhasComite = await leituraComite.json();
checar(
  Array.isArray(linhasComite) && linhasComite.length > 0,
  `admin com comite_assedio vê a denúncia (${linhasComite.length})`,
);

// A denúncia não guarda hora nem colaborador (docs/TIME_03 §6).
const [anonimato] = await consultar(`
  select
    (select count(*) from information_schema.columns
      where table_schema='public' and table_name='denuncias_assedio'
        and column_name in ('colaborador_id','ip','dispositivo_id'))::int as colunas_proibidas,
    (select data_type from information_schema.columns
      where table_schema='public' and table_name='denuncias_assedio'
        and column_name='recebida_em') as tipo_recebida_em
`);
checar(
  anonimato.colunas_proibidas === 0,
  "denuncias_assedio não tem colaborador_id, ip nem dispositivo",
);
checar(
  anonimato.tipo_recebida_em === "date",
  `recebida_em é só data (é ${anonimato.tipo_recebida_em})`,
);

// Denúncia nunca pontua.
const [{ pontos_de_denuncia }] = await consultar(`
  select count(*)::int as pontos_de_denuncia from public.pontos_lancamentos
   where origem ilike '%denuncia%' or origem ilike '%assedio%'
`);
checar(pontos_de_denuncia === 0, "nenhum ponto lançado por denúncia");

// =====================================================================
console.log("\n--- CRUD de perguntas: o caminho que a tela do painel usa ---");
{
  const tabela = (jwt) => ({
    apikey: ANON,
    Authorization: `Bearer ${jwt}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  });

  const [tema] = await consultar(
    "select id from public.temas where empresa_id is null order by slug limit 1",
  );
  const enunciado = `Pergunta de teste automático ${selo} — pode apagar`;
  const corpo = JSON.stringify({
    empresa_id: empresa.id,
    tema_id: tema.id,
    enunciado,
    alternativas: ["Alternativa de teste A", "Alternativa de teste B"],
    correta: 1,
    explicacao: "Criada por scripts/teste-fluxo.mjs.",
    dificuldade: 2,
    origem: "manual",
  });

  // Técnico/admin pode criar (policy perguntas_escrever).
  const criar = await fetch(`${URL}/rest/v1/perguntas`, {
    method: "POST",
    headers: tabela(jwtAdmin),
    body: corpo,
  });
  const criada = await criar.json();
  checar(
    criar.status === 201,
    `admin cria pergunta (http ${criar.status})`,
    JSON.stringify(criada).slice(0, 120),
  );
  const id = Array.isArray(criada) ? criada[0]?.id : undefined;

  // CIPA é somente leitura (docs/TIME_01 §3).
  const cipaCria = await fetch(`${URL}/rest/v1/perguntas`, {
    method: "POST",
    headers: tabela(jwtCipa),
    body: JSON.stringify({
      empresa_id: empresa.id,
      tema_id: tema.id,
      enunciado: `CIPA nao deveria conseguir ${selo}`,
      alternativas: ["a", "b"],
      correta: 0,
      dificuldade: 2,
      origem: "manual",
    }),
  });
  checar(
    cipaCria.status === 401 || cipaCria.status === 403,
    `cipa recusada ao criar pergunta (http ${cipaCria.status})`,
  );

  // Pergunta global é só leitura: ninguém edita pelo cliente.
  const [global] = await consultar(
    "select id from public.perguntas where empresa_id is null limit 1",
  );
  if (global) {
    const editarGlobal = await fetch(`${URL}/rest/v1/perguntas?id=eq.${global.id}`, {
      method: "PATCH",
      headers: tabela(jwtAdmin),
      body: JSON.stringify({ enunciado: "tentativa de alterar pergunta global" }),
    });
    const alteradas = await editarGlobal.json();
    checar(
      Array.isArray(alteradas) && alteradas.length === 0,
      "pergunta global não é editável pelo painel",
    );
  } else {
    console.log("  --   sem pergunta global para testar (seed do TIME_02 §5.6 traz só temas)");
  }

  // Limpa o que o teste criou.
  if (id) {
    const apagar = await fetch(`${URL}/rest/v1/perguntas?id=eq.${id}`, {
      method: "DELETE",
      headers: tabela(jwtAdmin),
    });
    checar(apagar.ok, `admin apaga a pergunta de teste (http ${apagar.status})`);
  }
}

// =====================================================================
console.log(
  falhas === 0
    ? `\nFluxo: ${total} verificações passaram.`
    : `\nFluxo: ${falhas} de ${total} verificações FALHARAM.`,
);
process.exit(falhas === 0 ? 0 : 1);
