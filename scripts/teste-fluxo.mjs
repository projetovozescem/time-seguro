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

const [empresa] = await consultar(
  "select id, codigo from public.empresas where codigo = 'enerpeixe'",
);
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

// PIN fixo (0008): nasce com o colaborador e a RPC apenas o DEVOLVE.
const pins = await rpc("tecnico_gerar_pins", { p_colaboradores: [fluxo.id, cobaia.id] }, jwtAdmin);
// A RPC devolve TABLE(colaborador_id, matricula, nome, setor, pin), ou seja,
// um array de linhas.
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
checar(pinFluxo !== pinCobaia, "PINs de colaboradores diferentes sao numeros diferentes (unicos)");
const repetidoPin = await rpc("tecnico_gerar_pins", { p_colaboradores: [fluxo.id] }, jwtAdmin);
checar(
  repetidoPin.corpo?.[0]?.pin === pinFluxo,
  "pedir o PIN de novo devolve o MESMO numero (fixo, nao gera outro)",
);
const [naBase] = await consultar(
  `select pin_fixo from public.colaboradores where id = ${lit(fluxo.id)}`,
);
checar(naBase.pin_fixo === pinFluxo, "o PIN foi dado na criacao do colaborador (trigger)");

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
  const fixo = await fetch(`${URL}/rest/v1/colaboradores?select=pin_fixo&limit=1`, {
    headers: { apikey: ANON, Authorization: `Bearer ${jwtAdmin}` },
  });
  checar(fixo.status === 403, `admin recusado em colaboradores.pin_fixo (http ${fixo.status})`);
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
  "login com o PIN fixo",
  JSON.stringify(login1.corpo).slice(0, 140),
);
checar(
  login1.corpo?.pendencia === "aceitar_lgpd",
  `sem PIN provisorio: a unica pendencia e o termo (veio ${login1.corpo?.pendencia})`,
);
const token = login1.corpo?.token;

