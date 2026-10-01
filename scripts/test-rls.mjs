// Gate de segurança do banco do T.I.M.E. Seguro.
//
// Confere, no projeto de DESENVOLVIMENTO, que o modelo de acesso de
// docs/TIME_03 §4/§8 e da migration 0005_time_rls_grants continua de pé:
//   • anon não tem privilégio NENHUM em objeto de public — nem tabela, nem
//     view, nem sequence, nem grant por coluna. Só EXECUTE nas RPCs;
//   • o hash do PIN e a senha da denúncia são ilegíveis pelo painel;
//   • toda função de escrita é SECURITY DEFINER com search_path fixo;
//   • as views aplicam o RLS (security_invoker);
//   • a pontuação é idempotente por índice único.
//
// Lê o catálogo do Postgres em 7 consultas e afirma em JavaScript. A versão
// anterior fazia uma chamada HTTP por verificação (382 no total) e levava
// minutos — um gate que ninguém espera rodar não protege nada.
//
// Só leitura: não escreve nem apaga nada.
import { consultar } from "./_db.mjs";

/** As 30 tabelas que a 0005 §1 obriga a ter RLS. */
const TABELAS = [
  "empresas",
  "perfis_tecnicos",
  "setores",
  "locais",
  "colaboradores",
  "sessoes_colaborador",
  "consentimentos_lgpd",
  "temas",
  "perguntas",
  "campanhas",
  "campanha_temas",
  "licoes",
  "licao_perguntas",
  "progresso_licoes",
  "respostas",
  "atividade_diaria",
  "eventos",
  "checkins",
  "quiz_tv_sessoes",
  "quiz_tv_equipes",
  "quiz_tv_respostas",
  "relatos",
  "relato_historico",
  "denuncias_assedio",
  "denuncia_mensagens",
  "pontos_lancamentos",
  "selos",
  "selos_conquistados",
  "campanha_resultados",
  "certificados",
];

/** Assinaturas liberadas para `anon` na 0005 §10 (app do colaborador + públicas). */
const RPCS_ANON = [
  "public.empresa_publica(text)",
  "public.colaborador_login(text, text, text)",
  "public.colaborador_logout(text)",
  "public.colaborador_trocar_pin(text, text, text)",
  "public.colaborador_termo_lgpd(text)",
  "public.colaborador_aceitar_lgpd(text)",
  "public.colaborador_resumo(text)",
  "public.colaborador_perguntas_do_dia(text)",
  "public.colaborador_responder_pergunta(text, uuid, int, int)",
  "public.colaborador_trilha(text)",
  "public.colaborador_licao(text, uuid)",
  "public.colaborador_concluir_conteudo(text, uuid)",
  "public.colaborador_enviar_avaliacao(text, uuid, jsonb)",
  "public.colaborador_checkin(text, uuid, text)",
  "public.colaborador_criar_relato(text, text, text, uuid, uuid)",
  "public.colaborador_meus_relatos(text)",
  "public.colaborador_local(text, uuid)",
  "public.colaborador_ranking(text)",
  "public.colaborador_perfil(text)",
  "public.registrar_denuncia_assedio(text, text, text, text, text, boolean)",
  "public.consultar_denuncia(text, text)",
  "public.responder_denuncia_denunciante(text, text, text)",
  "public.verificar_certificado(text)",
];

/** Assinaturas do painel: `authenticated` executa, `anon` NÃO. */
const RPCS_SO_PAINEL = [
  "public.tecnico_gerar_pins(uuid[])",
  "public.tecnico_importar_colaboradores(jsonb)",
  "public.tecnico_desbloquear_colaborador(uuid)",
  "public.tecnico_anonimizar_colaborador(uuid)",
  "public.tecnico_validar_relato(uuid, text, text, text, uuid)",
  "public.tecnico_atualizar_relato(uuid, text, text, boolean)",
  "public.tecnico_rotacionar_codigo(uuid)",
  "public.tecnico_salvar_quiz_tv(uuid, text, int, jsonb, jsonb)",
  "public.tecnico_ativar_campanha(uuid)",
  "public.tecnico_encerrar_campanha(uuid, int)",
  "public.comite_responder_denuncia(uuid, text, text)",
];

/** Só a Edge Function (service_role) autoriza upload de foto de relato. */
const RPCS_SO_SERVICE_ROLE = ["public._relato_caminho_foto(text, uuid)"];

/** Colunas que o painel pode ler em `colaboradores` (0005 §5). */
const COLUNAS_COLABORADOR_LEGIVEIS = [
  "id",
  "empresa_id",
  "setor_id",
  "matricula",
  "nome",
  "turno",
  "pin_provisorio",
  "ativo",
  "lgpd_aceite_versao",
  "lgpd_aceite_em",
  "tentativas_falhas",
  "bloqueado_ate",
  "anonimizado",
  "criado_em",
];

