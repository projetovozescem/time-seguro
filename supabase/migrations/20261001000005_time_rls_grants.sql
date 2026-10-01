-- Gerado de docs/TIME_02_BANCO_DE_DADOS.md (linha 1885) — NAO EDITAR O SQL.
-- O SQL deste arquivo foi testado em PostgreSQL 16. Mudanca de banco vira
-- migration NOVA; nunca editar uma migration ja aplicada.

-- =====================================================================
-- T.I.M.E. Seguro — 0005_time_rls_grants.sql
-- Regras de acesso:
--  • anon (app do colaborador e páginas públicas): NÃO lê nem escreve
--    tabela nenhuma. Só executa as RPCs públicas/colaborador.
--  • authenticated (técnico/CIPA/admin): lê tudo da própria empresa;
--    admin/técnico escrevem no CRUD; pontuação só via RPC.
--  • Canal de Respeito: só quem tem comite_assedio = true.
-- =====================================================================

-- 1) Tranca tudo por padrão (inclusive funções criadas no futuro)
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

do $$ declare t text; begin
  foreach t in array array[
    'empresas','perfis_tecnicos','setores','locais','colaboradores','sessoes_colaborador','consentimentos_lgpd',
    'temas','perguntas','campanhas','campanha_temas','licoes','licao_perguntas','progresso_licoes',
    'respostas','atividade_diaria','eventos','checkins','quiz_tv_sessoes','quiz_tv_equipes','quiz_tv_respostas',
    'relatos','relato_historico','denuncias_assedio','denuncia_mensagens','pontos_lancamentos',
    'selos','selos_conquistados','campanha_resultados','certificados']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- 2) CRUD do técnico (leitura: todos os papéis da empresa; escrita: admin/técnico)
do $$ declare t text; begin
  foreach t in array array['setores','locais','campanhas','campanha_temas','licoes','licao_perguntas','eventos']
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format($p$create policy %I on public.%I for select to authenticated using (empresa_id = minha_empresa())$p$, t || '_ler', t);
    execute format($p$create policy %I on public.%I for all to authenticated
                      using (empresa_id = minha_empresa() and meu_papel() in ('admin','tecnico'))
                      with check (empresa_id = minha_empresa() and meu_papel() in ('admin','tecnico'))$p$, t || '_escrever', t);
  end loop;
end $$;

-- 3) Somente leitura para o painel (escrita exclusiva via RPC SECURITY DEFINER)
do $$ declare t text; begin
  foreach t in array array['progresso_licoes','respostas','atividade_diaria','checkins','quiz_tv_sessoes','quiz_tv_equipes',
                           'quiz_tv_respostas','relatos','relato_historico','pontos_lancamentos','selos_conquistados',
                           'campanha_resultados','certificados','consentimentos_lgpd']
  loop
    execute format('grant select on public.%I to authenticated', t);
    execute format($p$create policy %I on public.%I for select to authenticated using (empresa_id = minha_empresa())$p$, t || '_ler', t);
  end loop;
end $$;

-- 4) Empresas e perfis
grant select on public.empresas to authenticated;
grant update (nome, logo_url, termo_lgpd_versao, termo_lgpd_texto, config) on public.empresas to authenticated;
create policy empresas_ler on public.empresas for select to authenticated using (id = minha_empresa());
create policy empresas_admin on public.empresas for update to authenticated
  using (id = minha_empresa() and meu_papel() = 'admin') with check (id = minha_empresa());

grant select on public.perfis_tecnicos to authenticated;
create policy perfis_ler on public.perfis_tecnicos for select to authenticated using (empresa_id = minha_empresa());

-- 5) Colaboradores: o hash do PIN nunca é legível pelo painel
grant select (id, empresa_id, setor_id, matricula, nome, turno, pin_provisorio, ativo, lgpd_aceite_versao,
              lgpd_aceite_em, tentativas_falhas, bloqueado_ate, anonimizado, criado_em) on public.colaboradores to authenticated;
grant insert (empresa_id, setor_id, matricula, nome, turno) on public.colaboradores to authenticated;
grant update (setor_id, nome, turno, ativo) on public.colaboradores to authenticated;
create policy colaboradores_ler on public.colaboradores for select to authenticated using (empresa_id = minha_empresa());
create policy colaboradores_escrever on public.colaboradores for insert to authenticated
  with check (empresa_id = minha_empresa() and meu_papel() in ('admin','tecnico'));
