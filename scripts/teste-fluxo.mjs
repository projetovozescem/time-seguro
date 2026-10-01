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
console.log(
  falhas === 0
    ? `\nFluxo: ${total} verificações passaram.`
    : `\nFluxo: ${falhas} de ${total} verificações FALHARAM.`,
);
process.exit(falhas === 0 ? 0 : 1);