// O colaborador NAO troca o PIN: a RPC deixou de ser executavel por anon.
const tentaTrocar = await rpc("colaborador_trocar_pin", {
  p_token: token,
  p_pin_atual: pinFluxo,
  p_pin_novo: "418275",
});
checar(
  tentaTrocar.status >= 400,
  `colaborador_trocar_pin recusada para anon (http ${tentaTrocar.status})`,
);
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
console.log("\n--- campanhas, trilha e eventos: caminho das telas do item 2 ---");
{
  const cab = (jwt) => ({
    apikey: ANON,
    Authorization: `Bearer ${jwt}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  });

  const [tema] = await consultar(
    "select id from public.temas where empresa_id is null order by slug limit 1",
  );

  // 1. Campanha nasce em rascunho pela tela.
  const criar = await fetch(`${URL}/rest/v1/campanhas`, {
    method: "POST",
    headers: cab(jwtAdmin),
    body: JSON.stringify({
      empresa_id: empresa.id,
      nome: `Campanha de teste ${selo}`,
      inicio: "2026-10-01",
      fim: "2026-12-31",
      status: "rascunho",
      perguntas_por_dia: 5,
      ranking_visivel: true,
      config: { pontos_acerto_diario: 15 },
    }),
  });
  const nova = await criar.json();
  const campanhaId = Array.isArray(nova) ? nova[0]?.id : undefined;
  checar(
    criar.status === 201 && Boolean(campanhaId),
    `admin cria campanha em rascunho (http ${criar.status})`,
    JSON.stringify(nova).slice(0, 120),
  );

  // 2. Ativar sem tema tem de ser recusado (docs/TIME_04 §4).
  if (campanhaId) {
    const semTema = await rpc("tecnico_ativar_campanha", { p_campanha: campanhaId }, jwtAdmin);
    // A RPC checa "ja existe campanha ativa" ANTES de "sem temas", e o seed
    // deixa uma campanha ativa. Entao aqui so da para afirmar que a ativacao e
    // recusada; qual das duas razoes vem depende do estado da empresa.
    checar(
      semTema.corpo?.ok === false &&
        ["campanha_sem_temas", "ja_existe_campanha_ativa"].includes(semTema.corpo?.motivo),
      `ativar e recusado com motivo conhecido (veio ${semTema.corpo?.motivo})`,
    );

    // 3. Vincula o tema, como o formulário faz.
    const vincular = await fetch(`${URL}/rest/v1/campanha_temas`, {
      method: "POST",
      headers: cab(jwtAdmin),
      body: JSON.stringify({ campanha_id: campanhaId, tema_id: tema.id, empresa_id: empresa.id }),
    });
    checar(vincular.status === 201, `admin vincula tema (http ${vincular.status})`);

    // 4. Só uma campanha ativa por empresa: a do seed já está ativa.
    const duas = await rpc("tecnico_ativar_campanha", { p_campanha: campanhaId }, jwtAdmin);
    checar(
      duas.corpo?.motivo === "ja_existe_campanha_ativa",
      `segunda campanha ativa é recusada (veio ${duas.corpo?.motivo})`,
    );

    // 5. Lição da trilha, com a pergunta da avaliação.
    const [perguntaDoTema] = await consultar(
      `select id from public.perguntas
        where empresa_id = ${lit(empresa.id)} and tema_id = ${lit(tema.id)} limit 1`,
    );
    const licao = await fetch(`${URL}/rest/v1/licoes`, {
      method: "POST",
      headers: cab(jwtAdmin),
      body: JSON.stringify({
        empresa_id: empresa.id,
        campanha_id: campanhaId,
        tema_id: tema.id,
        titulo: `Licao de teste ${selo}`,
        conteudo_md: "## Conteudo\n\nTexto de teste automatico.",
        carga_minutos: 10,
        nota_minima: 70,
        obrigatoria: true,
        publicada: false,
        ordem: 1,
      }),
    });
    const licaoCriada = await licao.json();
    const licaoId = Array.isArray(licaoCriada) ? licaoCriada[0]?.id : undefined;
    checar(
      licao.status === 201,
      `admin cria lição (http ${licao.status})`,
      JSON.stringify(licaoCriada).slice(0, 120),
    );

    if (licaoId && perguntaDoTema) {
      const vinculo = await fetch(`${URL}/rest/v1/licao_perguntas`, {
        method: "POST",
        headers: cab(jwtAdmin),
        body: JSON.stringify({
          licao_id: licaoId,
          pergunta_id: perguntaDoTema.id,
          empresa_id: empresa.id,
          ordem: 1,
        }),
      });
      checar(vinculo.status === 201, `admin liga pergunta à avaliação (http ${vinculo.status})`);
    }

    // 6. Evento com check-in: o CHECK do banco exige fim > inicio.
    const evento = await fetch(`${URL}/rest/v1/eventos`, {
      method: "POST",
      headers: cab(jwtAdmin),
      body: JSON.stringify({
        empresa_id: empresa.id,
        campanha_id: campanhaId,
        tipo: "dds",
        titulo: `DDS de teste ${selo}`,
        inicio: "2026-10-02T10:00:00Z",
        fim: "2026-10-02T10:15:00Z",
        pontos: 5,
      }),
    });
    checar(evento.status === 201, `admin cria evento (http ${evento.status})`);

    const invertido = await fetch(`${URL}/rest/v1/eventos`, {
      method: "POST",
      headers: cab(jwtAdmin),
      body: JSON.stringify({
        empresa_id: empresa.id,
        tipo: "dds",
        titulo: `Evento invertido ${selo}`,
        inicio: "2026-10-02T10:15:00Z",
        fim: "2026-10-02T10:00:00Z",
        pontos: 5,
      }),
    });
    checar(
      invertido.status >= 400,
      `banco recusa evento com fim antes do início (http ${invertido.status})`,
    );

    // 7. CIPA é somente leitura também aqui.
    const cipaCampanha = await fetch(`${URL}/rest/v1/campanhas`, {
      method: "POST",
      headers: cab(jwtCipa),
      body: JSON.stringify({
        empresa_id: empresa.id,
        nome: `CIPA nao deveria ${selo}`,
        inicio: "2026-10-01",
        fim: "2026-12-31",
        status: "rascunho",
      }),
    });
    checar(
      cipaCampanha.status === 401 || cipaCampanha.status === 403,
      `cipa recusada ao criar campanha (http ${cipaCampanha.status})`,
    );

    const cipaEvento = await fetch(`${URL}/rest/v1/eventos`, {
      method: "POST",
      headers: cab(jwtCipa),
      body: JSON.stringify({
        empresa_id: empresa.id,
        tipo: "dds",
        titulo: `CIPA nao deveria ${selo}`,
        inicio: "2026-10-03T10:00:00Z",
        fim: "2026-10-03T10:15:00Z",
        pontos: 5,
      }),
    });
    checar(
      cipaEvento.status === 401 || cipaEvento.status === 403,
      `cipa recusada ao criar evento (http ${cipaEvento.status})`,
    );

    // 8. Limpa o que este teste criou, em ordem de dependência.
    if (licaoId) {
      await consultar(`delete from public.licao_perguntas where licao_id = ${lit(licaoId)}`);
      await consultar(`delete from public.licoes where id = ${lit(licaoId)}`);
    }
    await consultar(`delete from public.eventos where campanha_id = ${lit(campanhaId)}`);
    await consultar(`delete from public.eventos where titulo like ${lit(`%${selo}%`)}`);
    await consultar(`delete from public.campanha_temas where campanha_id = ${lit(campanhaId)}`);
    const sobrou = await consultar(
      `delete from public.campanhas where id = ${lit(campanhaId)} returning id`,
    );
    checar(sobrou.length === 1, "a campanha de teste foi removida no fim");
  }
}
// =====================================================================
console.log("\n--- item 3: trilha e avaliacao do colaborador ---");
{
  // Precisa de uma licao PUBLICADA na campanha ativa, com perguntas na avaliacao.
  const [ativa] = await consultar(
    `select id from public.campanhas
      where empresa_id = ${lit(empresa.id)} and status = 'ativa' limit 1`,
  );

  if (!ativa) {
    console.log("  --   sem campanha ativa; trilha nao exercitada");
  } else {
    const [tema] = await consultar(
      `select t.id from public.temas t
        join public.campanha_temas ct on ct.tema_id = t.id
       where ct.campanha_id = ${lit(ativa.id)} limit 1`,
    );
    const perguntasDoTema = await consultar(
      `select id, correta from public.perguntas
        where empresa_id = ${lit(empresa.id)} and tema_id = ${lit(tema.id)}
          and status = 'ativa' limit 2`,
    );

    const [licao] = await consultar(`
      insert into public.licoes
        (empresa_id, campanha_id, tema_id, titulo, conteudo_md, carga_minutos,
         nota_minima, obrigatoria, publicada, ordem)
      values (${lit(empresa.id)}, ${lit(ativa.id)}, ${lit(tema.id)},
              ${lit(`Licao de fluxo ${selo}`)},
              '## Conteudo de teste',
              5, 50, false, true, 99)
      returning id
    `);

    for (const [i, p] of perguntasDoTema.entries()) {
      await consultar(`
        insert into public.licao_perguntas (licao_id, pergunta_id, empresa_id, ordem)
        values (${lit(licao.id)}, ${lit(p.id)}, ${lit(empresa.id)}, ${i + 1})
      `);
    }

    // 1. A trilha lista a licao publicada.
    const trilha = await rpc("colaborador_trilha", { p_token: token });
    checar(
      trilha.corpo?.ok === true,
      "colaborador_trilha responde",
      JSON.stringify(trilha.corpo).slice(0, 120),
    );
    const naTrilha = (trilha.corpo?.licoes ?? []).find((l) => l.id === licao.id);
    checar(Boolean(naTrilha), "a licao publicada aparece na trilha");
    checar(
      naTrilha?.conteudo_concluido === false,
      `nasce como nao concluida (veio ${naTrilha?.conteudo_concluido})`,
    );

    // 2. Antes de concluir o conteudo, a avaliacao NAO vem.
    const antes = await rpc("colaborador_licao", { p_token: token, p_licao: licao.id });
    checar(antes.corpo?.ok === true, "colaborador_licao responde");
    checar(
      antes.corpo?.avaliacao === null || (antes.corpo?.avaliacao ?? []).length === 0,
      `avaliacao escondida antes de estudar (veio ${JSON.stringify(antes.corpo?.avaliacao)})`,
    );
    checar(
      typeof antes.corpo?.licao?.conteudo_md === "string",
      "o conteudo da licao vem para a tela",
    );

    // 3. Terminei de estudar: pontua uma vez.
    const pontosAntes = (
      await consultar(`
        select coalesce(sum(pontos), 0)::int as p from public.pontos_lancamentos
         where colaborador_id = ${lit(fluxo.id)} and origem = 'licao_conteudo'
      `)
    )[0].p;
    const concluir = await rpc("colaborador_concluir_conteudo", {
      p_token: token,
      p_licao: licao.id,
    });
    checar(
      concluir.corpo?.ok === true,
      "concluir conteudo aceito",
      JSON.stringify(concluir.corpo).slice(0, 120),
    );

    const deNovo = await rpc("colaborador_concluir_conteudo", {
      p_token: token,
      p_licao: licao.id,
    });
    const pontosDepois = (
      await consultar(`
        select coalesce(sum(pontos), 0)::int as p from public.pontos_lancamentos
         where colaborador_id = ${lit(fluxo.id)} and origem = 'licao_conteudo'
      `)
    )[0].p;
    checar(
      pontosDepois - pontosAntes === (concluir.corpo?.pontos ?? 0),
      `conteudo pontua exatamente o que a RPC disse (${concluir.corpo?.pontos})`,
    );
    checar(
      deNovo.corpo?.ok !== true || (deNovo.corpo?.pontos ?? 0) === 0,
      "concluir duas vezes nao pontua de novo",
    );

    // 4. Agora a avaliacao vem — e SEM gabarito.
    const depois = await rpc("colaborador_licao", { p_token: token, p_licao: licao.id });
    const avaliacao = depois.corpo?.avaliacao ?? [];
    checar(
      avaliacao.length === perguntasDoTema.length,
      `avaliacao com ${avaliacao.length} pergunta(s)`,
    );
    checar(
      avaliacao.every((p) => p.correta === undefined && p.explicacao === undefined),
      "a avaliacao nao traz gabarito",
    );

    // 5. Errar de proposito: nota 0, reprovado, sem ponto de aprovacao.
    const erradas = perguntasDoTema.map((p) => ({
      pergunta_id: p.id,
      alternativa: p.correta === 0 ? 1 : 0,
    }));
    const reprovado = await rpc("colaborador_enviar_avaliacao", {
      p_token: token,
      p_licao: licao.id,
      p_respostas: erradas,
    });
    checar(
      reprovado.corpo?.ok === true,
      "avaliacao aceita",
      JSON.stringify(reprovado.corpo).slice(0, 120),
    );
    checar(reprovado.corpo?.nota === 0, `errar tudo da nota 0 (veio ${reprovado.corpo?.nota})`);
    checar(reprovado.corpo?.aprovado === false, "reprovado com nota 0");
    checar((reprovado.corpo?.pontos ?? 0) === 0, "reprovado nao pontua");
    checar(
      (reprovado.corpo?.gabarito ?? []).every((g) => typeof g.correta === "number"),
      "o gabarito volta DEPOIS de enviar",
    );

    // 6. Acertar tudo: nota 100, aprovado, pontua aprovacao + nota maxima.
    const certas = perguntasDoTema.map((p) => ({ pergunta_id: p.id, alternativa: p.correta }));
    const aprovado = await rpc("colaborador_enviar_avaliacao", {
      p_token: token,
      p_licao: licao.id,
      p_respostas: certas,
    });
    checar(aprovado.corpo?.nota === 100, `acertar tudo da nota 100 (veio ${aprovado.corpo?.nota})`);
    checar(aprovado.corpo?.aprovado === true, "aprovado com nota 100");
    checar((aprovado.corpo?.pontos ?? 0) > 0, `aprovacao pontua (${aprovado.corpo?.pontos})`);

    const origens = await consultar(`
      select origem from public.pontos_lancamentos
       where colaborador_id = ${lit(fluxo.id)} and origem_id = ${lit(licao.id)}
    `);
    const nomes = origens.map((o) => o.origem);
    checar(nomes.includes("licao_aprovada"), `lancou licao_aprovada (${nomes.join()})`);
    checar(nomes.includes("licao_nota_maxima"), "lancou o bonus de nota 100");

    // 7. Terceira tentativa no mesmo dia: limite anti-fraude.
    const terceira = await rpc("colaborador_enviar_avaliacao", {
      p_token: token,
      p_licao: licao.id,
      p_respostas: certas,
    });
    checar(
      terceira.corpo?.ok === true || terceira.corpo?.motivo === "limite_tentativas",
      `terceira tentativa responde de forma conhecida (${terceira.corpo?.motivo ?? "ok"})`,
    );
    const quarta = await rpc("colaborador_enviar_avaliacao", {
      p_token: token,
      p_licao: licao.id,
      p_respostas: certas,
    });
    checar(
      quarta.corpo?.motivo === "limite_tentativas",
      `quarta tentativa bloqueada por limite_tentativas (veio ${quarta.corpo?.motivo})`,
    );

    // 8. Aprovacao nao pontua duas vezes.
    const aprovacoes = await consultar(`
      select count(*)::int as n from public.pontos_lancamentos
       where colaborador_id = ${lit(fluxo.id)} and origem = 'licao_aprovada'
         and origem_id = ${lit(licao.id)}
    `);
    checar(aprovacoes[0].n === 1, `licao_aprovada lancada uma vez so (foram ${aprovacoes[0].n})`);

    // 9. Limpa o que o teste criou.
    await consultar(`delete from public.respostas where licao_id = ${lit(licao.id)}`);
    await consultar(`delete from public.pontos_lancamentos where origem_id = ${lit(licao.id)}`);
    await consultar(`delete from public.progresso_licoes where licao_id = ${lit(licao.id)}`);
    await consultar(`delete from public.licao_perguntas where licao_id = ${lit(licao.id)}`);
    const removida = await consultar(
      `delete from public.licoes where id = ${lit(licao.id)} returning id`,
    );
    checar(removida.length === 1, "a licao de teste foi removida no fim");
  }
}
// =====================================================================
console.log("\n--- item 4: perfil, selos e extrato ---");
{
  const perfil = await rpc("colaborador_perfil", { p_token: token });
  checar(
    perfil.corpo?.ok === true,
    "colaborador_perfil responde",
    JSON.stringify(perfil.corpo).slice(0, 120),
  );
  checar(typeof perfil.corpo?.nome === "string", "devolve o nome");
  checar(typeof perfil.corpo?.matricula === "string", "devolve a matricula");

  const selos = perfil.corpo?.selos ?? [];
  checar(selos.length === 10, `os 10 selos do seed vem na lista (vieram ${selos.length})`);
  checar(
    selos.every((x) => typeof x.slug === "string" && typeof x.conquistado === "boolean"),
    "cada selo traz slug e conquistado",
  );
  checar(
    selos.some((x) => x.conquistado),
    "quem respondeu o quiz tem pelo menos um selo",
  );

  const extrato = perfil.corpo?.extrato ?? [];
  checar(extrato.length > 0, `o extrato tem linhas (${extrato.length})`);
  checar(
    extrato.every((l) => ["conhecimento", "relatos", "engajamento"].includes(l.pilar)),
    "todo lancamento tem um dos tres pilares",
  );

  // Toda origem que aparece no extrato precisa ter texto na tela.
  const COM_TEXTO = new Set([
    "quiz_diario",
    "licao_conteudo",
    "licao_aprovada",
    "licao_nota_maxima",
    "relato_validado",
    "relato_resolvido",
    "presenca_diaria",
    "streak_7",
    "streak_15",
    "streak_30",
    "checkin",
  ]);
  const semTexto = [...new Set(extrato.map((l) => l.origem))].filter((o) => !COM_TEXTO.has(o));
  checar(semTexto.length === 0, `toda origem do extrato tem texto (sem: ${semTexto.join()})`);

  checar(Array.isArray(perfil.corpo?.certificados), "certificados vem como lista");

  // Logout revoga a sessao: a RPC seguinte com o mesmo token tem de falhar.
  const sair = await rpc("colaborador_logout", { p_token: token });
  checar(sair.corpo?.ok === true, "logout aceito");
  const depoisDeSair = await rpc("colaborador_resumo", { p_token: token });
  checar(
    depoisDeSair.status >= 400 ||
      depoisDeSair.corpo?.ok === false ||
      String(depoisDeSair.corpo?.message ?? "").includes("sessao_invalida"),
    `token revogado deixa de funcionar (http ${depoisDeSair.status})`,
  );
}
// =====================================================================
console.log("\n--- item 5: ciclo de relatos ---");
{
  // O token do fluxo foi revogado no item 4; entra de novo para relatar.
  const relogin = await rpc("colaborador_login", {
    p_empresa_codigo: empresa.codigo,
    p_matricula: fluxo.matricula,
    p_pin: pinFluxo,
  });
  checar(relogin.corpo?.ok === true, "login de novo depois do logout");
  const tk = relogin.corpo?.token;

  // 1. Descricao curta e recusada pelo banco, nao so pela tela.
  const curta = await rpc("colaborador_criar_relato", {
    p_token: tk,
    p_categoria: "condicao_insegura",
    p_descricao: "curto",
  });
  checar(
    curta.corpo?.motivo === "descricao_curta",
    `descricao curta recusada (veio ${curta.corpo?.motivo})`,
  );

  // 2. Categoria invalida tambem.
  const categoria = await rpc("colaborador_criar_relato", {
    p_token: tk,
    p_categoria: "categoria_que_nao_existe",
    p_descricao: "piso molhado no corredor da expedicao",
  });
  checar(
    categoria.corpo?.motivo === "categoria_invalida",
    `categoria invalida recusada (veio ${categoria.corpo?.motivo})`,
  );

  // 3. Relato valido: nasce aberto e NAO pontua ainda.
  const pontosAntes = (
    await consultar(
      `select coalesce(sum(pontos), 0)::int as p from public.pontos_lancamentos
        where colaborador_id = ${lit(fluxo.id)} and pilar = 'relatos'`,
    )
  )[0].p;

  const criado = await rpc("colaborador_criar_relato", {
    p_token: tk,
    p_categoria: "condicao_insegura",
    p_descricao: `Piso molhado no corredor da expedicao ${selo}`,
  });
  checar(criado.corpo?.ok === true, "relato criado", JSON.stringify(criado.corpo).slice(0, 120));
  const relatoId = criado.corpo?.relato_id;

  const [estadoInicial] = await consultar(
    `select status, validado from public.relatos where id = ${lit(relatoId)}`,
  );
  checar(estadoInicial.status === "aberto", `nasce aberto (veio ${estadoInicial.status})`);
  checar(estadoInicial.validado === false, "nasce nao validado");

  const pontosDepoisDeCriar = (
    await consultar(
      `select coalesce(sum(pontos), 0)::int as p from public.pontos_lancamentos
        where colaborador_id = ${lit(fluxo.id)} and pilar = 'relatos'`,
    )
  )[0].p;
  checar(pontosDepoisDeCriar === pontosAntes, "criar relato NAO pontua — so depois de validado");

  // 4. O colaborador ve o proprio relato.
  const meus = await rpc("colaborador_meus_relatos", { p_token: tk });
  checar(meus.corpo?.ok === true, "colaborador_meus_relatos responde");
  const naLista = (meus.corpo?.relatos ?? []).find((r) => r.id === relatoId);
  checar(Boolean(naLista), "o relato aparece em meus relatos");
  checar(naLista?.tem_foto === false, "sem foto, tem_foto e false");

  // 5. CIPA nao pode validar (so leitura).
  const cipaValida = await rpc(
    "tecnico_validar_relato",
    { p_relato: relatoId, p_decisao: "validar", p_gravidade: "media" },
    jwtCipa,
  );
  checar(
    cipaValida.status >= 400 ||
      cipaValida.corpo?.ok === false ||
      String(cipaValida.corpo?.message ?? "").includes("acesso_negado"),
    `cipa recusada ao validar relato (http ${cipaValida.status})`,
  );

  // 6. Tecnico valida com gravidade alta: pontua.
  const validado = await rpc(
    "tecnico_validar_relato",
    {
      p_relato: relatoId,
      p_decisao: "validar",
      p_gravidade: "alta",
      p_comentario: "Validado pelo teste automatico.",
    },
    jwtAdmin,
  );
  checar(
    validado.corpo?.ok === true,
    "tecnico valida o relato",
    JSON.stringify(validado.corpo).slice(0, 140),
  );
  checar(
    (validado.corpo?.pontos ?? 0) > 0,
    `validar com gravidade alta pontua (${validado.corpo?.pontos})`,
  );

  const [depoisDeValidar] = await consultar(
    `select status, validado, gravidade from public.relatos where id = ${lit(relatoId)}`,
  );
  checar(depoisDeValidar.validado === true, "relato fica validado");
  checar(
    depoisDeValidar.gravidade === "alta",
    `gravidade gravada (veio ${depoisDeValidar.gravidade})`,
  );

  const origensDoRelato = await consultar(
    `select origem from public.pontos_lancamentos where origem_id = ${lit(relatoId)}`,
  );
  checar(
    origensDoRelato.some((o) => o.origem === "relato_validado"),
    `lancou relato_validado (${origensDoRelato.map((o) => o.origem).join()})`,
  );

  // 7. Validar duas vezes e recusado.
  const deNovo = await rpc(
    "tecnico_validar_relato",
    { p_relato: relatoId, p_decisao: "validar", p_gravidade: "baixa" },
    jwtAdmin,
  );
  checar(
    deNovo.corpo?.motivo === "ja_decidido",
    `segunda decisao recusada com ja_decidido (veio ${deNovo.corpo?.motivo})`,
  );

  // 8. Andamento ate resolvido: bonus.
  const emCorrecao = await rpc(
    "tecnico_atualizar_relato",
    { p_relato: relatoId, p_status: "em_correcao", p_comentario: "Em correcao." },
    jwtAdmin,
  );
  checar(emCorrecao.corpo?.ok === true, "andamento para em_correcao aceito");

  const resolvido = await rpc(
    "tecnico_atualizar_relato",
    { p_relato: relatoId, p_status: "resolvido", p_comentario: "Risco corrigido." },
    jwtAdmin,
  );
  checar(resolvido.corpo?.ok === true, "andamento para resolvido aceito");
  checar(
    (resolvido.corpo?.pontos ?? 0) > 0,
    `resolver da bonus ao colaborador (${resolvido.corpo?.pontos})`,
  );

  const comBonus = await consultar(
    `select origem from public.pontos_lancamentos where origem_id = ${lit(relatoId)}`,
  );
  checar(
    comBonus.some((o) => o.origem === "relato_resolvido"),
    "lancou relato_resolvido",
  );

  // 9. Status invalido e recusado.
  const invalido = await rpc(
    "tecnico_atualizar_relato",
    { p_relato: relatoId, p_status: "inventado" },
    jwtAdmin,
  );
  checar(
    invalido.corpo?.motivo === "status_invalido",
    `status invalido recusado (veio ${invalido.corpo?.motivo})`,
  );

  // 10. O historico ficou visivel para o colaborador.
  const depois = await rpc("colaborador_meus_relatos", { p_token: tk });
  const atualizado = (depois.corpo?.relatos ?? []).find((r) => r.id === relatoId);
  checar(
    atualizado?.status === "resolvido",
    `o colaborador ve resolvido (veio ${atualizado?.status})`,
  );
  checar((atualizado?.historico ?? []).length > 0, "o historico chega ao colaborador");

  // 11. Limpa.
  await consultar(`delete from public.pontos_lancamentos where origem_id = ${lit(relatoId)}`);
  await consultar(`delete from public.relato_historico where relato_id = ${lit(relatoId)}`);
  const removido = await consultar(
    `delete from public.relatos where id = ${lit(relatoId)} returning id`,
  );
  checar(removido.length === 1, "o relato de teste foi removido no fim");
}
// =====================================================================
console.log("\n--- item 6: Canal de Respeito (anonimato) ---");
{
  // 1. Descricao curta e recusada (o minimo da denuncia e 20, nao 10).
  const curta = await rpc("registrar_denuncia_assedio", {
    p_empresa_codigo: empresa.codigo,
    p_categoria: "moral",
    p_descricao: "curto demais",
  });
  checar(
    curta.corpo?.motivo === "descricao_curta",
    `descricao abaixo de 20 recusada (veio ${curta.corpo?.motivo})`,
  );

  // 2. Categoria invalida recusada.
  const cat = await rpc("registrar_denuncia_assedio", {
    p_empresa_codigo: empresa.codigo,
    p_categoria: "assedio_moral",
    p_descricao: "Descricao com tamanho suficiente para passar do minimo.",
  });
  checar(
    cat.corpo?.motivo === "categoria_invalida",
    `categoria invalida recusada (veio ${cat.corpo?.motivo})`,
  );

  // 3. Registro ANONIMO: sem token nenhum na chamada.
  const antes = (await consultar("select count(*)::int as n from public.denuncias_assedio"))[0].n;

  const nova = await rpc("registrar_denuncia_assedio", {
    p_empresa_codigo: empresa.codigo,
    p_categoria: "moral",
    p_descricao: `Denuncia de teste automatico ${selo} com texto suficiente.`,
    p_local: "Setor de demonstracao",
    p_periodo: "Ultima semana",
    p_quer_retorno: true,
  });
  checar(
    nova.corpo?.ok === true,
    "denuncia registrada sem token",
    JSON.stringify(nova.corpo).slice(0, 140),
  );

  const protocolo = nova.corpo?.protocolo;
  const senha = nova.corpo?.senha;
  checar(
    typeof protocolo === "string" && protocolo.startsWith("RS-"),
    `protocolo no formato RS-XXXXXXXX (veio ${protocolo})`,
  );
  checar(typeof senha === "string" && senha.length >= 8, "senha de pelo menos 8 caracteres");

  const depois = (await consultar("select count(*)::int as n from public.denuncias_assedio"))[0].n;
  checar(depois === antes + 1, "uma denuncia a mais no banco");

  // 4. A linha gravada nao identifica ninguem.
  const [linha] = await consultar(
    `select id, recebida_em::text as recebida, senha_hash,
            local_aproximado, periodo_aproximado, quer_retorno, status
       from public.denuncias_assedio where protocolo = ${lit(protocolo)}`,
  );
  checar(Boolean(linha), "a denuncia existe no banco");
  checar(
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(linha.recebida),
    `recebida_em e so data, sem hora (veio ${linha.recebida})`,
  );
  checar(
    linha.senha_hash !== senha && String(linha.senha_hash).length > 20,
    "a senha e guardada como hash, nao em texto",
  );
  checar(linha.status === "recebida", `nasce como recebida (veio ${linha.status})`);

  // 5. Zero pontos por denuncia, em qualquer origem.
  const pontos = await consultar(
    `select count(*)::int as n from public.pontos_lancamentos
      where origem_id = ${lit(linha.id)}`,
  );
  checar(pontos[0].n === 0, "denuncia nao lanca ponto nenhum");

  // 6. Consulta com protocolo e senha funciona; com senha errada, nao.
  const consultaOk = await rpc("consultar_denuncia", {
    p_protocolo: protocolo,
    p_senha: senha,
  });
  checar(consultaOk.corpo?.ok === true, "consulta com protocolo e senha funciona");
  checar(Array.isArray(consultaOk.corpo?.mensagens), "a consulta devolve a lista de mensagens");

  const senhaErrada = await rpc("consultar_denuncia", {
    p_protocolo: protocolo,
    p_senha: "senha-errada",
  });
  checar(
    senhaErrada.corpo?.motivo === "protocolo_ou_senha_invalidos",
    `senha errada recusada (veio ${senhaErrada.corpo?.motivo})`,
  );

  // 7. CIPA sem a flag nao ve; o comite ve.
  const cipaVe = await fetch(
    `${URL}/rest/v1/denuncias_assedio?select=protocolo&protocolo=eq.${protocolo}`,
    { headers: { apikey: ANON, Authorization: `Bearer ${jwtCipa}` } },
  );
  const linhasCipa = await cipaVe.json();
  checar(
    Array.isArray(linhasCipa) && linhasCipa.length === 0,
    "cipa sem comite_assedio nao ve a denuncia",
  );

  const comiteVe = await fetch(
    `${URL}/rest/v1/denuncias_assedio?select=protocolo&protocolo=eq.${protocolo}`,
    { headers: { apikey: ANON, Authorization: `Bearer ${jwtAdmin}` } },
  );
  const linhasComite = await comiteVe.json();
  checar(Array.isArray(linhasComite) && linhasComite.length === 1, "o comite ve a denuncia");

  // 8. Nem o comite le a senha_hash.
  const lerHash = await fetch(`${URL}/rest/v1/denuncias_assedio?select=senha_hash&limit=1`, {
    headers: { apikey: ANON, Authorization: `Bearer ${jwtAdmin}` },
  });
  checar(lerHash.status === 403, `senha_hash ilegivel pelo painel (http ${lerHash.status})`);

  // 9. O comite responde; o denunciante le a resposta pelo protocolo.
  const respondeu = await rpc(
    "comite_responder_denuncia",
    {
      p_denuncia: linha.id,
      p_mensagem: "Recebemos sua denuncia e vamos apurar.",
      p_status: "em_apuracao",
    },
    jwtAdmin,
  );
  checar(
    respondeu.corpo?.ok === true,
    "comite responde a denuncia",
    JSON.stringify(respondeu.corpo).slice(0, 140),
  );

  const comResposta = await rpc("consultar_denuncia", {
    p_protocolo: protocolo,
    p_senha: senha,
  });
  checar(
    comResposta.corpo?.status === "em_apuracao",
    `o denunciante ve o status novo (veio ${comResposta.corpo?.status})`,
  );
  checar(
    (comResposta.corpo?.mensagens ?? []).some((m) => m.autor === "comite"),
    "a mensagem do comite chega ao denunciante",
  );

  // 10. O denunciante responde de volta, ainda sem token.
  const devolta = await rpc("responder_denuncia_denunciante", {
    p_protocolo: protocolo,
    p_senha: senha,
    p_mensagem: "Obrigado, aguardo o retorno.",
  });
  checar(devolta.corpo?.ok === true, "denunciante responde sem token");

  // 11. anon NAO consegue ler a tabela direto, so pelas RPCs.
  const anonLe = await fetch(`${URL}/rest/v1/denuncias_assedio?select=descricao`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  checar(
    anonLe.status === 401 || anonLe.status === 403,
    `anon nao le denuncias_assedio direto (http ${anonLe.status})`,
  );

  // 12. Limpa.
  await consultar(`delete from public.denuncia_mensagens where denuncia_id = ${lit(linha.id)}`);
  const removida = await consultar(
    `delete from public.denuncias_assedio where id = ${lit(linha.id)} returning id`,
  );
  checar(removida.length === 1, "a denuncia de teste foi removida no fim");
}
// =====================================================================
console.log("\n--- item 7: check-in e Modo TV ---");
{
  const [ativa] = await consultar(
    `select id from public.campanhas
      where empresa_id = ${lit(empresa.id)} and status = 'ativa' limit 1`,
  );
  const [setor] = await consultar(
    `select id from public.setores where empresa_id = ${lit(empresa.id)} limit 1`,
  );

  if (!ativa) {
    console.log("  --   sem campanha ativa; Modo TV nao exercitado");
  } else {
    // Evento de DDS acontecendo AGORA, para o check-in estar na janela.
    const [evento] = await consultar(`
      insert into public.eventos
        (empresa_id, campanha_id, tipo, titulo, inicio, fim, pontos, setor_id)
      values (${lit(empresa.id)}, ${lit(ativa.id)}, 'dds',
              ${lit(`DDS de fluxo ${selo}`)},
              now() - interval '5 minutes', now() + interval '25 minutes',
              5, ${lit(setor.id)})
      returning id
    `);

    // 1. Rotacionar codigo: so o tecnico.
    const comoCipa = await rpc("tecnico_rotacionar_codigo", { p_evento: evento.id }, jwtCipa);
    checar(
      comoCipa.status >= 400 ||
        comoCipa.corpo?.ok === false ||
        String(comoCipa.corpo?.message ?? "").includes("acesso_negado"),
      `cipa recusada ao rotacionar codigo (http ${comoCipa.status})`,
    );

    const girou = await rpc("tecnico_rotacionar_codigo", { p_evento: evento.id }, jwtAdmin);
    checar(
      girou.corpo?.ok === true,
      "tecnico rotaciona o codigo",
      JSON.stringify(girou.corpo).slice(0, 120),
    );
    const codigo = girou.corpo?.codigo;
    checar(typeof codigo === "string" && codigo.length >= 4, `codigo gerado (${codigo})`);

    // 2. Codigo errado e recusado.
    const relogin = await rpc("colaborador_login", {
      p_empresa_codigo: empresa.codigo,
      p_matricula: fluxo.matricula,
      p_pin: pinFluxo,
    });
    const tk2 = relogin.corpo?.token;

    const errado = await rpc("colaborador_checkin", {
      p_token: tk2,
      p_evento: evento.id,
      p_codigo: "ZZZZZZ",
    });
    checar(
      errado.corpo?.motivo === "codigo_expirado",
      `codigo errado recusado (veio ${errado.corpo?.motivo})`,
    );

    // 3. Check-in valido pontua o que o evento manda.
    const fez = await rpc("colaborador_checkin", {
      p_token: tk2,
      p_evento: evento.id,
      p_codigo: codigo,
    });
    checar(fez.corpo?.ok === true, "check-in aceito", JSON.stringify(fez.corpo).slice(0, 140));
    checar(fez.corpo?.pontos === 5, `check-in de DDS vale 5 (veio ${fez.corpo?.pontos})`);

    const origem = await consultar(
      `select origem from public.pontos_lancamentos
        where colaborador_id = ${lit(fluxo.id)} and origem_id = ${lit(evento.id)}`,
    );
    checar(
      origem.some((o) => o.origem === "checkin"),
      `lancou checkin (${origem.map((o) => o.origem).join()})`,
    );

    // 4. Check-in duas vezes no mesmo evento e recusado.
    const deNovo = await rpc("colaborador_checkin", {
      p_token: tk2,
      p_evento: evento.id,
      p_codigo: codigo,
    });
    checar(
      deNovo.corpo?.motivo === "ja_fez_checkin",
      `segundo check-in recusado (veio ${deNovo.corpo?.motivo})`,
    );

    const quantos = await consultar(
      `select count(*)::int as n from public.checkins where evento_id = ${lit(evento.id)}`,
    );
    checar(quantos[0].n === 1, `so um check-in gravado (foram ${quantos[0].n})`);

    // 5. Salvar a sessao do Modo TV: pontos vao para o SETOR.
    const perguntas = await consultar(
      `select id, correta from public.perguntas
        where empresa_id = ${lit(empresa.id)} and status = 'ativa' limit 3`,
    );

    const salvou = await rpc(
      "tecnico_salvar_quiz_tv",
      {
        p_evento: evento.id,
        p_modo: "classico",
        p_duracao_ms: 180000,
        p_equipes: [{ setor_id: setor.id, pontos: 20 }],
        p_respostas: perguntas.map((p, i) => ({
          setor_id: setor.id,
          pergunta_id: p.id,
          alternativa: i === 0 ? p.correta : (p.correta + 1) % 2,
          tempo_ms: 5000,
          ordem: i + 1,
        })),
      },
      jwtAdmin,
    );
    checar(
      salvou.corpo?.ok === true,
      "sessao do Modo TV salva",
      JSON.stringify(salvou.corpo).slice(0, 140),
    );

    const [depoisDeSalvar] = await consultar(
      `select status from public.eventos where id = ${lit(evento.id)}`,
    );
    checar(
      depoisDeSalvar.status === "realizado",
      `o evento vira realizado (veio ${depoisDeSalvar.status})`,
    );

    // 6. Modo invalido e recusado.
    const modo = await rpc(
      "tecnico_salvar_quiz_tv",
      {
        p_evento: evento.id,
        p_modo: "inventado",
        p_duracao_ms: 1000,
        p_equipes: [],
        p_respostas: [],
      },
      jwtAdmin,
    );
    checar(
      modo.corpo?.motivo === "modo_invalido" || modo.corpo?.motivo === "evento_ja_tem_sessao",
      `modo invalido recusado (veio ${modo.corpo?.motivo})`,
    );

    // 7. Dois quizzes no mesmo evento: recusado.
    const segunda = await rpc(
      "tecnico_salvar_quiz_tv",
      {
        p_evento: evento.id,
        p_modo: "classico",
        p_duracao_ms: 1000,
        p_equipes: [{ setor_id: setor.id, pontos: 10 }],
        p_respostas: [],
      },
      jwtAdmin,
    );
    checar(
      segunda.corpo?.motivo === "evento_ja_tem_sessao",
      `segunda sessao recusada (veio ${segunda.corpo?.motivo})`,
    );

    // 8. Limpa, em ordem de dependencia.
    const [sessao] = await consultar(
      `select id from public.quiz_tv_sessoes where evento_id = ${lit(evento.id)}`,
    );
    if (sessao) {
      await consultar(`delete from public.quiz_tv_respostas where sessao_id = ${lit(sessao.id)}`);
      await consultar(`delete from public.quiz_tv_equipes where sessao_id = ${lit(sessao.id)}`);
      await consultar(`delete from public.quiz_tv_sessoes where id = ${lit(sessao.id)}`);
    }
    await consultar(`delete from public.pontos_lancamentos where origem_id = ${lit(evento.id)}`);
    await consultar(`delete from public.checkins where evento_id = ${lit(evento.id)}`);
    const removido = await consultar(
      `delete from public.eventos where id = ${lit(evento.id)} returning id`,
    );
    checar(removido.length === 1, "o evento de teste foi removido no fim");
  }
}
// =====================================================================
console.log("\n--- item 8: ranking e encerramento ---");
{
  // O ranking e o encerramento sao exercitados numa campanha PROPRIA do teste,
  // para nao encerrar a campanha de demonstracao que o seed deixou ativa.
  const [setor] = await consultar(
    `select id from public.setores where empresa_id = ${lit(empresa.id)} limit 1`,
  );
  const [tema] = await consultar(
    "select id from public.temas where empresa_id is null order by slug limit 1",
  );

  // 1. As views de ranking respondem para a campanha ativa.
  const [ativa] = await consultar(
    `select id from public.campanhas
      where empresa_id = ${lit(empresa.id)} and status = 'ativa' limit 1`,
  );

  if (ativa) {
    const ind = await fetch(
      `${URL}/rest/v1/v_ranking_individual?select=colaborador_id,total,conhecimento,relatos,engajamento&campanha_id=eq.${ativa.id}`,
      { headers: { apikey: ANON, Authorization: `Bearer ${jwtAdmin}` } },
    );
    const linhasInd = await ind.json();
    checar(
      ind.status === 200 && Array.isArray(linhasInd),
      `v_ranking_individual responde ao painel (http ${ind.status})`,
    );
    checar(
      linhasInd.every((l) => l.total === l.conhecimento + l.relatos + l.engajamento),
      "o total do ranking e a soma dos tres pilares",
    );

    const set = await fetch(
      `${URL}/rest/v1/v_ranking_setor?select=setor_id,total,pontos_individuais,pontos_quiz_tv&campanha_id=eq.${ativa.id}`,
      { headers: { apikey: ANON, Authorization: `Bearer ${jwtAdmin}` } },
    );
    checar(set.status === 200, `v_ranking_setor responde ao painel (http ${set.status})`);

    // anon nao le as views (sao security_invoker sobre tabelas sem grant).
    const anonView = await fetch(`${URL}/rest/v1/v_ranking_individual?select=total&limit=1`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    });
    checar(
      anonView.status === 401 || anonView.status === 403,
      `anon nao le v_ranking_individual (http ${anonView.status})`,
    );
  }

  // 2. Campanha propria, encerrada de verdade.
  //    Encerra a de demonstracao primeiro seria destrutivo, entao o teste cria
  //    a sua, encerra a ativa, testa, e devolve o estado no fim.
  const [daDemo] = await consultar(
    `select id, status from public.campanhas
      where empresa_id = ${lit(empresa.id)} and status = 'ativa' limit 1`,
  );

  if (!daDemo) {
    console.log("  --   sem campanha ativa; encerramento nao exercitado");
  } else {
    // Suspende a de demonstracao para poder ativar a de teste.
    await consultar(`update public.campanhas set status = 'rascunho' where id = ${lit(daDemo.id)}`);

    const [teste] = await consultar(`
      insert into public.campanhas
        (empresa_id, nome, inicio, fim, status, perguntas_por_dia, ranking_visivel)
      values (${lit(empresa.id)}, ${lit(`Campanha de encerramento ${selo}`)},
              current_date - 1, current_date + 1, 'rascunho', 5, true)
      returning id
    `);
    await consultar(`
      insert into public.campanha_temas (campanha_id, tema_id, empresa_id)
      values (${lit(teste.id)}, ${lit(tema.id)}, ${lit(empresa.id)})
    `);

    const ativou = await rpc("tecnico_ativar_campanha", { p_campanha: teste.id }, jwtAdmin);
    checar(
      ativou.corpo?.ok === true,
      "campanha de teste ativada",
      JSON.stringify(ativou.corpo).slice(0, 140),
    );

    // Da pontos a um colaborador, para o ranking ter conteudo.
    await consultar(`
      insert into public.pontos_lancamentos
        (empresa_id, campanha_id, colaborador_id, setor_id, pilar, origem, origem_id, pontos, dia)
      values (${lit(empresa.id)}, ${lit(teste.id)}, ${lit(fluxo.id)}, ${lit(setor.id)},
              'conhecimento', 'quiz_diario', gen_random_uuid(), 40, current_date)
    `);

    // 3. CIPA nao encerra.
    const cipaEncerra = await rpc(
      "tecnico_encerrar_campanha",
      { p_campanha: teste.id, p_top_n: 3 },
      jwtCipa,
    );
    checar(
      cipaEncerra.status >= 400 ||
        cipaEncerra.corpo?.ok === false ||
        String(cipaEncerra.corpo?.message ?? "").includes("acesso_negado"),
      `cipa recusada ao encerrar campanha (http ${cipaEncerra.status})`,
    );

    // 4. Encerrar: congela ranking, concede selos, emite certificados.
    const encerrou = await rpc(
      "tecnico_encerrar_campanha",
      { p_campanha: teste.id, p_top_n: 3 },
      jwtAdmin,
    );
    checar(
      encerrou.corpo?.ok === true,
      "campanha encerrada",
      JSON.stringify(encerrou.corpo).slice(0, 140),
    );

    const [depois] = await consultar(
      `select status, encerrada_em from public.campanhas where id = ${lit(teste.id)}`,
    );
    checar(depois.status === "encerrada", `status vira encerrada (veio ${depois.status})`);
    checar(Boolean(depois.encerrada_em), "encerrada_em foi gravado");

    const congelados = await consultar(
      `select tipo, posicao, pontos from public.campanha_resultados
        where campanha_id = ${lit(teste.id)} order by posicao`,
    );
    checar(
      congelados.length > 0,
      `o ranking foi congelado em campanha_resultados (${congelados.length} linha(s))`,
    );

    const selosFinais = await consultar(
      `select s.slug from public.selos_conquistados sc
         join public.selos s on s.id = sc.selo_id
        where sc.campanha_id = ${lit(teste.id)}`,
    );
    checar(
      selosFinais.length > 0,
      `selos finais concedidos (${selosFinais.map((x) => x.slug).join()})`,
    );

    const certificados = await consultar(
      `select tipo, codigo from public.certificados where campanha_id = ${lit(teste.id)}`,
    );
    checar(certificados.length > 0, `certificados emitidos (${certificados.length})`);
    checar(
      certificados.every((c) => /^TIME-/.test(c.codigo)),
      `codigo no formato TIME-XXXXXXXXXX (${certificados.map((c) => c.codigo).join()})`,
    );

    // 5. Encerrar duas vezes e recusado.
    const deNovo = await rpc(
      "tecnico_encerrar_campanha",
      { p_campanha: teste.id, p_top_n: 3 },
      jwtAdmin,
    );
    checar(
      deNovo.corpo?.ok === false,
      `segundo encerramento recusado (veio ${deNovo.corpo?.motivo})`,
    );

    // 6. O certificado e verificavel publicamente, sem login.
    if (certificados[0]) {
      const verifica = await rpc("verificar_certificado", {
        p_codigo: certificados[0].codigo,
      });
      checar(
        verifica.corpo?.ok === true,
        "certificado verificavel sem login",
        JSON.stringify(verifica.corpo).slice(0, 140),
      );

      const inventado = await rpc("verificar_certificado", { p_codigo: "TIME-NAOEXISTE" });
      checar(
        inventado.corpo?.motivo === "certificado_nao_encontrado",
        `codigo inventado recusado (veio ${inventado.corpo?.motivo})`,
      );
    }

    // 7. Limpa e devolve a campanha de demonstracao ao ar.
    await consultar(`delete from public.certificados where campanha_id = ${lit(teste.id)}`);
    await consultar(`delete from public.selos_conquistados where campanha_id = ${lit(teste.id)}`);
    await consultar(`delete from public.campanha_resultados where campanha_id = ${lit(teste.id)}`);
    await consultar(`delete from public.pontos_lancamentos where campanha_id = ${lit(teste.id)}`);
    await consultar(`delete from public.campanha_temas where campanha_id = ${lit(teste.id)}`);
    await consultar(`delete from public.campanhas where id = ${lit(teste.id)}`);
    await consultar(`update public.campanhas set status = 'ativa' where id = ${lit(daDemo.id)}`);

    const [voltou] = await consultar(
      `select status from public.campanhas where id = ${lit(daDemo.id)}`,
    );
    checar(voltou.status === "ativa", "a campanha de demonstracao voltou a ativa no fim");
  }
}
// =====================================================================
console.log("\n--- item 13: Modo TV Duelo e Eliminacao ---");
{
  // Dois setores: o Duelo e a Eliminacao pontuam POR EQUIPE, e o servidor
  // recalcula acertos/erros pelo gabarito, nunca pelo que a tela mandou.
  // O piloto pode ter um unico setor: cria um descartavel para o Duelo ter
  // com quem disputar, e apaga no fim.
  const NOME_DO_SETOR_DE_TESTE = `Setor de teste TIME ${Date.now()}`;
  const [setorDescartavel] = await consultar(
    `insert into public.setores (empresa_id, nome, cor)
     values (${lit(empresa.id)}, ${lit(NOME_DO_SETOR_DE_TESTE)}, '#2E86C1')
     returning id`,
  );
  const setores = await consultar(
    `select id, nome from public.setores where empresa_id = ${lit(empresa.id)}
      order by (id = ${lit(setorDescartavel.id)}), nome limit 2`,
  );
  const perguntas = await consultar(
    `select id, correta from public.perguntas
      where (empresa_id = ${lit(empresa.id)} or empresa_id is null) and status = 'ativa' limit 4`,
  );
  const [ativa] = await consultar(
    `select id from public.campanhas where empresa_id = ${lit(empresa.id)} and status = 'ativa'`,
  );

  if (setores.length < 2 || perguntas.length < 4) {
    checar(
      false,
      `faltou base para o teste (setores ${setores.length}, perguntas ${perguntas.length})`,
    );
  } else {
    for (const modo of ["duelo", "eliminacao"]) {
      const [evento] = await consultar(
        `insert into public.eventos (empresa_id, campanha_id, tipo, titulo, inicio, fim, pontos)
         values (${lit(empresa.id)}, ${lit(ativa?.id ?? null)}, 'dds', ${lit(`Teste ${modo}`)},
                 now(), now() + interval '1 hour', 5)
         returning id`,
      );

      // Setor A acerta as duas primeiras; setor B erra as duas ultimas.
      const respostas = [
        ...perguntas.slice(0, 2).map((p, i) => ({
          setor_id: setores[0].id,
          pergunta_id: p.id,
          alternativa: p.correta,
          tempo_ms: 4000,
          ordem: i + 1,
        })),
        ...perguntas.slice(2, 4).map((p, i) => ({
          setor_id: setores[1].id,
          pergunta_id: p.id,
          alternativa: (p.correta + 1) % 2,
          tempo_ms: 6000,
          ordem: i + 3,
        })),
      ];

      const salvou = await rpc(
        "tecnico_salvar_quiz_tv",
        {
          p_evento: evento.id,
          p_modo: modo,
          p_duracao_ms: 240000,
          p_equipes: [
            { setor_id: setores[0].id, pontos: 15 },
            // Valor absurdo de proposito: o servidor tem um teto.
            { setor_id: setores[1].id, pontos: 999999 },
          ],
          p_respostas: respostas,
        },
        jwtAdmin,
      );
      checar(
        salvou.corpo?.ok === true,
        `sessao de ${modo} salva`,
        JSON.stringify(salvou.corpo).slice(0, 140),
      );

      const [sessao] = await consultar(
        `select id, modo from public.quiz_tv_sessoes where evento_id = ${lit(evento.id)}`,
      );
      checar(sessao?.modo === modo, `a sessao guardou o modo ${modo} (veio ${sessao?.modo})`);

      const equipes = await consultar(
        `select setor_id, pontos, acertos, erros from public.quiz_tv_equipes
          where sessao_id = ${lit(sessao.id)} order by setor_id`,
      );
      checar(equipes.length === 2, `${modo}: duas equipes gravadas (foram ${equipes.length})`);

      const a = equipes.find((e) => e.setor_id === setores[0].id);
      const b = equipes.find((e) => e.setor_id === setores[1].id);
      checar(
        a?.acertos === 2 && a?.erros === 0,
        `${modo}: acertos recalculados pelo gabarito (${a?.acertos}/${a?.erros})`,
      );
      checar(
        b?.acertos === 0 && b?.erros === 2,
        `${modo}: erros recalculados pelo gabarito (${b?.acertos}/${b?.erros})`,
      );
      checar(
        a?.pontos === 15,
        `${modo}: os pontos da equipe vieram da partida (veio ${a?.pontos})`,
      );

      // Teto do servidor: respostas * 10 + 100 (aqui 4 * 10 + 100 = 140).
      const teto = respostas.length * 10 + 100;
      checar(
        b?.pontos === teto,
        `${modo}: pontuacao absurda limitada ao teto ${teto} (veio ${b?.pontos})`,
      );

      if (ativa) {
        const lancamentos = await consultar(
          `select setor_id, pontos, colaborador_id from public.pontos_lancamentos
            where origem_id = ${lit(sessao.id)} and origem = 'quiz_tv'`,
        );
        checar(
          lancamentos.length === 2,
          `${modo}: dois lancamentos de quiz_tv (foram ${lancamentos.length})`,
        );
        checar(
          lancamentos.every((l) => l.colaborador_id === null),
          `${modo}: ponto de quiz_tv e do SETOR, nunca de uma pessoa`,
        );
      }

      // Limpa em ordem de dependencia.
      await consultar(`delete from public.pontos_lancamentos where origem_id = ${lit(sessao.id)}`);
      await consultar(`delete from public.quiz_tv_respostas where sessao_id = ${lit(sessao.id)}`);
      await consultar(`delete from public.quiz_tv_equipes where sessao_id = ${lit(sessao.id)}`);
      await consultar(`delete from public.quiz_tv_sessoes where id = ${lit(sessao.id)}`);
      const removido = await consultar(
        `delete from public.eventos where id = ${lit(evento.id)} returning id`,
      );
      checar(removido.length === 1, `${modo}: o evento de teste foi removido no fim`);
    }
  }

  const setorRemovido = await consultar(
    `delete from public.setores where id = ${lit(setorDescartavel.id)} returning id`,
  );
  checar(setorRemovido.length === 1, "o setor de teste foi removido no fim");
}
// =====================================================================
console.log("\n--- item 14: PIN fixo, reemissao e autocadastro ---");
{
  const L = (jwt) => ({ apikey: ANON, Authorization: `Bearer ${jwt}` });

  // ---- ver o PIN ----
  const ver = await rpc("tecnico_ver_pin", { p_colaborador: fluxo.id }, jwtAdmin);
  checar(
    ver.corpo?.ok === true && ver.corpo?.pin === pinFluxo,
    "admin ve o PIN fixo do colaborador",
    JSON.stringify(ver.corpo).slice(0, 100),
  );
  const verAnon = await rpc("tecnico_ver_pin", { p_colaborador: fluxo.id });
  checar(
    verAnon.status >= 400 && !verAnon.corpo?.pin,
    `anon recusado em tecnico_ver_pin (http ${verAnon.status})`,
  );
  const verCipa = await rpc("tecnico_ver_pin", { p_colaborador: fluxo.id }, jwtCipa);
  checar(verCipa.status >= 400 && !verCipa.corpo?.pin, "CIPA NAO ve o PIN (so admin e tecnico)");

  // ---- reemitir (so admin) ----
  const reemCipa = await rpc("tecnico_reemitir_pin", { p_colaborador: cobaia.id }, jwtCipa);
  checar(reemCipa.status >= 400 && !reemCipa.corpo?.pin, "CIPA nao reemite PIN");

  // A cobaia foi bloqueada mais acima (5 PINs errados): reemitir tambem desbloqueia.
  const reem = await rpc("tecnico_reemitir_pin", { p_colaborador: cobaia.id }, jwtAdmin);
  const pinNovoCobaia = reem.corpo?.pin;
  checar(
    reem.corpo?.ok === true && /^\d{6}$/.test(pinNovoCobaia ?? ""),
    "admin reemite o PIN",
    JSON.stringify(reem.corpo).slice(0, 100),
  );
  checar(pinNovoCobaia !== pinCobaia, "o PIN reemitido e outro numero");
  const antigo = await rpc("colaborador_login", {
    p_empresa_codigo: empresa.codigo,
    p_matricula: cobaia.matricula,
    p_pin: pinCobaia,
  });
  checar(antigo.corpo?.ok === false, "o PIN antigo deixa de valer");
  const entrou = await rpc("colaborador_login", {
    p_empresa_codigo: empresa.codigo,
    p_matricula: cobaia.matricula,
    p_pin: pinNovoCobaia,
  });
  checar(entrou.corpo?.ok === true, "o PIN novo entra (e o bloqueio foi zerado)");

  // Unicidade: nenhum PIN repetido dentro da empresa.
  const [dup] = await consultar(`
    select count(*)::int as repetidos from (
      select pin_fixo from public.colaboradores
       where empresa_id = ${lit(empresa.id)} and pin_fixo is not null
       group by pin_fixo having count(*) > 1) x
  `);
  checar(dup.repetidos === 0, `nenhum PIN repetido na empresa (repetidos: ${dup.repetidos})`);

  // ---- auditoria ----
  const [log] = await consultar(`
    select count(*) filter (where acao = 'ver')::int as vistas,
           count(*) filter (where acao = 'reemitir')::int as reemitidas
      from public.acessos_pin
     where colaborador_id in (${lit(fluxo.id)}, ${lit(cobaia.id)})
  `);
  checar(log.vistas >= 3, `consultas de PIN ficam registradas (${log.vistas})`);
  checar(log.reemitidas === 1, `reemissao fica registrada (${log.reemitidas})`);
  const logAdmin = await fetch(`${URL}/rest/v1/acessos_pin?select=id&limit=5`, {
    headers: L(jwtAdmin),
  });
  checar(logAdmin.status === 200, `admin le o registro de acessos (http ${logAdmin.status})`);
  const logCipa = await (
    await fetch(`${URL}/rest/v1/acessos_pin?select=id&limit=5`, { headers: L(jwtCipa) })
  ).json();
  checar(Array.isArray(logCipa) && logCipa.length === 0, "CIPA nao ve o registro de acessos");

  // ---- autocadastro ----
  const pub = await rpc("publico_setores_da_empresa", { p_empresa_codigo: empresa.codigo });
  checar(
    pub.corpo?.ok === true && pub.corpo?.setores?.length > 0,
    "anon lista os setores da empresa para o cadastro",
  );
  const setorId = pub.corpo?.setores?.[0]?.id;
  const matCad = `ac${selo}`;
  const emailCad = `${matCad}@empresa-teste.invalid`;
  const pedir = (extra = {}) =>
    rpc("publico_solicitar_cadastro", {
      p_empresa_codigo: empresa.codigo,
      p_nome: "Pessoa de Teste Cadastro",
      p_matricula: matCad,
      p_email: emailCad,
      p_setor: setorId,
      ...extra,
    });

  const ruim = await pedir({ p_email: "isto-nao-e-email" });
  checar(ruim.corpo?.motivo === "email_invalido", "e-mail invalido e recusado");

  // Dominio da empresa: configura, testa e RESTAURA o config original.
  const [{ config: configOriginal }] = await consultar(
    `select config from public.empresas where id = ${lit(empresa.id)}`,
  );
  try {
    await consultar(`
      update public.empresas
         set config = config || '{"dominios_email":["empresa-certa.com.br"]}'::jsonb
       where id = ${lit(empresa.id)}`);
    const fora = await pedir();
    checar(
      fora.corpo?.motivo === "email_fora_do_dominio",
      "e-mail fora do dominio da empresa e recusado",
    );
  } finally {
    await consultar(
      `update public.empresas set config = ${lit(JSON.stringify(configOriginal))}::jsonb where id = ${lit(empresa.id)}`,
    );
  }

  const pedido = await pedir();
  checar(pedido.corpo?.ok === true, "pedido de cadastro aceito", JSON.stringify(pedido.corpo));
  const pend = await consultar(`
    select id, status from public.solicitacoes_cadastro
     where empresa_id = ${lit(empresa.id)} and matricula = ${lit(matCad)}`);
  checar(pend.length === 1 && pend[0].status === "pendente", "fica PENDENTE");

  const repetido = await pedir();
  const [{ n: copias }] = await consultar(`
    select count(*)::int as n from public.solicitacoes_cadastro
     where empresa_id = ${lit(empresa.id)} and matricula = ${lit(matCad)}`);
  checar(
    repetido.corpo?.ok === true && copias === 1,
    `pedido repetido responde igual e nao duplica (copias: ${copias})`,
  );

  const [{ n: jaColab }] = await consultar(`
    select count(*)::int as n from public.colaboradores
     where empresa_id = ${lit(empresa.id)} and matricula = ${lit(matCad)}`);
  checar(jaColab === 0, "pendente ainda NAO e colaborador (sem acesso)");

  const anonLe = await fetch(`${URL}/rest/v1/solicitacoes_cadastro?select=*&limit=1`, {
    headers: L(ANON),
  });
  checar(
    anonLe.status === 401 || anonLe.status === 403,
    `anon nao le as solicitacoes (http ${anonLe.status})`,
  );

  const lista = await fetch(
    `${URL}/rest/v1/solicitacoes_cadastro?select=id,status&matricula=eq.${matCad}`,
    { headers: L(jwtCipa) },
  );
  const linhasSol = await lista.json();
  checar(lista.status === 200 && linhasSol.length === 1, "CIPA ve a solicitacao pendente");

  // CIPA aprova (admin, tecnico e CIPA podem).
  const aprova = await rpc(
    "tecnico_decidir_solicitacao",
    { p_id: pend[0].id, p_aprovar: true },
    jwtCipa,
  );
  checar(
    aprova.corpo?.ok === true && !!aprova.corpo?.colaborador_id,
    "CIPA aprova a solicitacao",
    JSON.stringify(aprova.corpo).slice(0, 100),
  );
  const [aprovado] = await consultar(`
    select id, pin_fixo, email, ativo, setor_id from public.colaboradores
     where id = ${lit(aprova.corpo?.colaborador_id)}`);
  checar(
    /^\d{6}$/.test(aprovado?.pin_fixo ?? "") &&
      aprovado?.email === emailCad &&
      aprovado?.ativo === true,
    "aprovado ja nasce ativo, com PIN fixo e com o e-mail",
  );
  checar(aprovado?.setor_id === setorId, "o setor do pedido foi para o colaborador");

  const verNovo = await rpc("tecnico_ver_pin", { p_colaborador: aprovado.id }, jwtAdmin);
  const loginNovo = await rpc("colaborador_login", {
    p_empresa_codigo: empresa.codigo,
    p_matricula: matCad,
    p_pin: verNovo.corpo?.pin,
  });
  checar(loginNovo.corpo?.ok === true, "o aprovado entra com o PIN que o gestor viu");

  const denovo = await rpc(
    "tecnico_decidir_solicitacao",
    { p_id: pend[0].id, p_aprovar: true },
    jwtAdmin,
  );
  checar(denovo.corpo?.motivo === "ja_decidida", "decidir duas vezes devolve ja_decidida");

  // Recusa guarda o motivo e nao cria colaborador.
  const matRec = `${matCad}r`;
  await rpc("publico_solicitar_cadastro", {
    p_empresa_codigo: empresa.codigo,
    p_nome: "Pessoa Recusada Teste",
    p_matricula: matRec,
    p_email: `${matRec}@empresa-teste.invalid`,
    p_setor: setorId,
  });
  const [pedRec] = await consultar(`
    select id from public.solicitacoes_cadastro
     where empresa_id = ${lit(empresa.id)} and matricula = ${lit(matRec)}`);
  const recusa = await rpc(
    "tecnico_decidir_solicitacao",
    { p_id: pedRec.id, p_aprovar: false, p_motivo: "Nao consta no quadro" },
    jwtAdmin,
  );
  const [recusada] = await consultar(`
    select status, motivo from public.solicitacoes_cadastro where id = ${lit(pedRec.id)}`);
  checar(
    recusa.corpo?.ok === true &&
      recusada.status === "recusada" &&
      recusada.motivo === "Nao consta no quadro",
    "recusa guarda o motivo",
  );
  const [{ n: criouRec }] = await consultar(`
    select count(*)::int as n from public.colaboradores
     where empresa_id = ${lit(empresa.id)} and matricula = ${lit(matRec)}`);
  checar(criouRec === 0, "recusada NAO vira colaborador");

  // Reemitir derruba a sessao aberta: o token antigo deixa de valer.
  await rpc("tecnico_reemitir_pin", { p_colaborador: fluxo.id }, jwtAdmin);
  const aposReemitir = await rpc("colaborador_resumo", { p_token: token });
  checar(
    JSON.stringify(aposReemitir.corpo).includes("sessao_invalida"),
    "reemitir o PIN derruba a sessao aberta (sessao_invalida)",
  );

  // Limpa o que ESTE bloco criou (solicitacoes e o colaborador aprovado).
  await consultar(`
    delete from public.solicitacoes_cadastro
     where empresa_id = ${lit(empresa.id)} and matricula in (${lit(matCad)}, ${lit(matRec)})`);
  const apagado = await consultar(
    `delete from public.colaboradores where id = ${lit(aprovado.id)} returning id`,
  );
  checar(apagado.length === 1, "o colaborador aprovado do teste foi removido no fim");
}
// =====================================================================
console.log(
  falhas === 0
    ? `\nFluxo: ${total} verificações passaram.`
    : `\nFluxo: ${falhas} de ${total} verificações FALHARAM.`,
);
process.exit(falhas === 0 ? 0 : 1);