/** Segredos que nem `anon` nem `authenticated` podem ler. */
const COLUNAS_SECRETAS = [
  ["colaboradores", "pin_hash"],
  ["denuncias_assedio", "senha_hash"],
];

const VIEWS = ["v_ranking_individual", "v_ranking_setor", "v_lacunas", "v_desempenho_pergunta"];

/** Funções de escrita: precisam ser SECURITY DEFINER com search_path fixo. */
const PREFIXOS_DE_ESCRITA = ["colaborador\\_%", "tecnico\\_%", "comite\\_%"];
const FUNCOES_DE_ESCRITA_EXTRA = [
  "registrar_denuncia_assedio",
  "consultar_denuncia",
  "responder_denuncia_denunciante",
  "_lancar_pontos",
  "_relato_caminho_foto",
];

const falhas = [];
let total = 0;

function afirmar(condicao, descricao) {
  total++;
  if (!condicao) falhas.push(descricao);
}

/** Literal SQL seguro para montar as consultas de catálogo. */
function lit(v) {
  return "'" + String(v).replace(/'/g, "''") + "'";
}

function lista(valores) {
  return valores.map(lit).join(", ");
}

try {
  // ------------------------------------------------------------------
  // 1. RLS ligada em todas as tabelas de public
  // ------------------------------------------------------------------
  const rls = await consultar(`
    select c.relname as tabela, c.relrowsecurity as ligada
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r','p')
  `);
  const porTabela = new Map(rls.map((r) => [r.tabela, r.ligada]));

  for (const t of TABELAS) {
    if (!porTabela.has(t)) {
      afirmar(false, `tabela public.${t} não existe`);
      continue;
    }
    afirmar(porTabela.get(t) === true, `RLS desligada em public.${t}`);
  }
  // Pega também tabela nova que esqueceu o `enable row level security`.
  for (const [tabela, ligada] of porTabela) {
    if (TABELAS.includes(tabela)) continue;
    afirmar(ligada === true, `tabela public.${tabela} está sem RLS`);
  }

  // ------------------------------------------------------------------
  // 2. anon sem privilégio em objeto nenhum de public
  //    Tabela, view, sequence E grant por coluna (docs/TIME_03 §4).
  //    has_table_privilege não vê grant por coluna, por isso a varredura
  //    é pelas ACLs do catálogo.
  // ------------------------------------------------------------------
  const grantsObjeto = await consultar(`
    select c.relkind::text as tipo, c.relname as objeto, acl.privilege_type as priv
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      cross join lateral aclexplode(c.relacl) acl
     where n.nspname = 'public' and pg_get_userbyid(acl.grantee) = 'anon'
  `);
  afirmar(
    grantsObjeto.length === 0,
    `anon tem privilégio em objeto de public: ${grantsObjeto
      .map((g) => `${g.objeto}(${g.tipo}):${g.priv}`)
      .join(", ")}`,
  );

  const grantsColuna = await consultar(`
    select c.relname as objeto, a.attname as coluna, acl.privilege_type as priv
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
      cross join lateral aclexplode(a.attacl) acl
     where n.nspname = 'public' and pg_get_userbyid(acl.grantee) = 'anon'
  `);
  afirmar(
    grantsColuna.length === 0,
    `anon tem grant por coluna: ${grantsColuna
      .map((g) => `${g.objeto}.${g.coluna}:${g.priv}`)
      .join(", ")}`,
  );

  // ------------------------------------------------------------------
  // 3. EXECUTE das funções, por papel
  // ------------------------------------------------------------------
  const todas = [...RPCS_ANON, ...RPCS_SO_PAINEL, ...RPCS_SO_SERVICE_ROLE];
  const privFuncao = await consultar(`
    with f(assinatura) as (values ${todas.map((a) => `(${lit(a)})`).join(", ")})
    select f.assinatura,
           to_regprocedure(f.assinatura) is not null as existe,
           case when to_regprocedure(f.assinatura) is null then false
                else has_function_privilege('anon', f.assinatura, 'EXECUTE') end as anon,
           case when to_regprocedure(f.assinatura) is null then false
                else has_function_privilege('authenticated', f.assinatura, 'EXECUTE') end as auth
      from f
  `);
  const porFuncao = new Map(privFuncao.map((r) => [r.assinatura, r]));

  for (const assinatura of todas) {
    afirmar(porFuncao.get(assinatura)?.existe === true, `função ${assinatura} não existe`);
  }
  for (const assinatura of RPCS_ANON) {
    const r = porFuncao.get(assinatura);
    if (!r?.existe) continue;
    afirmar(r.anon === true, `anon não pode executar ${assinatura}`);
    afirmar(r.auth === true, `authenticated não pode executar ${assinatura}`);
  }
  for (const assinatura of RPCS_SO_PAINEL) {
    const r = porFuncao.get(assinatura);
    if (!r?.existe) continue;
    afirmar(r.anon === false, `anon pode executar ${assinatura} — é só do painel`);
    afirmar(r.auth === true, `authenticated não pode executar ${assinatura}`);
  }
  for (const assinatura of RPCS_SO_SERVICE_ROLE) {
    const r = porFuncao.get(assinatura);
    if (!r?.existe) continue;
    afirmar(r.anon === false, `anon pode executar ${assinatura} — é só service_role`);
    afirmar(r.auth === false, `authenticated pode executar ${assinatura} — é só service_role`);
  }

  // ------------------------------------------------------------------
  // 4. Segredos ilegíveis; colunas de trabalho legíveis
  // ------------------------------------------------------------------
  const privColuna = await consultar(`
    with c(tabela, coluna) as (values
      ${[
        ...COLUNAS_SECRETAS.map(([t, col]) => `(${lit(t)}, ${lit(col)})`),
        ...COLUNAS_COLABORADOR_LEGIVEIS.map((col) => `('colaboradores', ${lit(col)})`),
      ].join(", ")})
    select c.tabela, c.coluna,
           has_column_privilege('anon', 'public.' || c.tabela, c.coluna, 'SELECT') as anon,
           has_column_privilege('authenticated', 'public.' || c.tabela, c.coluna, 'SELECT') as auth
      from c
  `);
  const porColuna = new Map(privColuna.map((r) => [`${r.tabela}.${r.coluna}`, r]));

  for (const [tabela, coluna] of COLUNAS_SECRETAS) {
    const r = porColuna.get(`${tabela}.${coluna}`);
    afirmar(r !== undefined, `coluna ${tabela}.${coluna} não existe`);
    if (!r) continue;
    afirmar(r.anon === false, `anon consegue ler ${tabela}.${coluna}`);
    afirmar(r.auth === false, `authenticated consegue ler ${tabela}.${coluna}`);
  }
  for (const coluna of COLUNAS_COLABORADOR_LEGIVEIS) {
    const r = porColuna.get(`colaboradores.${coluna}`);
    afirmar(r?.auth === true, `authenticated perdeu SELECT em colaboradores.${coluna}`);
  }

  // ------------------------------------------------------------------
  // 5. Funções de escrita: SECURITY DEFINER com search_path fixo
  // ------------------------------------------------------------------
  const funcoes = await consultar(`
    select p.proname as nome, p.prosecdef as definer,
           coalesce(array_to_string(p.proconfig, ','), '') as config
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and (${PREFIXOS_DE_ESCRITA.map((p) => `p.proname like '${p}'`).join(" or ")}
            or p.proname in (${lista(FUNCOES_DE_ESCRITA_EXTRA)}))
  `);
  afirmar(funcoes.length > 0, "nenhuma RPC encontrada — migrations aplicadas?");
  for (const f of funcoes) {
    afirmar(f.definer === true, `public.${f.nome} não é SECURITY DEFINER`);
    afirmar(f.config.includes("search_path="), `public.${f.nome} não fixa search_path`);
  }

  // ------------------------------------------------------------------
  // 6. Pontuação idempotente + conferência de docs/TIME_02 §7
  // ------------------------------------------------------------------
  const [e] = await consultar(`
    select
      (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = '_lancar_pontos')::int as lancar_pontos,
      (select count(*) from pg_indexes
        where schemaname = 'public' and tablename = 'pontos_lancamentos'
          and indexdef ilike '%UNIQUE%' and indexdef ilike '%origem%')::int as indice_origem,
      (select count(*) from temas where empresa_id is null)::int as temas_globais,
      (select count(*) from selos)::int as selos,
      (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname like 'colaborador\\_%')::int as rpcs_colaborador
  `);
  afirmar(e.lancar_pontos === 1, "função _lancar_pontos não existe");
  afirmar(
    e.indice_origem > 0,
    "pontos_lancamentos sem índice único por origem — pontuação deixaria de ser idempotente",
  );
  afirmar(e.temas_globais === 7, `esperava 7 temas globais, achei ${e.temas_globais}`);
  afirmar(e.selos === 10, `esperava 10 selos, achei ${e.selos}`);
  afirmar(
    e.rpcs_colaborador === 18,
    `esperava 18 funções colaborador_*, achei ${e.rpcs_colaborador}`,
  );

  // ------------------------------------------------------------------
  // 7. Storage das fotos de relato (docs/TIME_02 §4, docs/TIME_03 §5)
  //    O bucket é privado e a proteção real é o RLS de storage.objects: os
  //    grants de tabela que o Supabase dá a `anon` só ficam inertes enquanto
  //    não existir policy para ele. Por isso a asserção é sobre as POLICIES.
  // ------------------------------------------------------------------
  const storage = await consultar(`
    select c.relname as objeto, c.relrowsecurity as rls
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'storage' and c.relname in ('objects','buckets')
  `);
  const rlsStorage = new Map(storage.map((r) => [r.objeto, r.rls]));
  for (const objeto of ["objects", "buckets"]) {
    afirmar(rlsStorage.get(objeto) === true, `storage.${objeto} está sem RLS`);
  }

  const policiesStorage = await consultar(`
    select policyname, cmd, roles::text as papeis,
           coalesce(qual, '') as usando, coalesce(with_check, '') as conferindo
      from pg_policies where schemaname = 'storage' and tablename = 'objects'
  `);
  /** Papéis de uma policy, como lista. `roles::text` vem no formato {a,b}. */
  const papeisDe = (texto) =>
    texto
      .replace(/[{}]/g, "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

  const abertas = policiesStorage.filter((p) =>
    papeisDe(p.papeis).some((papel) => papel === "anon" || papel === "public"),
  );
  afirmar(
    abertas.length === 0,
    `policy de storage.objects aberta a anon/public: ${abertas
      .map((p) => `${p.policyname}(${p.cmd})`)
      .join(", ")}`,
  );
  afirmar(
    policiesStorage.some((p) => p.cmd === "SELECT" && /authenticated/.test(p.papeis)),
    "falta a policy de leitura das fotos pelo técnico",
  );
  // Gravação: a foto de relato só entra pela Edge Function, com URL assinada.
  // A única policy de escrita que pode existir é a do logo da empresa, e ela
  // precisa estar presa ao bucket `logos` — senão abriria o bucket das fotos.
  const escrevem = policiesStorage.filter((p) =>
    ["INSERT", "UPDATE", "DELETE", "ALL"].includes(p.cmd),
  );
  for (const p of escrevem) {
    afirmar(
      /bucket_id = 'logos'/.test(p.conferindo),
      `policy ${p.policyname} (${p.cmd}) grava em storage.objects sem se limitar ao bucket logos`,
    );
  }

  const bucket = await consultar(
    "select id, public from storage.buckets where id = 'relatos-fotos'",
  );
  afirmar(bucket.length === 1, "bucket relatos-fotos não existe");
  afirmar(bucket[0]?.public === false, "bucket relatos-fotos está público");

  // Bucket do logo (docs/TIME_04 §14): público para ler, porque o app do
  // colaborador não tem sessão do Supabase Auth; escrita só do admin, e só na
  // pasta da própria empresa.
  const bucketLogos = await consultar("select id, public from storage.buckets where id = 'logos'");
  afirmar(bucketLogos.length === 1, "bucket logos não existe");
  afirmar(bucketLogos[0]?.public === true, "bucket logos não está público");

  const policyLogo = policiesStorage.find((p) => p.policyname === "logos_admin_grava");
  afirmar(policyLogo !== undefined, "falta a policy logos_admin_grava");
  if (policyLogo) {
    afirmar(
      papeisDe(policyLogo.papeis).join(",") === "authenticated",
      "logos_admin_grava não está restrita a authenticated",
    );
    for (const [trecho, erro] of [
      ["meu_papel", "sem exigir o papel admin"],
      ["minha_empresa", "sem prender à pasta da própria empresa"],
      ["'admin'", "sem comparar o papel com admin"],
    ]) {
      afirmar(
        policyLogo.conferindo.includes(trecho),
        `logos_admin_grava grava ${erro} (with check)`,
      );
    }
  }

  // ------------------------------------------------------------------
  // 8. Views aplicam o RLS
  // ------------------------------------------------------------------
  const views = await consultar(`
    select c.relname as nome, coalesce(array_to_string(c.reloptions, ','), '') as opcoes
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'v' and c.relname in (${lista(VIEWS)})
  `);
  const porView = new Map(views.map((v) => [v.nome, v.opcoes]));
  for (const v of VIEWS) {
    if (!porView.has(v)) {
      afirmar(false, `view public.${v} não existe`);
      continue;
    }
    afirmar(
      /security_invoker=(on|true)/i.test(porView.get(v)),
      `view public.${v} sem security_invoker=on — ignoraria o RLS`,
    );
  }
} catch (erro) {
  falhas.push(`erro ao consultar o banco: ${erro.message}`);
}

if (falhas.length > 0) {
  console.error(`\nRLS: ${falhas.length} de ${total} verificações falharam:\n`);
  for (const f of falhas) console.error(`  x ${f}`);
  console.error("");
  process.exit(1);
}

console.log(`RLS: ${total} verificações passaram.`);
