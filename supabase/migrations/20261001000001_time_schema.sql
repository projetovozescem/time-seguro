-- Gerado de docs/TIME_02_BANCO_DE_DADOS.md (linha 105) — NAO EDITAR O SQL.
-- O SQL deste arquivo foi testado em PostgreSQL 16. Mudanca de banco vira
-- migration NOVA; nunca editar uma migration ja aplicada.

-- =====================================================================
-- T.I.M.E. Seguro — 0001_time_schema.sql
-- Schema completo. Regra: TODA tabela de negócio tem empresa_id
-- (multi-empresa / SaaS) para simplificar o RLS.
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- EMPRESAS E USUÁRIOS DO PAINEL
-- ---------------------------------------------------------------------
create table public.empresas (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null,
  codigo              text not null unique check (codigo ~ '^[a-z0-9-]{3,30}$'), -- usado no login e nas URLs públicas
  logo_url            text,
  termo_lgpd_versao   int  not null default 1,
  termo_lgpd_texto    text not null default '',
  config              jsonb not null default '{}'::jsonb,
  criado_em           timestamptz not null default now()
);

-- Técnicos de SST / CIPA / admins (usam Supabase Auth com e-mail e senha)
create table public.perfis_tecnicos (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  nome            text not null,
  papel           text not null default 'tecnico' check (papel in ('admin','tecnico','cipa')),
  comite_assedio  boolean not null default false,  -- único grupo que lê o Canal de Respeito
  criado_em       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- ESTRUTURA DA EMPRESA
-- ---------------------------------------------------------------------
create table public.setores (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nome        text not null,
  cor         text not null default '#0B3C5D',
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  unique (empresa_id, nome)
);

-- Pontos físicos com QR Code (máquina, painel elétrico, refeitório, almoxarifado...)
create table public.locais (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  setor_id    uuid not null references public.setores(id) on delete cascade,
  nome        text not null,
  descricao   text,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

create table public.colaboradores (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references public.empresas(id) on delete cascade,
  setor_id            uuid references public.setores(id) on delete set null,
  matricula           text not null,
  nome                text not null,
  turno               text,
  pin_hash            text,                          -- bcrypt; NUNCA exposto ao cliente
  pin_provisorio      boolean not null default true, -- força troca no 1º acesso
  ativo               boolean not null default true,
  lgpd_aceite_versao  int,
  lgpd_aceite_em      timestamptz,
  tentativas_falhas   int not null default 0,
  bloqueado_ate       timestamptz,
  anonimizado         boolean not null default false,
  criado_em           timestamptz not null default now(),
  unique (empresa_id, matricula)
);

create table public.sessoes_colaborador (
  id              uuid primary key default gen_random_uuid(),
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  token_hash      text not null unique,   -- sha256 do token; o token puro só existe no aparelho
  criado_em       timestamptz not null default now(),
  expira_em       timestamptz not null,
  revogada        boolean not null default false
);

create table public.consentimentos_lgpd (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  versao          int not null,
  aceito_em       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- CONTEÚDO: TEMAS E PERGUNTAS
-- ---------------------------------------------------------------------
create table public.temas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid references public.empresas(id) on delete cascade, -- null = tema global
  slug        text not null,
  nome        text not null,
  icone       text not null default '🛡️',
  cor         text not null default '#0B3C5D',
  unique (empresa_id, slug)
);
create unique index temas_global_slug on public.temas (slug) where empresa_id is null;

create table public.perguntas (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid references public.empresas(id) on delete cascade, -- null = banco global
  tema_id       uuid not null references public.temas(id),
  enunciado     text not null,
  alternativas  text[] not null check (array_length(alternativas, 1) between 2 and 5),
  correta       smallint not null,           -- índice 0-based em alternativas
  explicacao    text,
  dificuldade   smallint not null default 2 check (dificuldade between 1 and 3),
  status        text not null default 'ativa' check (status in ('ativa','inativa')),
  origem        text not null default 'manual' check (origem in ('manual','importacao','seed')),
  criado_em     timestamptz not null default now(),
  check (correta >= 0 and correta < array_length(alternativas, 1))
);
create index perguntas_tema on public.perguntas (tema_id) where status = 'ativa';

-- ---------------------------------------------------------------------
-- CAMPANHAS TRIMESTRAIS E TRILHA DE TREINAMENTOS
-- ---------------------------------------------------------------------
create table public.campanhas (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null references public.empresas(id) on delete cascade,
  nome               text not null,
  descricao          text,
  inicio             date not null,
  fim                date not null,
  status             text not null default 'rascunho' check (status in ('rascunho','ativa','encerrada')),
  premiacao          text,
  ranking_visivel    boolean not null default true,
  perguntas_por_dia  int not null default 5 check (perguntas_por_dia between 1 and 20),
  config             jsonb not null default '{}'::jsonb, -- sobrescreve pontos padrão (ver TIME_08)
  encerrada_em       timestamptz,
  criado_em          timestamptz not null default now(),
  check (fim >= inicio)
);
create unique index campanhas_uma_ativa on public.campanhas (empresa_id) where status = 'ativa';

create table public.campanha_temas (
  campanha_id  uuid not null references public.campanhas(id) on delete cascade,
  tema_id      uuid not null references public.temas(id),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  primary key (campanha_id, tema_id)
);

create table public.licoes (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  campanha_id    uuid not null references public.campanhas(id) on delete cascade,
  tema_id        uuid references public.temas(id),
  titulo         text not null,
  conteudo_md    text not null default '',
  video_url      text,
  carga_minutos  int not null default 10 check (carga_minutos > 0),
  ordem          int not null default 0,
  nota_minima    int not null default 70 check (nota_minima between 0 and 100),
  obrigatoria    boolean not null default true,
  publicada      boolean not null default false,
  criado_em      timestamptz not null default now()
);

create table public.licao_perguntas (
  licao_id     uuid not null references public.licoes(id) on delete cascade,
  pergunta_id  uuid not null references public.perguntas(id) on delete cascade,
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  ordem        int not null default 0,
  primary key (licao_id, pergunta_id)
);

create table public.progresso_licoes (
  id                     uuid primary key default gen_random_uuid(),
  empresa_id             uuid not null references public.empresas(id) on delete cascade,
  licao_id               uuid not null references public.licoes(id) on delete cascade,
  colaborador_id         uuid not null references public.colaboradores(id) on delete cascade,
  conteudo_concluido_em  timestamptz,
  melhor_nota            int,
  tentativas             int not null default 0,
  tentativas_hoje        int not null default 0,
  ultima_tentativa_dia   date,
  aprovado_em            timestamptz,
  unique (licao_id, colaborador_id)
);

-- ---------------------------------------------------------------------
-- RESPOSTAS, ATIVIDADE E EVENTOS (DDS / SIPAT)
-- ---------------------------------------------------------------------
create table public.respostas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  campanha_id     uuid not null references public.campanhas(id) on delete cascade,
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  pergunta_id     uuid not null references public.perguntas(id) on delete cascade,
  origem          text not null check (origem in ('diario','licao')),
  licao_id        uuid references public.licoes(id) on delete set null,
  alternativa     smallint not null,
  acertou         boolean not null,
  tempo_ms        int not null default 0,
  dia             date not null,
  criado_em       timestamptz not null default now()
);
create unique index respostas_diario_unica on public.respostas (colaborador_id, pergunta_id, dia) where origem = 'diario';
create index respostas_camp_colab on public.respostas (campanha_id, colaborador_id);

create table public.atividade_diaria (
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  campanha_id     uuid not null references public.campanhas(id) on delete cascade,
  dia             date not null,
  primary key (colaborador_id, campanha_id, dia)
);

create table public.eventos (
  id                     uuid primary key default gen_random_uuid(),
  empresa_id             uuid not null references public.empresas(id) on delete cascade,
  campanha_id            uuid references public.campanhas(id) on delete set null,
  tipo                   text not null check (tipo in ('dds','sipat','treinamento','outro')),
  titulo                 text not null,
  descricao              text,
  setor_id               uuid references public.setores(id) on delete set null, -- null = todos os setores
  inicio                 timestamptz not null,
  fim                    timestamptz not null,
  pontos                 int not null default 5 check (pontos between 0 and 100),
  codigo_checkin         text,
  codigo_anterior        text,
  codigo_atualizado_em   timestamptz,
  status                 text not null default 'agendado' check (status in ('agendado','realizado','cancelado')),
  criado_em              timestamptz not null default now(),
  check (fim > inicio)
);

create table public.checkins (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  evento_id       uuid not null references public.eventos(id) on delete cascade,
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  criado_em       timestamptz not null default now(),
  unique (evento_id, colaborador_id)
);

-- ---------------------------------------------------------------------
-- MODO TV (DDS / SIPAT no refeitório)
-- ---------------------------------------------------------------------
create table public.quiz_tv_sessoes (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  campanha_id  uuid references public.campanhas(id) on delete set null,
  evento_id    uuid unique references public.eventos(id) on delete set null, -- 1 sessão pontuada por evento
  modo         text not null check (modo in ('classico','duelo','eliminacao')),
  duracao_ms   int not null default 0,
  criado_por   uuid references auth.users(id) on delete set null,
  criado_em    timestamptz not null default now()
);

create table public.quiz_tv_equipes (
  sessao_id   uuid not null references public.quiz_tv_sessoes(id) on delete cascade,
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  setor_id    uuid not null references public.setores(id) on delete cascade,
  pontos      int not null default 0,
  acertos     int not null default 0,
  erros       int not null default 0,
  primary key (sessao_id, setor_id)
);

create table public.quiz_tv_respostas (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  sessao_id    uuid not null references public.quiz_tv_sessoes(id) on delete cascade,
  setor_id     uuid references public.setores(id) on delete set null,
  pergunta_id  uuid references public.perguntas(id) on delete set null,
  alternativa  smallint,
  acertou      boolean not null,
  tempo_ms     int not null default 0,
  ordem        int not null default 0
);

-- ---------------------------------------------------------------------
-- RELATOS (condição insegura / quase-acidente)
-- ---------------------------------------------------------------------
create table public.relatos (
  id                     uuid primary key default gen_random_uuid(),
  empresa_id             uuid not null references public.empresas(id) on delete cascade,
  campanha_id            uuid references public.campanhas(id) on delete set null,
  colaborador_id         uuid references public.colaboradores(id) on delete set null,
  setor_id               uuid references public.setores(id) on delete set null,
  local_id               uuid references public.locais(id) on delete set null,
  categoria              text not null check (categoria in ('condicao_insegura','ato_inseguro','quase_acidente','melhoria')),
  descricao              text not null check (char_length(descricao) between 10 and 2000),
  foto_path              text,
  status                 text not null default 'aberto'
                         check (status in ('aberto','em_analise','em_correcao','resolvido','rejeitado','duplicado')),
  gravidade              text check (gravidade in ('baixa','media','alta')),
  validado               boolean not null default false,
  validado_por           uuid references auth.users(id) on delete set null,
  validado_em            timestamptz,
  duplicado_de           uuid references public.relatos(id) on delete set null,
  possivel_duplicado_de  uuid references public.relatos(id) on delete set null,
  criado_em              timestamptz not null default now()
);
create index relatos_empresa_status on public.relatos (empresa_id, status);

create table public.relato_historico (
  id                   uuid primary key default gen_random_uuid(),
  empresa_id           uuid not null references public.empresas(id) on delete cascade,
  relato_id            uuid not null references public.relatos(id) on delete cascade,
  status               text not null,
  comentario           text,
  autor_user_id        uuid references auth.users(id) on delete set null,
  visivel_colaborador  boolean not null default true,
  criado_em            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- CANAL DE RESPEITO (denúncia de assédio) — ANÔNIMO, NUNCA PONTUA
-- Sem colaborador_id, sem hora, sem IP, sem aparelho. Só a DATA.
-- ---------------------------------------------------------------------
create table public.denuncias_assedio (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references public.empresas(id) on delete cascade,
  protocolo           text not null unique,
  senha_hash          text not null,
  categoria           text not null check (categoria in ('moral','sexual','discriminacao','outro')),
  descricao           text not null check (char_length(descricao) between 20 and 5000),
  local_aproximado    text,
  periodo_aproximado  text,
  quer_retorno        boolean not null default true,
  status              text not null default 'recebida' check (status in ('recebida','em_apuracao','concluida','arquivada')),
  recebida_em         date not null default current_date
);

create table public.denuncia_mensagens (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  denuncia_id  uuid not null references public.denuncias_assedio(id) on delete cascade,
  autor        text not null check (autor in ('comite','denunciante')),
  mensagem     text not null check (char_length(mensagem) between 1 and 3000),
  enviada_em   date not null default current_date,
  ordem        bigint generated always as identity
);

-- ---------------------------------------------------------------------
-- PONTUAÇÃO (livro-razão), SELOS, RESULTADOS E CERTIFICADOS
-- ---------------------------------------------------------------------
create table public.pontos_lancamentos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  campanha_id     uuid not null references public.campanhas(id) on delete cascade,
  colaborador_id  uuid references public.colaboradores(id) on delete cascade, -- null = ponto de SETOR (Modo TV)
  setor_id        uuid references public.setores(id) on delete set null,
  pilar           text not null check (pilar in ('conhecimento','relatos','engajamento','quiz_tv')),
  origem          text not null,   -- ex.: quiz_diario, licao_conteudo, licao_aprovada, relato_validado, checkin, streak_7...
  origem_id       uuid not null,   -- id do fato que gerou o ponto (garante idempotência)
  pontos          int not null,
  dia             date not null,
  criado_em       timestamptz not null default now()
);
create unique index pl_unico_colab on public.pontos_lancamentos (origem, origem_id, colaborador_id) where colaborador_id is not null;
create unique index pl_unico_setor on public.pontos_lancamentos (origem, origem_id, setor_id) where colaborador_id is null;
create index pl_camp_colab on public.pontos_lancamentos (campanha_id, colaborador_id);

create table public.selos (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  nome       text not null,
  descricao  text not null,
  icone      text not null,
  ordem      int not null default 0
);

create table public.selos_conquistados (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  selo_id         uuid not null references public.selos(id) on delete cascade,
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  campanha_id     uuid not null references public.campanhas(id) on delete cascade,
  conquistado_em  timestamptz not null default now(),
  unique (selo_id, colaborador_id, campanha_id)
);

-- Foto congelada do ranking no encerramento (base do comparativo trimestral)
create table public.campanha_resultados (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  campanha_id     uuid not null references public.campanhas(id) on delete cascade,
  tipo            text not null check (tipo in ('individual','setor')),
  colaborador_id  uuid references public.colaboradores(id) on delete set null,
  setor_id        uuid references public.setores(id) on delete set null,
  posicao         int not null,
  pontos          int not null,
  detalhes        jsonb not null default '{}'::jsonb
);

create table public.certificados (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  campanha_id     uuid not null references public.campanhas(id) on delete cascade,
  colaborador_id  uuid references public.colaboradores(id) on delete set null,
  tipo            text not null check (tipo in ('destaque','conclusao_trilha')),
  titulo          text not null,
  carga_minutos   int,
  codigo          text not null unique,
  emitido_em      timestamptz not null default now(),
  dados           jsonb not null default '{}'::jsonb,
  unique (campanha_id, colaborador_id, tipo)
);
