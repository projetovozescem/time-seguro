// Gate de segurança do banco do T.I.M.E. Seguro.
//
// Confere, no projeto de DESENVOLVIMENTO, que o modelo de acesso de
// docs/TIME_03 §4/§8 e da migration 0005_time_rls_grants continua de pé:
//   • anon não lê nem escreve tabela nenhuma — só executa as RPCs públicas;
//   • o hash do PIN e a senha da denúncia são ilegíveis pelo painel;
//   • toda função de escrita é SECURITY DEFINER com search_path fixo;
//   • as views aplicam o RLS (security_invoker).
//
// Só leitura de catálogo: não escreve nem apaga nada.
import { conectar } from "./_db.mjs";

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

const VIEWS = ["v_ranking_individual", "v_ranking_setor", "v_lacunas", "v_desempenho_pergunta"];

const falhas = [];
let total = 0;

function afirmar(condicao, descricao) {
  total++;
  if (!condicao) falhas.push(descricao);
}

const sql = await conectar();

try {
  // ------------------------------------------------------------------
  // 1. Todas as 30 tabelas existem e têm RLS habilitada
  // ------------------------------------------------------------------
  const rls = await sql`
    SELECT c.relname AS tabela, c.relrowsecurity AS ligada
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY(${TABELAS})
  `;
  const porTabela = new Map(rls.map((r) => [r.tabela, r.ligada]));
  for (const t of TABELAS) {
    if (!porTabela.has(t)) {
      afirmar(false, `tabela public.${t} não existe`);
      continue;
    }
    afirmar(porTabela.get(t) === true, `RLS desligada em public.${t}`);
  }

  // ------------------------------------------------------------------
  // 2. anon não toca tabela nenhuma de public — nem as criadas depois
  //    (docs/TIME_03 §4: "anon: zero acesso a tabelas")
  // ------------------------------------------------------------------
  const tabelasReais = (
    await sql`
      SELECT c.relname AS tabela
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
    `
  ).map((r) => r.tabela);

  afirmar(tabelasReais.length > 0, "nenhuma tabela encontrada em public — schema aplicado?");

  for (const t of tabelasReais) {
    for (const acao of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES"]) {
      const [{ tem }] = await sql`
        SELECT has_table_privilege('anon', ${"public." + t}, ${acao}) AS tem
      `;
      afirmar(tem === false, `anon tem ${acao} em public.${t}`);
    }
  }

  // anon também não lê as views
  for (const v of VIEWS) {
    const [{ tem }] = await sql`
      SELECT has_table_privilege('anon', ${"public." + v}, 'SELECT') AS tem
    `;
    afirmar(tem === false, `anon tem SELECT na view public.${v}`);
  }

  // ------------------------------------------------------------------
  // 3. As RPCs do app existem e anon pode executá-las
  // ------------------------------------------------------------------
  for (const assinatura of RPCS_ANON) {
    const [{ existe }] = await sql`SELECT to_regprocedure(${assinatura}) IS NOT NULL AS existe`;
    if (!existe) {
      afirmar(false, `função ${assinatura} não existe`);
      continue;
    }
    for (const papel of ["anon", "authenticated"]) {
      const [{ tem }] = await sql`
        SELECT has_function_privilege(${papel}, ${assinatura}, 'EXECUTE') AS tem
      `;
      afirmar(tem === true, `${papel} não pode executar ${assinatura}`);
    }
  }

  // ------------------------------------------------------------------
  // 4. As RPCs do painel ficam fora do alcance de anon
  // ------------------------------------------------------------------
  for (const assinatura of RPCS_SO_PAINEL) {
    const [{ existe }] = await sql`SELECT to_regprocedure(${assinatura}) IS NOT NULL AS existe`;
    if (!existe) {
      afirmar(false, `função ${assinatura} não existe`);
      continue;
    }
    const [{ anonTem }] = await sql`
      SELECT has_function_privilege('anon', ${assinatura}, 'EXECUTE') AS "anonTem"
    `;
    afirmar(anonTem === false, `anon pode executar ${assinatura} (deveria ser só do painel)`);

    const [{ authTem }] = await sql`
      SELECT has_function_privilege('authenticated', ${assinatura}, 'EXECUTE') AS "authTem"
    `;
    afirmar(authTem === true, `authenticated não pode executar ${assinatura}`);
  }

  // A autorização de upload de foto é exclusiva da Edge Function (service_role)
  {
    const assinatura = "public._relato_caminho_foto(text, uuid)";
    const [{ existe }] = await sql`SELECT to_regprocedure(${assinatura}) IS NOT NULL AS existe`;
    afirmar(existe === true, `função ${assinatura} não existe`);
    if (existe) {
      for (const papel of ["anon", "authenticated"]) {
        const [{ tem }] = await sql`
          SELECT has_function_privilege(${papel}, ${assinatura}, 'EXECUTE') AS tem
        `;
        afirmar(tem === false, `${papel} pode executar ${assinatura} (só service_role)`);
      }
    }
  }

  // ------------------------------------------------------------------
  // 5. Segredos ilegíveis pelo painel (docs/TIME_03 §4)
  // ------------------------------------------------------------------
  for (const papel of ["anon", "authenticated"]) {
    const [{ tem }] = await sql`
      SELECT has_column_privilege(${papel}, 'public.colaboradores', 'pin_hash', 'SELECT') AS tem
    `;
    afirmar(tem === false, `${papel} consegue ler colaboradores.pin_hash`);

    const [{ tem: senha }] = await sql`
      SELECT has_column_privilege(${papel}, 'public.denuncias_assedio', 'senha_hash', 'SELECT') AS tem
    `;
    afirmar(senha === false, `${papel} consegue ler denuncias_assedio.senha_hash`);
  }

  // ...mas o painel continua lendo o que precisa
  for (const coluna of COLUNAS_COLABORADOR_LEGIVEIS) {
    const [{ tem }] = await sql`
      SELECT has_column_privilege('authenticated', 'public.colaboradores', ${coluna}, 'SELECT') AS tem
    `;
    afirmar(tem === true, `authenticated perdeu SELECT em colaboradores.${coluna}`);
  }

  // ------------------------------------------------------------------
  // 6. Toda função de escrita é SECURITY DEFINER com search_path fixo
  // ------------------------------------------------------------------
  const funcoes = await sql`
    SELECT p.proname AS nome, p.prosecdef AS definer, p.proconfig AS config
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND (p.proname LIKE 'colaborador\\_%' OR p.proname LIKE 'tecnico\\_%'
            OR p.proname LIKE 'comite\\_%' OR p.proname IN
            ('registrar_denuncia_assedio','consultar_denuncia','responder_denuncia_denunciante',
             '_lancar_pontos','_relato_caminho_foto'))
  `;
  afirmar(funcoes.length > 0, "nenhuma RPC encontrada — migrations aplicadas?");
  for (const f of funcoes) {
    afirmar(f.definer === true, `public.${f.nome} não é SECURITY DEFINER`);
    const temSearchPath = (f.config ?? []).some((c) => c.startsWith("search_path="));
    afirmar(temSearchPath, `public.${f.nome} não fixa search_path`);
  }

  // Pontuação é idempotente por construção: _lancar_pontos é o único caminho
  const [{ existe: temLancar }] = await sql`
    SELECT count(*) > 0 AS existe FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = '_lancar_pontos'
  `;
  afirmar(temLancar === true, "função _lancar_pontos não existe");

  const [{ temIndice }] = await sql`
    SELECT count(*) > 0 AS "temIndice"
      FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = 'pontos_lancamentos'
       AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%origem%'
  `;
  afirmar(
    temIndice === true,
    "pontos_lancamentos sem índice único por origem — pontuação deixaria de ser idempotente",
  );

  // ------------------------------------------------------------------
  // 7. Views aplicam o RLS (security_invoker = on)
  // ------------------------------------------------------------------
  for (const v of VIEWS) {
    const [linha] = await sql`
      SELECT c.reloptions AS opcoes
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = ${v} AND c.relkind = 'v'
    `;
    if (!linha) {
      afirmar(false, `view public.${v} não existe`);
      continue;
    }
    const invoker = (linha.opcoes ?? []).some((o) => /^security_invoker=(on|true)$/i.test(o));
    afirmar(invoker, `view public.${v} sem security_invoker=on — ignoraria o RLS`);
  }

  // ------------------------------------------------------------------
  // 8. Seed aplicado (conferência de docs/TIME_02 §7)
  // ------------------------------------------------------------------
  const [{ temas }] =
    await sql`SELECT count(*)::int AS temas FROM public.temas WHERE empresa_id IS NULL`;
  afirmar(temas === 7, `esperava 7 temas globais, achei ${temas}`);

  const [{ selos }] = await sql`SELECT count(*)::int AS selos FROM public.selos`;
  afirmar(selos === 10, `esperava 10 selos, achei ${selos}`);

  const [{ rpcs }] = await sql`
    SELECT count(*)::int AS rpcs FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname LIKE 'colaborador\\_%'
  `;
  afirmar(rpcs === 18, `esperava 18 funções colaborador_*, achei ${rpcs}`);
} catch (erro) {
  falhas.push(`erro ao consultar o banco: ${erro.message}`);
} finally {
  await sql.end();
}

if (falhas.length > 0) {
  console.error(`\nRLS: ${falhas.length} de ${total} verificações falharam:\n`);
  for (const f of falhas) console.error(`  x ${f}`);
  console.error("");
  process.exit(1);
}

console.log(`RLS: ${total} verificações passaram.`);