create policy colaboradores_atualizar on public.colaboradores for update to authenticated
  using (empresa_id = minha_empresa() and meu_papel() in ('admin','tecnico'))
  with check (empresa_id = minha_empresa());

-- 6) Temas e perguntas: globais (empresa_id null) são só-leitura
grant select, insert, update, delete on public.temas, public.perguntas to authenticated;
create policy temas_ler on public.temas for select to authenticated using (empresa_id is null or empresa_id = minha_empresa());
create policy temas_escrever on public.temas for all to authenticated
  using (empresa_id = minha_empresa() and meu_papel() in ('admin','tecnico'))
  with check (empresa_id = minha_empresa() and meu_papel() in ('admin','tecnico'));
create policy perguntas_ler on public.perguntas for select to authenticated using (empresa_id is null or empresa_id = minha_empresa());
create policy perguntas_escrever on public.perguntas for all to authenticated
  using (empresa_id = minha_empresa() and meu_papel() in ('admin','tecnico'))
  with check (empresa_id = minha_empresa() and meu_papel() in ('admin','tecnico'));

-- 7) Selos (catálogo global, só leitura)
grant select on public.selos to authenticated;
create policy selos_ler on public.selos for select to authenticated using (true);

-- 8) Canal de Respeito: só o comitê lê. Escrita só via RPC.
-- (senha_hash fica de fora: grant por coluna)
grant select (id, empresa_id, protocolo, categoria, descricao, local_aproximado, periodo_aproximado,
              quer_retorno, status, recebida_em) on public.denuncias_assedio to authenticated;
grant select on public.denuncia_mensagens to authenticated;
create policy denuncias_comite on public.denuncias_assedio for select to authenticated
  using (empresa_id = minha_empresa() and sou_comite_assedio());
create policy mensagens_comite on public.denuncia_mensagens for select to authenticated
  using (empresa_id = minha_empresa() and sou_comite_assedio());

-- 9) Views (security_invoker => aplicam o RLS acima)
grant select on public.v_ranking_individual, public.v_ranking_setor, public.v_lacunas, public.v_desempenho_pergunta to authenticated;

-- 10) EXECUTE nas RPCs
grant execute on function
  public.empresa_publica(text),
  public.colaborador_login(text, text, text),
  public.colaborador_logout(text),
  public.colaborador_trocar_pin(text, text, text),
  public.colaborador_termo_lgpd(text),
  public.colaborador_aceitar_lgpd(text),
  public.colaborador_resumo(text),
  public.colaborador_perguntas_do_dia(text),
  public.colaborador_responder_pergunta(text, uuid, int, int),
  public.colaborador_trilha(text),
  public.colaborador_licao(text, uuid),
  public.colaborador_concluir_conteudo(text, uuid),
  public.colaborador_enviar_avaliacao(text, uuid, jsonb),
  public.colaborador_checkin(text, uuid, text),
  public.colaborador_criar_relato(text, text, text, uuid, uuid),
  public.colaborador_meus_relatos(text),
  public.colaborador_local(text, uuid),
  public.colaborador_ranking(text),
  public.colaborador_perfil(text),
  public.registrar_denuncia_assedio(text, text, text, text, text, boolean),
  public.consultar_denuncia(text, text),
  public.responder_denuncia_denunciante(text, text, text),
  public.verificar_certificado(text)
to anon, authenticated;

grant execute on function
  public.minha_empresa(), public.meu_papel(), public.sou_comite_assedio(), public.dia_operacional(),
  public._nome_curto(text),
  public.tecnico_gerar_pins(uuid[]),
  public.tecnico_importar_colaboradores(jsonb),
  public.tecnico_desbloquear_colaborador(uuid),
  public.tecnico_anonimizar_colaborador(uuid),
  public.tecnico_validar_relato(uuid, text, text, text, uuid),
  public.tecnico_atualizar_relato(uuid, text, text, boolean),
  public.tecnico_rotacionar_codigo(uuid),
  public.tecnico_salvar_quiz_tv(uuid, text, int, jsonb, jsonb),
  public.tecnico_ativar_campanha(uuid),
  public.tecnico_encerrar_campanha(uuid, int),
  public.comite_responder_denuncia(uuid, text, text)
to authenticated;

-- Só a Edge Function (service_role) autoriza upload de foto de relato
grant execute on function public._relato_caminho_foto(text, uuid) to service_role;
