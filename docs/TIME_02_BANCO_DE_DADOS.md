# TIME_02 — Banco de Dados (Supabase)

> ✅ **SQL testado** em PostgreSQL 16 com simulação do ambiente Supabase (roles `anon`,
> `authenticated`, `service_role`, `auth.uid()` e pgcrypto no schema `extensions`).
> O fluxo completo foi executado: importação de colaboradores, PIN, LGPD, quiz diário,
> trilha, check-in, relatos, validação, Modo TV, ranking, encerramento, certificados
> e bloqueios de acesso (anon sem tabelas, CIPA sem denúncias, hash do PIN ilegível).

## 1. Como aplicar

1. Crie um **projeto novo** no Supabase (não reutilize o do V.O.Z.E.S.).
2. No repositório copiado, **apague** `supabase/migrations/*` e `drizzle/` herdados do V.O.Z.E.S.
3. Crie os 6 arquivos abaixo em `supabase/migrations/` com os nomes indicados
   (use o prefixo de data que o CLI gerar, mantendo a ordem).
4. `npx supabase link --project-ref <ref>` e depois `npx supabase db push`.
5. Gere os tipos: `npx supabase gen types typescript --linked > src/lib/database.types.ts`.
6. Faça o **bootstrap** (final do arquivo 0006): crie o 1º usuário em _Authentication → Users_,
   depois rode os dois `insert` comentados no SQL Editor.
7. Crie o bucket de Storage e as policies (seção 4 deste documento).

## 2. Visão geral das tabelas

| Grupo             | Tabelas                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| Empresa e acesso  | `empresas`, `perfis_tecnicos`, `setores`, `locais`, `colaboradores`, `sessoes_colaborador`, `consentimentos_lgpd` |
| Conteúdo          | `temas`, `perguntas`                                                                                              |
| Campanha          | `campanhas`, `campanha_temas`, `licoes`, `licao_perguntas`, `progresso_licoes`                                    |
| Participação      | `respostas`, `atividade_diaria`, `eventos`, `checkins`                                                            |
| Modo TV           | `quiz_tv_sessoes`, `quiz_tv_equipes`, `quiz_tv_respostas`                                                         |
| Relatos           | `relatos`, `relato_historico`                                                                                     |
| Canal de Respeito | `denuncias_assedio`, `denuncia_mensagens`                                                                         |
| Pontuação         | `pontos_lancamentos` (livro-razão), `selos`, `selos_conquistados`, `campanha_resultados`, `certificados`          |
| Views             | `v_ranking_individual`, `v_ranking_setor`, `v_lacunas`, `v_desempenho_pergunta`                                   |

### Decisões de modelagem

- **Livro-razão de pontos** (`pontos_lancamentos`): cada ponto é uma linha com `pilar`, `origem`
  e `origem_id`. Índices únicos impedem dupla contagem. Ranking = soma. Zerar ciclo = filtrar por campanha.
- **Alternativas em `text[]`** (2 a 5) com `correta` 0-based: compatível com o importador do Max Games (A–E).
- **`empresa_id` em tudo**: RLS simples e pronto para vender como SaaS.
- **Ranking de setor = média por colaborador ativo + pontos do Modo TV**: setor grande não vence só por tamanho.
- **Perguntas/temas com `empresa_id` nulo** = banco global, só leitura para as empresas.

## 3. Catálogo de RPCs

### App do colaborador (role `anon`, sempre com `p_token`)

| Função                                                                   | Uso                                                                  |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `empresa_publica(codigo)`                                                | Nome/logo na tela de login e no Canal de Respeito                    |
| `colaborador_login(codigo, matricula, pin)`                              | Devolve `token` e `pendencia` (`trocar_pin` / `aceitar_lgpd` / null) |
| `colaborador_logout(token)`                                              | Revoga a sessão                                                      |
| `colaborador_trocar_pin(token, atual, novo)`                             | Obrigatória no 1º acesso                                             |
| `colaborador_termo_lgpd(token)` / `colaborador_aceitar_lgpd(token)`      | Consentimento                                                        |
| `colaborador_resumo(token)`                                              | Home: pontos por pilar, sequência, posição, progresso do dia         |
| `colaborador_perguntas_do_dia(token)`                                    | Perguntas sem gabarito (gabarito só das já respondidas)              |
| `colaborador_responder_pergunta(token, pergunta, alternativa, tempo_ms)` | Corrige, pontua, avalia selos                                        |
| `colaborador_trilha(token)` / `colaborador_licao(token, licao)`          | Lista e detalhe da lição                                             |
| `colaborador_concluir_conteudo(token, licao)`                            | Libera a avaliação                                                   |
| `colaborador_enviar_avaliacao(token, licao, respostas)`                  | Corrige no servidor, devolve nota e gabarito                         |
| `colaborador_checkin(token, evento, codigo)`                             | Check-in em DDS/SIPAT                                                |
| `colaborador_criar_relato(token, categoria, descricao, local?, setor?)`  | Cria relato (foto via Edge Function)                                 |
| `colaborador_meus_relatos(token)`                                        | Lista com histórico visível                                          |
| `colaborador_local(token, local)`                                        | Dados do QR de um local                                              |
| `colaborador_ranking(token)`                                             | Top 10 + minha posição + setores                                     |
| `colaborador_perfil(token)`                                              | Selos, extrato de pontos, certificados                               |

### Públicas (role `anon`, sem token)

`registrar_denuncia_assedio`, `consultar_denuncia`, `responder_denuncia_denunciante`, `verificar_certificado`.

### Painel (role `authenticated`)

| Função                                                                     | Uso                                                            |
| -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `tecnico_importar_colaboradores(json)`                                     | Importação em lote do CSV; cria setores                        |
| `tecnico_gerar_pins(ids[])`                                                | Gera PIN provisório e devolve **uma única vez** para impressão |
| `tecnico_desbloquear_colaborador(id)`                                      | Remove bloqueio por tentativas                                 |
| `tecnico_anonimizar_colaborador(id)`                                       | LGPD, só admin                                                 |
| `tecnico_validar_relato(id, decisao, gravidade, comentario, duplicado_de)` | Validar/rejeitar/duplicado                                     |
| `tecnico_atualizar_relato(id, status, comentario, visivel)`                | Andamento até resolvido                                        |
| `tecnico_rotacionar_codigo(evento)`                                        | Código de check-in (a TV chama a cada 60 s)                    |
| `tecnico_salvar_quiz_tv(evento, modo, duracao, equipes, respostas)`        | Salva sessão do Modo TV                                        |
| `tecnico_ativar_campanha(id)` / `tecnico_encerrar_campanha(id, top_n)`     | Ciclo da campanha                                              |
| `comite_responder_denuncia(id, mensagem, status)`                          | Só comitê                                                      |

CRUD comum (setores, locais, perguntas, temas, campanhas, lições, eventos) é feito **direto nas tabelas** pelo supabase-js, protegido por RLS.

### Tratamento de erros no front

- Erro de exceção `sessao_invalida` → apagar token, ir ao login.
- Erro `acesso_negado` → toast "Você não tem permissão para esta ação".
- Resposta `{ ok: false, motivo }` → mapear `motivo` para mensagem amigável (tabela em `TIME_05` §9).

## 4. Storage: fotos dos relatos

Rode no SQL Editor (específico do Supabase):

```sql
insert into storage.buckets (id, name, public) values ('relatos-fotos', 'relatos-fotos', false)
on conflict (id) do nothing;

-- Técnicos leem as fotos da própria empresa (o caminho começa com empresa_id)
create policy "tecnico le fotos da empresa" on storage.objects for select to authenticated
  using (bucket_id = 'relatos-fotos' and (storage.foldername(name))[1] = public.minha_empresa()::text);

-- Ninguém faz upload direto: só a Edge Function, com URL assinada
```

No painel, exibir a foto com `supabase.storage.from('relatos-fotos').createSignedUrl(path, 300)`.

A Edge Function `relato-upload-url` está em `TIME_03_SEGURANCA_LGPD.md` §5.

## 5. Migrações

### 5.1 `0001_time_schema.sql` — Schema completo

```sql
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
```

### 5.2 `0002_time_funcoes_internas.sql` — Funções internas e views

```sql
-- =====================================================================
-- T.I.M.E. Seguro — 0002_time_funcoes_internas.sql
-- Funções auxiliares (prefixo "_" = interna, nunca exposta ao cliente)
-- e views de ranking / lacunas.
-- IMPORTANTE (Supabase): pgcrypto fica no schema "extensions",
-- por isso as funções usam  search_path = public, extensions
-- =====================================================================

-- "Dia operacional": o dia vira às 05h (Brasília), não à meia-noite,
-- para o turno da noite não ter o dia "partido" no meio do expediente.
create or replace function public.dia_operacional() returns date
language sql stable set search_path = public as $$
  select ((now() at time zone 'America/Sao_Paulo') - interval '5 hours')::date
$$;

-- Contexto do técnico logado (Supabase Auth)
create or replace function public.minha_empresa() returns uuid
language sql stable security definer set search_path = public as $$
  select empresa_id from perfis_tecnicos where user_id = auth.uid()
$$;

create or replace function public.meu_papel() returns text
language sql stable security definer set search_path = public as $$
  select papel from perfis_tecnicos where user_id = auth.uid()
$$;

create or replace function public.sou_comite_assedio() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select comite_assedio from perfis_tecnicos where user_id = auth.uid()), false)
$$;

create or replace function public._exigir_tecnico(p_papeis text[] default array['admin','tecnico'])
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_emp uuid;
begin
  select empresa_id into v_emp from perfis_tecnicos where user_id = auth.uid() and papel = any(p_papeis);
  if v_emp is null then
    raise exception 'acesso_negado' using errcode = 'P0001';
  end if;
  return v_emp;
end $$;

-- Lê um número da config da campanha, com valor padrão
create or replace function public._cfg(p_camp public.campanhas, p_chave text, p_padrao int)
returns int language sql immutable as $$
  select coalesce((p_camp.config ->> p_chave)::int, p_padrao)
$$;

-- Valida o token do app do colaborador e devolve o colaborador
create or replace function public._colaborador_da_sessao(p_token text)
returns public.colaboradores
language plpgsql stable security definer set search_path = public, extensions as $$
declare v public.colaboradores;
begin
  select c.* into v
    from sessoes_colaborador s
    join colaboradores c on c.id = s.colaborador_id
   where s.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
     and not s.revogada
     and s.expira_em > now()
     and c.ativo and not c.anonimizado;
  if not found then
    raise exception 'sessao_invalida' using errcode = 'P0001';
  end if;
  return v;
end $$;

-- Motivo pelo qual o colaborador ainda não pode usar o app (null = liberado)
create or replace function public._pendencia(p_colab public.colaboradores)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p_colab.pin_provisorio then 'trocar_pin'
    when coalesce(p_colab.lgpd_aceite_versao, 0) < (select termo_lgpd_versao from empresas where id = p_colab.empresa_id) then 'aceitar_lgpd'
    else null end
$$;

create or replace function public._campanha_ativa(p_empresa uuid)
returns public.campanhas language sql stable security definer set search_path = public as $$
  select * from campanhas
   where empresa_id = p_empresa and status = 'ativa'
     and dia_operacional() between inicio and fim
   limit 1
$$;

-- PIN aleatório de 6 dígitos (criptograficamente seguro)
create or replace function public._pin_aleatorio() returns text
language plpgsql volatile set search_path = public, extensions as $$
declare b bytea := gen_random_bytes(3);
begin
  return lpad((((get_byte(b,0) << 16) | (get_byte(b,1) << 8) | get_byte(b,2)) % 1000000)::text, 6, '0');
end $$;

-- Lança pontos no livro-razão. Idempotente: o mesmo fato nunca pontua 2x.
create or replace function public._lancar_pontos(
  p_campanha uuid, p_colaborador uuid, p_setor uuid,
  p_pilar text, p_origem text, p_origem_id uuid, p_pontos int)
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if p_pontos is null or p_pontos <= 0 then return 0; end if;
  insert into pontos_lancamentos (empresa_id, campanha_id, colaborador_id, setor_id, pilar, origem, origem_id, pontos, dia)
  select c.empresa_id, c.id, p_colaborador, p_setor, p_pilar, p_origem, p_origem_id, p_pontos, dia_operacional()
    from campanhas c where c.id = p_campanha
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return case when v_n > 0 then p_pontos else 0 end;
end $$;

-- Sequência de dias com atividade (fim de semana sem atividade não quebra a sequência)
create or replace function public._streak(p_colab uuid, p_camp uuid, p_dia date, p_ignora_fds boolean)
returns int language plpgsql stable security definer set search_path = public as $$
declare v_d date := p_dia; v_n int := 0; v_guard int := 0; v_tem boolean;
begin
  loop
    v_guard := v_guard + 1;
    exit when v_guard > 400;
    select exists (select 1 from atividade_diaria where colaborador_id = p_colab and campanha_id = p_camp and dia = v_d) into v_tem;
    if not v_tem and p_ignora_fds and extract(isodow from v_d) in (6, 7) then
      v_d := v_d - 1;
      continue;
    end if;
    exit when not v_tem;
    v_n := v_n + 1;
    v_d := v_d - 1;
  end loop;
  return v_n;
end $$;

-- Registra atividade do dia: presença diária + bônus de sequência (7/15/30 dias)
create or replace function public._registrar_atividade(p_colab public.colaboradores, p_camp public.campanhas)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dia date := dia_operacional();
  v_n int; v_streak int; v_bonus int := 0; v_marco int;
begin
  insert into atividade_diaria (empresa_id, colaborador_id, campanha_id, dia)
  values (p_colab.empresa_id, p_colab.id, p_camp.id, v_dia)
  on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('novo_dia', false);
  end if;

  perform _lancar_pontos(p_camp.id, p_colab.id, p_colab.setor_id, 'engajamento', 'presenca_diaria',
                         md5(p_colab.id::text || v_dia::text)::uuid, _cfg(p_camp, 'pontos_presenca', 2));

  v_streak := _streak(p_colab.id, p_camp.id, v_dia, coalesce((p_camp.config ->> 'streak_ignora_fds')::boolean, true));
  foreach v_marco in array array[7, 15, 30] loop
    if v_streak >= v_marco then
      v_bonus := v_bonus + _lancar_pontos(p_camp.id, p_colab.id, p_colab.setor_id, 'engajamento',
                   'streak_' || v_marco, p_camp.id,
                   _cfg(p_camp, 'pontos_streak_' || v_marco, case v_marco when 7 then 20 when 15 then 50 else 100 end));
    end if;
  end loop;
  return jsonb_build_object('novo_dia', true, 'streak', v_streak, 'bonus', v_bonus);
end $$;

-- Avalia e concede selos da campanha. Devolve os slugs recém-conquistados.
create or replace function public._avaliar_selos(p_colab uuid, p_camp uuid)
returns text[] language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid; v_novos text[] := '{}'; r record;
  v_resp int; v_acertos int; v_relatos int; v_dds int; v_streak int;
  v_obrig int; v_aprov int; v_media numeric; v_mestre boolean; v_respeito boolean;
begin
  select empresa_id into v_emp from campanhas where id = p_camp;

  select count(*), count(*) filter (where acertou and origem = 'diario')
    into v_resp, v_acertos
    from respostas where colaborador_id = p_colab and campanha_id = p_camp;

  select count(*) into v_relatos from relatos
   where colaborador_id = p_colab and campanha_id = p_camp and validado;

  select count(*) into v_dds from checkins ch join eventos e on e.id = ch.evento_id
   where ch.colaborador_id = p_colab and e.campanha_id = p_camp and e.tipo = 'dds';

  v_streak := _streak(p_colab, p_camp, dia_operacional(), true);

  select count(*), count(pl.aprovado_em), avg(pl.melhor_nota)
    into v_obrig, v_aprov, v_media
    from licoes l
    left join progresso_licoes pl on pl.licao_id = l.id and pl.colaborador_id = p_colab
   where l.campanha_id = p_camp and l.obrigatoria and l.publicada;
  v_mestre := v_obrig > 0 and v_aprov = v_obrig and coalesce(v_media, 0) >= 90;

  select exists (
    select 1 from progresso_licoes pl
      join licoes l on l.id = pl.licao_id
      join temas t on t.id = l.tema_id
     where pl.colaborador_id = p_colab and l.campanha_id = p_camp
       and pl.aprovado_em is not null and t.slug = 'assedio'
  ) into v_respeito;

  for r in
    select * from (values
      ('primeiro-passo',  v_resp >= 1),
      ('olho-vivo',       v_relatos >= 3),
      ('sentinela',       v_relatos >= 10),
      ('maratonista',     v_acertos >= 100),
      ('dds-em-dia',      v_dds >= 10),
      ('presenca-firme',  v_streak >= 10),
      ('mestre-das-nrs',  v_mestre),
      ('voz-do-respeito', v_respeito)
    ) as t(slug, ok)
  loop
    if r.ok then
      insert into selos_conquistados (empresa_id, selo_id, colaborador_id, campanha_id)
      select v_emp, s.id, p_colab, p_camp from selos s where s.slug = r.slug
      on conflict do nothing;
      if found then v_novos := v_novos || r.slug; end if;
    end if;
  end loop;
  return v_novos;
end $$;

-- Perguntas do dia de um colaborador: determinísticas no dia,
-- priorizando as que ele ainda NÃO acertou na campanha.
create or replace function public._perguntas_do_dia(p_colab uuid, p_camp public.campanhas, p_dia date)
returns setof public.perguntas language sql stable security definer set search_path = public as $$
  select p.* from perguntas p
   where p.status = 'ativa'
     and (p.empresa_id = p_camp.empresa_id or p.empresa_id is null)
     and p.tema_id in (select tema_id from campanha_temas where campanha_id = p_camp.id)
   order by
     exists (select 1 from respostas r
              where r.colaborador_id = p_colab and r.pergunta_id = p.id
                and r.campanha_id = p_camp.id and r.acertou and r.dia < p_dia),
     md5(p_colab::text || p_dia::text || p.id::text)
   limit p_camp.perguntas_por_dia
$$;

-- ---------------------------------------------------------------------
-- VIEWS (security_invoker: respeitam o RLS de quem consulta)
-- ---------------------------------------------------------------------
create or replace view public.v_ranking_individual with (security_invoker = on) as
select l.campanha_id,
       l.colaborador_id,
       c.nome,
       c.matricula,
       c.setor_id,
       sum(l.pontos)::int                                               as total,
       coalesce(sum(l.pontos) filter (where l.pilar = 'conhecimento'), 0)::int as conhecimento,
       coalesce(sum(l.pontos) filter (where l.pilar = 'relatos'), 0)::int      as relatos,
       coalesce(sum(l.pontos) filter (where l.pilar = 'engajamento'), 0)::int  as engajamento,
       max(l.criado_em)                                                  as ultimo_ponto_em
  from pontos_lancamentos l
  join colaboradores c on c.id = l.colaborador_id
 where l.colaborador_id is not null
 group by l.campanha_id, l.colaborador_id, c.nome, c.matricula, c.setor_id;

-- Setor = MÉDIA por colaborador ativo (setor grande não ganha só por tamanho) + pontos do Modo TV
create or replace view public.v_ranking_setor with (security_invoker = on) as
with base as (
  select camp.id as campanha_id, s.id as setor_id, s.nome, s.cor,
         (select count(*) from colaboradores c where c.setor_id = s.id and c.ativo)::int as colaboradores_ativos,
         coalesce((select sum(pontos) from pontos_lancamentos l
                    where l.campanha_id = camp.id and l.setor_id = s.id and l.colaborador_id is not null), 0)::int as pontos_individuais,
         coalesce((select sum(pontos) from pontos_lancamentos l
                    where l.campanha_id = camp.id and l.setor_id = s.id and l.colaborador_id is null), 0)::int as pontos_quiz_tv
    from campanhas camp
    join setores s on s.empresa_id = camp.empresa_id and s.ativo
)
select *, (round(pontos_individuais::numeric / greatest(colaboradores_ativos, 1)) + pontos_quiz_tv)::int as total
  from base;

-- Mapa de lacunas: taxa de acerto por SETOR x TEMA (app + Modo TV)
create or replace view public.v_lacunas with (security_invoker = on) as
with todas as (
  select r.empresa_id, r.campanha_id, c.setor_id, p.tema_id, r.acertou
    from respostas r
    join colaboradores c on c.id = r.colaborador_id
    join perguntas p on p.id = r.pergunta_id
  union all
  select qr.empresa_id, qs.campanha_id, qr.setor_id, p.tema_id, qr.acertou
    from quiz_tv_respostas qr
    join quiz_tv_sessoes qs on qs.id = qr.sessao_id
    join perguntas p on p.id = qr.pergunta_id
)
select empresa_id, campanha_id, setor_id, tema_id,
       count(*)::int                               as tentativas,
       count(*) filter (where acertou)::int        as acertos,
       round(100.0 * count(*) filter (where acertou) / count(*), 1) as taxa_acerto
  from todas
 where setor_id is not null
 group by empresa_id, campanha_id, setor_id, tema_id;

-- Desempenho por pergunta (para "perguntas mais erradas")
create or replace view public.v_desempenho_pergunta with (security_invoker = on) as
select r.empresa_id, r.campanha_id, r.pergunta_id, p.enunciado, p.tema_id,
       count(*)::int as tentativas,
       count(*) filter (where r.acertou)::int as acertos,
       round(100.0 * count(*) filter (where r.acertou) / count(*), 1) as taxa_acerto,
       mode() within group (order by r.alternativa) filter (where not r.acertou) as alternativa_errada_mais_comum
  from respostas r join perguntas p on p.id = r.pergunta_id
 group by r.empresa_id, r.campanha_id, r.pergunta_id, p.enunciado, p.tema_id;
```

### 5.3 `0003_time_rpc_colaborador.sql` — RPCs do app e públicas

```sql
-- =====================================================================
-- T.I.M.E. Seguro — 0003_time_rpc_colaborador.sql
-- RPCs chamadas pelo APP DO COLABORADOR (role anon + token de sessão)
-- e RPCs PÚBLICAS (Canal de Respeito, verificação de certificado).
-- Toda função devolve jsonb { ok: bool, motivo?: text, ... }.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PÚBLICO: dados mínimos da empresa (tela de login / Canal de Respeito)
-- ---------------------------------------------------------------------
create or replace function public.empresa_publica(p_codigo text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('ok', true, 'nome', nome, 'codigo', codigo, 'logo_url', logo_url)
       from empresas where codigo = lower(trim(p_codigo))),
    jsonb_build_object('ok', false, 'motivo', 'empresa_nao_encontrada'))
$$;

-- ---------------------------------------------------------------------
-- LOGIN: código da empresa + matrícula + PIN (6 dígitos)
-- 5 erros seguidos = bloqueio de 15 min. Mensagem de erro sempre igual
-- (não revela se a matrícula existe).
-- ---------------------------------------------------------------------
create or replace function public.colaborador_login(p_empresa_codigo text, p_matricula text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v public.colaboradores; v_token text; v_versao int;
begin
  select c.* into v
    from colaboradores c join empresas e on e.id = c.empresa_id
   where e.codigo = lower(trim(p_empresa_codigo))
     and c.matricula = trim(p_matricula)
     and c.ativo and not c.anonimizado;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'credenciais_invalidas');
  end if;

  if v.bloqueado_ate is not null and v.bloqueado_ate > now() then
    return jsonb_build_object('ok', false, 'motivo', 'bloqueado', 'ate', v.bloqueado_ate);
  end if;

  if v.pin_hash is null or v.pin_hash <> crypt(coalesce(p_pin, ''), v.pin_hash) then
    update colaboradores
       set tentativas_falhas = case when tentativas_falhas + 1 >= 5 then 0 else tentativas_falhas + 1 end,
           bloqueado_ate     = case when tentativas_falhas + 1 >= 5 then now() + interval '15 minutes' else null end
     where id = v.id;
    return jsonb_build_object('ok', false, 'motivo', 'credenciais_invalidas');
  end if;

  update colaboradores set tentativas_falhas = 0, bloqueado_ate = null where id = v.id;

  v_token := encode(gen_random_bytes(32), 'hex');
  insert into sessoes_colaborador (colaborador_id, token_hash, expira_em)
  values (v.id, encode(digest(v_token, 'sha256'), 'hex'), now() + interval '30 days');

  select termo_lgpd_versao into v_versao from empresas where id = v.empresa_id;

  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'nome', v.nome,
    'pendencia', _pendencia(v)
  );
end $$;

create or replace function public.colaborador_logout(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  update sessoes_colaborador set revogada = true
   where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  return jsonb_build_object('ok', true);
end $$;

-- Troca de PIN (obrigatória no 1º acesso). PIN: 6 dígitos, sem repetição
-- (111111) e sem sequência (123456 / 654321).
create or replace function public.colaborador_trocar_pin(p_token text, p_pin_atual text, p_pin_novo text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v public.colaboradores;
begin
  v := _colaborador_da_sessao(p_token);
  if v.pin_hash <> crypt(coalesce(p_pin_atual, ''), v.pin_hash) then
    return jsonb_build_object('ok', false, 'motivo', 'pin_atual_incorreto');
  end if;
  if p_pin_novo !~ '^\d{6}$'
     or p_pin_novo ~ '^(\d)\1{5}$'
     or p_pin_novo in ('012345','123456','234567','345678','456789','987654','876543','765432','654321','543210')
     or p_pin_novo = p_pin_atual then
    return jsonb_build_object('ok', false, 'motivo', 'pin_fraco');
  end if;
  update colaboradores
     set pin_hash = crypt(p_pin_novo, gen_salt('bf', 8)), pin_provisorio = false
   where id = v.id;
  select * into v from colaboradores where id = v.id;
  return jsonb_build_object('ok', true, 'pendencia', _pendencia(v));
end $$;

create or replace function public.colaborador_termo_lgpd(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v public.colaboradores; e public.empresas;
begin
  v := _colaborador_da_sessao(p_token);
  select * into e from empresas where id = v.empresa_id;
  return jsonb_build_object('ok', true, 'empresa', e.nome, 'versao', e.termo_lgpd_versao, 'texto', e.termo_lgpd_texto);
end $$;

create or replace function public.colaborador_aceitar_lgpd(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.colaboradores; v_versao int;
begin
  v := _colaborador_da_sessao(p_token);
  select termo_lgpd_versao into v_versao from empresas where id = v.empresa_id;
  update colaboradores set lgpd_aceite_versao = v_versao, lgpd_aceite_em = now() where id = v.id;
  insert into consentimentos_lgpd (empresa_id, colaborador_id, versao) values (v.empresa_id, v.id, v_versao);
  select * into v from colaboradores where id = v.id;
  return jsonb_build_object('ok', true, 'pendencia', _pendencia(v));
end $$;

-- ---------------------------------------------------------------------
-- HOME DO APP
-- ---------------------------------------------------------------------
create or replace function public.colaborador_resumo(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v public.colaboradores; c public.campanhas; v_dia date := dia_operacional();
  v_pts record; v_pos_ind int; v_pos_setor int; v_setor text;
  v_quiz_resp int; v_quiz_total int; v_lic_aprov int; v_lic_total int;
  v_rel_abertos int; v_rel_valid int;
begin
  v := _colaborador_da_sessao(p_token);
  select nome into v_setor from setores where id = v.setor_id;
  c := _campanha_ativa(v.empresa_id);

  if c.id is null then
    return jsonb_build_object('ok', true, 'nome', v.nome, 'setor', v_setor, 'pendencia', _pendencia(v), 'campanha', null);
  end if;

  select coalesce(sum(pontos), 0)::int as total,
         coalesce(sum(pontos) filter (where pilar = 'conhecimento'), 0)::int as conhecimento,
         coalesce(sum(pontos) filter (where pilar = 'relatos'), 0)::int as relatos,
         coalesce(sum(pontos) filter (where pilar = 'engajamento'), 0)::int as engajamento,
         coalesce(sum(pontos) filter (where dia = v_dia), 0)::int as hoje
    into v_pts
    from pontos_lancamentos where campanha_id = c.id and colaborador_id = v.id;

  if c.ranking_visivel then
    select pos into v_pos_ind from (
      select colaborador_id, rank() over (order by total desc) as pos
        from v_ranking_individual where campanha_id = c.id) x
     where colaborador_id = v.id;
    select pos into v_pos_setor from (
      select setor_id, rank() over (order by total desc) as pos
        from v_ranking_setor where campanha_id = c.id) x
     where setor_id = v.setor_id;
  end if;

  select count(*) into v_quiz_resp from respostas
   where colaborador_id = v.id and dia = v_dia and origem = 'diario';
  select count(*) into v_quiz_total from _perguntas_do_dia(v.id, c, v_dia);

  select count(*) filter (where pl.aprovado_em is not null), count(*)
    into v_lic_aprov, v_lic_total
    from licoes l left join progresso_licoes pl on pl.licao_id = l.id and pl.colaborador_id = v.id
   where l.campanha_id = c.id and l.publicada;

  select count(*) filter (where status in ('aberto','em_analise','em_correcao')),
         count(*) filter (where validado)
    into v_rel_abertos, v_rel_valid
    from relatos where colaborador_id = v.id and campanha_id = c.id;

  return jsonb_build_object(
    'ok', true,
    'nome', v.nome,
    'setor', v_setor,
    'pendencia', _pendencia(v),
    'campanha', jsonb_build_object(
      'id', c.id, 'nome', c.nome, 'inicio', c.inicio, 'fim', c.fim,
      'dias_restantes', greatest(c.fim - v_dia, 0),
      'premiacao', c.premiacao, 'ranking_visivel', c.ranking_visivel),
    'pontos', to_jsonb(v_pts),
    'streak', _streak(v.id, c.id, v_dia, coalesce((c.config ->> 'streak_ignora_fds')::boolean, true)),
    'posicao_individual', v_pos_ind,
    'posicao_setor', v_pos_setor,
    'quiz_hoje', jsonb_build_object('respondidas', v_quiz_resp, 'total', v_quiz_total),
    'licoes', jsonb_build_object('aprovadas', v_lic_aprov, 'total', v_lic_total),
    'relatos', jsonb_build_object('em_andamento', v_rel_abertos, 'validados', v_rel_valid)
  );
end $$;

-- ---------------------------------------------------------------------
-- QUIZ DIÁRIO (o gabarito só volta DEPOIS de responder)
-- ---------------------------------------------------------------------
create or replace function public.colaborador_perguntas_do_dia(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v public.colaboradores; c public.campanhas; v_dia date := dia_operacional(); v_lista jsonb;
begin
  v := _colaborador_da_sessao(p_token);
  if _pendencia(v) is not null then return jsonb_build_object('ok', false, 'motivo', _pendencia(v)); end if;
  c := _campanha_ativa(v.empresa_id);
  if c.id is null then return jsonb_build_object('ok', false, 'motivo', 'sem_campanha'); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', q.id, 'enunciado', q.enunciado, 'alternativas', q.alternativas,
           'tema', t.nome, 'tema_icone', t.icone,
           'respondida', r.id is not null,
           'acertou', r.acertou,
           'alternativa_escolhida', r.alternativa,
           'correta',    case when r.id is not null then q.correta end,
           'explicacao', case when r.id is not null then q.explicacao end
         ) order by q.ordinality), '[]'::jsonb)
    into v_lista
    from _perguntas_do_dia(v.id, c, v_dia) with ordinality as q
    join temas t on t.id = q.tema_id
    left join respostas r on r.colaborador_id = v.id and r.pergunta_id = q.id
                         and r.dia = v_dia and r.origem = 'diario';

  return jsonb_build_object('ok', true, 'dia', v_dia, 'perguntas', v_lista,
                            'pontos_por_acerto', _cfg(c, 'pontos_acerto_diario', 10));
end $$;

create or replace function public.colaborador_responder_pergunta(
  p_token text, p_pergunta_id uuid, p_alternativa int, p_tempo_ms int default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v public.colaboradores; c public.campanhas; p public.perguntas;
  v_dia date := dia_operacional(); v_ok boolean; v_resp_id uuid; v_pts int := 0;
  v_ativ jsonb; v_selos text[];
begin
  v := _colaborador_da_sessao(p_token);
  if _pendencia(v) is not null then return jsonb_build_object('ok', false, 'motivo', _pendencia(v)); end if;
  c := _campanha_ativa(v.empresa_id);
  if c.id is null then return jsonb_build_object('ok', false, 'motivo', 'sem_campanha'); end if;

  if not exists (select 1 from _perguntas_do_dia(v.id, c, v_dia) q where q.id = p_pergunta_id) then
    return jsonb_build_object('ok', false, 'motivo', 'pergunta_invalida');
  end if;
  select * into p from perguntas where id = p_pergunta_id;
  if p_alternativa is null or p_alternativa < 0 or p_alternativa >= array_length(p.alternativas, 1) then
    return jsonb_build_object('ok', false, 'motivo', 'alternativa_invalida');
  end if;

  v_ok := (p_alternativa = p.correta);
  insert into respostas (empresa_id, campanha_id, colaborador_id, pergunta_id, origem, alternativa, acertou, tempo_ms, dia)
  values (v.empresa_id, c.id, v.id, p.id, 'diario', p_alternativa, v_ok, greatest(coalesce(p_tempo_ms, 0), 0), v_dia)
  on conflict (colaborador_id, pergunta_id, dia) where origem = 'diario' do nothing
  returning id into v_resp_id;

  if v_resp_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'ja_respondida', 'correta', p.correta, 'explicacao', p.explicacao);
  end if;

  v_ativ := _registrar_atividade(v, c);
  if v_ok then
    v_pts := _lancar_pontos(c.id, v.id, v.setor_id, 'conhecimento', 'quiz_diario', v_resp_id,
                            _cfg(c, 'pontos_acerto_diario', 10));
  end if;
  v_selos := _avaliar_selos(v.id, c.id);

  return jsonb_build_object('ok', true, 'acertou', v_ok, 'correta', p.correta, 'explicacao', p.explicacao,
                            'pontos', v_pts, 'atividade', v_ativ, 'novos_selos', to_jsonb(v_selos));
end $$;

-- ---------------------------------------------------------------------
-- TRILHA DE TREINAMENTOS (lições + avaliação)
-- ---------------------------------------------------------------------
create or replace function public.colaborador_trilha(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v public.colaboradores; c public.campanhas; v_lista jsonb;
begin
  v := _colaborador_da_sessao(p_token);
  if _pendencia(v) is not null then return jsonb_build_object('ok', false, 'motivo', _pendencia(v)); end if;
  c := _campanha_ativa(v.empresa_id);
  if c.id is null then return jsonb_build_object('ok', false, 'motivo', 'sem_campanha'); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', l.id, 'titulo', l.titulo, 'tema', t.nome, 'tema_icone', t.icone,
           'carga_minutos', l.carga_minutos, 'obrigatoria', l.obrigatoria, 'nota_minima', l.nota_minima,
           'conteudo_concluido', pl.conteudo_concluido_em is not null,
           'melhor_nota', pl.melhor_nota,
           'aprovado', pl.aprovado_em is not null
         ) order by l.ordem, l.criado_em), '[]'::jsonb)
    into v_lista
    from licoes l
    left join temas t on t.id = l.tema_id
    left join progresso_licoes pl on pl.licao_id = l.id and pl.colaborador_id = v.id
   where l.campanha_id = c.id and l.publicada;

  return jsonb_build_object('ok', true, 'licoes', v_lista);
end $$;

create or replace function public.colaborador_licao(p_token text, p_licao uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v public.colaboradores; c public.campanhas; l public.licoes; pl public.progresso_licoes; v_perg jsonb;
begin
  v := _colaborador_da_sessao(p_token);
  if _pendencia(v) is not null then return jsonb_build_object('ok', false, 'motivo', _pendencia(v)); end if;
  c := _campanha_ativa(v.empresa_id);
  select * into l from licoes where id = p_licao and campanha_id = c.id and publicada;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'licao_invalida'); end if;
  select * into pl from progresso_licoes where licao_id = l.id and colaborador_id = v.id;

  -- perguntas da avaliação, SEM gabarito, só depois de concluir o conteúdo
  if pl.conteudo_concluido_em is not null then
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'enunciado', p.enunciado, 'alternativas', p.alternativas)
                              order by lp.ordem), '[]'::jsonb)
      into v_perg
      from licao_perguntas lp join perguntas p on p.id = lp.pergunta_id
     where lp.licao_id = l.id and p.status = 'ativa';
  end if;

  return jsonb_build_object('ok', true,
    'licao', jsonb_build_object('id', l.id, 'titulo', l.titulo, 'conteudo_md', l.conteudo_md,
                                'video_url', l.video_url, 'carga_minutos', l.carga_minutos,
                                'nota_minima', l.nota_minima),
    'progresso', jsonb_build_object('conteudo_concluido', pl.conteudo_concluido_em is not null,
                                    'melhor_nota', pl.melhor_nota, 'aprovado', pl.aprovado_em is not null,
                                    'tentativas_hoje', case when pl.ultima_tentativa_dia = dia_operacional() then pl.tentativas_hoje else 0 end),
    'avaliacao', v_perg);
end $$;

create or replace function public.colaborador_concluir_conteudo(p_token text, p_licao uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.colaboradores; c public.campanhas; l public.licoes; v_pts int;
begin
  v := _colaborador_da_sessao(p_token);
  if _pendencia(v) is not null then return jsonb_build_object('ok', false, 'motivo', _pendencia(v)); end if;
  c := _campanha_ativa(v.empresa_id);
  select * into l from licoes where id = p_licao and campanha_id = c.id and publicada;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'licao_invalida'); end if;

  insert into progresso_licoes (empresa_id, licao_id, colaborador_id, conteudo_concluido_em)
  values (v.empresa_id, l.id, v.id, now())
  on conflict (licao_id, colaborador_id)
  do update set conteudo_concluido_em = coalesce(progresso_licoes.conteudo_concluido_em, excluded.conteudo_concluido_em);

  perform _registrar_atividade(v, c);
  v_pts := _lancar_pontos(c.id, v.id, v.setor_id, 'conhecimento', 'licao_conteudo', l.id, _cfg(c, 'pontos_licao_conteudo', 20));
  return jsonb_build_object('ok', true, 'pontos', v_pts, 'novos_selos', to_jsonb(_avaliar_selos(v.id, c.id)));
end $$;

-- p_respostas: [{ "pergunta_id": uuid, "alternativa": int, "tempo_ms": int }]
-- O servidor corrige. Máx. 3 tentativas por dia. Pontua só na 1ª aprovação.
create or replace function public.colaborador_enviar_avaliacao(p_token text, p_licao uuid, p_respostas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v public.colaboradores; c public.campanhas; l public.licoes; pl public.progresso_licoes;
  v_dia date := dia_operacional(); v_total int; v_acertos int := 0; v_nota int;
  v_aprovado boolean; v_pts int := 0; v_gabarito jsonb := '[]'::jsonb; r record; v_alt int; v_ok boolean;
begin
  v := _colaborador_da_sessao(p_token);
  if _pendencia(v) is not null then return jsonb_build_object('ok', false, 'motivo', _pendencia(v)); end if;
  c := _campanha_ativa(v.empresa_id);
  select * into l from licoes where id = p_licao and campanha_id = c.id and publicada;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'licao_invalida'); end if;

  select * into pl from progresso_licoes where licao_id = l.id and colaborador_id = v.id for update;
  if pl.conteudo_concluido_em is null then
    return jsonb_build_object('ok', false, 'motivo', 'conteudo_nao_concluido');
  end if;
  if pl.ultima_tentativa_dia = v_dia and pl.tentativas_hoje >= _cfg(c, 'tentativas_avaliacao_dia', 3) then
    return jsonb_build_object('ok', false, 'motivo', 'limite_tentativas');
  end if;

  select count(*) into v_total from licao_perguntas lp join perguntas p on p.id = lp.pergunta_id
   where lp.licao_id = l.id and p.status = 'ativa';
  if v_total = 0 then return jsonb_build_object('ok', false, 'motivo', 'sem_avaliacao'); end if;

  for r in
    select p.id, p.correta, p.explicacao from licao_perguntas lp join perguntas p on p.id = lp.pergunta_id
     where lp.licao_id = l.id and p.status = 'ativa' order by lp.ordem
  loop
    select (e ->> 'alternativa')::int into v_alt
      from jsonb_array_elements(coalesce(p_respostas, '[]'::jsonb)) e
     where (e ->> 'pergunta_id')::uuid = r.id limit 1;
    v_ok := v_alt is not null and v_alt = r.correta;
    if v_ok then v_acertos := v_acertos + 1; end if;
    if v_alt is not null then
      insert into respostas (empresa_id, campanha_id, colaborador_id, pergunta_id, origem, licao_id, alternativa, acertou, dia)
      values (v.empresa_id, c.id, v.id, r.id, 'licao', l.id, v_alt, v_ok, v_dia);
    end if;
    v_gabarito := v_gabarito || jsonb_build_object('pergunta_id', r.id, 'correta', r.correta,
                                                   'escolhida', v_alt, 'acertou', v_ok, 'explicacao', r.explicacao);
  end loop;

  v_nota := round(100.0 * v_acertos / v_total);
  v_aprovado := v_nota >= l.nota_minima;

  update progresso_licoes set
    tentativas = tentativas + 1,
    tentativas_hoje = case when ultima_tentativa_dia = v_dia then tentativas_hoje + 1 else 1 end,
    ultima_tentativa_dia = v_dia,
    melhor_nota = greatest(coalesce(melhor_nota, 0), v_nota),
    aprovado_em = case when v_aprovado and aprovado_em is null then now() else aprovado_em end
  where id = pl.id;

  perform _registrar_atividade(v, c);
  if v_aprovado then
    v_pts := _lancar_pontos(c.id, v.id, v.setor_id, 'conhecimento', 'licao_aprovada', l.id,
                            _cfg(c, 'pontos_licao_aprovada', 30));
    if v_nota = 100 then
      v_pts := v_pts + _lancar_pontos(c.id, v.id, v.setor_id, 'conhecimento', 'licao_nota_maxima', l.id,
                                      _cfg(c, 'pontos_licao_nota_maxima', 10));
    end if;
  end if;

  return jsonb_build_object('ok', true, 'nota', v_nota, 'aprovado', v_aprovado, 'pontos', v_pts,
                            'gabarito', v_gabarito, 'novos_selos', to_jsonb(_avaliar_selos(v.id, c.id)));
end $$;

-- ---------------------------------------------------------------------
-- CHECK-IN EM DDS / SIPAT (QR Code com código que muda a cada 60 s na TV)
-- ---------------------------------------------------------------------
create or replace function public.colaborador_checkin(p_token text, p_evento uuid, p_codigo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.colaboradores; c public.campanhas; e public.eventos; v_id uuid; v_pts int := 0;
begin
  v := _colaborador_da_sessao(p_token);
  if _pendencia(v) is not null then return jsonb_build_object('ok', false, 'motivo', _pendencia(v)); end if;
  select * into e from eventos where id = p_evento and empresa_id = v.empresa_id and status <> 'cancelado';
  if not found then return jsonb_build_object('ok', false, 'motivo', 'evento_invalido'); end if;
  if now() not between e.inicio - interval '30 minutes' and e.fim + interval '30 minutes' then
    return jsonb_build_object('ok', false, 'motivo', 'fora_do_horario');
  end if;
  if e.setor_id is not null and e.setor_id is distinct from v.setor_id then
    return jsonb_build_object('ok', false, 'motivo', 'outro_setor');
  end if;
  if upper(trim(coalesce(p_codigo, ''))) is distinct from e.codigo_checkin
     and not coalesce(upper(trim(p_codigo)) = e.codigo_anterior
                      and e.codigo_atualizado_em > now() - interval '3 minutes', false) then
    return jsonb_build_object('ok', false, 'motivo', 'codigo_expirado');
  end if;

  insert into checkins (empresa_id, evento_id, colaborador_id) values (v.empresa_id, e.id, v.id)
  on conflict do nothing returning id into v_id;
  if v_id is null then return jsonb_build_object('ok', false, 'motivo', 'ja_fez_checkin'); end if;

  if e.campanha_id is not null then
    select * into c from campanhas where id = e.campanha_id and status = 'ativa';
    if c.id is not null then
      perform _registrar_atividade(v, c);
      v_pts := _lancar_pontos(c.id, v.id, v.setor_id, 'engajamento', 'checkin', e.id, e.pontos);
      perform _avaliar_selos(v.id, c.id);
    end if;
  end if;
  return jsonb_build_object('ok', true, 'evento', e.titulo, 'pontos', v_pts);
end $$;

-- ---------------------------------------------------------------------
-- RELATOS (a foto sobe depois, via Edge Function "relato-upload-url")
-- ---------------------------------------------------------------------
create or replace function public.colaborador_criar_relato(
  p_token text, p_categoria text, p_descricao text, p_local uuid default null, p_setor uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v public.colaboradores; c public.campanhas; v_setor uuid; v_dup uuid; v_id uuid; v_hoje int;
begin
  v := _colaborador_da_sessao(p_token);
  if _pendencia(v) is not null then return jsonb_build_object('ok', false, 'motivo', _pendencia(v)); end if;
  if p_categoria not in ('condicao_insegura','ato_inseguro','quase_acidente','melhoria') then
    return jsonb_build_object('ok', false, 'motivo', 'categoria_invalida');
  end if;
  if char_length(coalesce(trim(p_descricao), '')) < 10 then
    return jsonb_build_object('ok', false, 'motivo', 'descricao_curta');
  end if;

  select count(*) into v_hoje from relatos
   where colaborador_id = v.id and criado_em > now() - interval '24 hours';
  if v_hoje >= 10 then return jsonb_build_object('ok', false, 'motivo', 'limite_diario'); end if;

  if p_local is not null then
    select setor_id into v_setor from locais where id = p_local and empresa_id = v.empresa_id and ativo;
    if v_setor is null then return jsonb_build_object('ok', false, 'motivo', 'local_invalido'); end if;
  else
    select id into v_setor from setores where id = coalesce(p_setor, v.setor_id) and empresa_id = v.empresa_id;
  end if;

  -- possível duplicado: mesmo local (ou setor) + mesma categoria, últimos 7 dias, ainda não descartado
  select id into v_dup from relatos
   where empresa_id = v.empresa_id and categoria = p_categoria
     and criado_em > now() - interval '7 days'
     and status not in ('rejeitado','duplicado','resolvido')
     and ((p_local is not null and local_id = p_local) or (p_local is null and local_id is null and setor_id = v_setor))
   order by criado_em limit 1;

  c := _campanha_ativa(v.empresa_id);
  insert into relatos (empresa_id, campanha_id, colaborador_id, setor_id, local_id, categoria, descricao, possivel_duplicado_de)
  values (v.empresa_id, c.id, v.id, v_setor, p_local, p_categoria, trim(p_descricao), v_dup)
  returning id into v_id;

  insert into relato_historico (empresa_id, relato_id, status, comentario)
  values (v.empresa_id, v_id, 'aberto', 'Relato enviado pelo colaborador.');

  if c.id is not null then perform _registrar_atividade(v, c); end if;
  return jsonb_build_object('ok', true, 'relato_id', v_id);
end $$;

-- Usada SOMENTE pela Edge Function (service_role) para autorizar o upload da foto
create or replace function public._relato_caminho_foto(p_token text, p_relato uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v public.colaboradores; r public.relatos; v_path text;
begin
  v := _colaborador_da_sessao(p_token);
  select * into r from relatos where id = p_relato and colaborador_id = v.id;
  if not found or r.foto_path is not null or r.criado_em < now() - interval '30 minutes' then
    raise exception 'upload_nao_permitido' using errcode = 'P0001';
  end if;
  v_path := r.empresa_id::text || '/' || r.id::text || '.jpg';
  update relatos set foto_path = v_path where id = r.id;
  return v_path;
end $$;

create or replace function public.colaborador_meus_relatos(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v public.colaboradores; v_lista jsonb;
begin
  v := _colaborador_da_sessao(p_token);
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'categoria', r.categoria, 'descricao', r.descricao, 'status', r.status,
           'validado', r.validado, 'criado_em', r.criado_em, 'local', lo.nome, 'tem_foto', r.foto_path is not null,
           'historico', (select coalesce(jsonb_agg(jsonb_build_object('status', h.status, 'comentario', h.comentario, 'em', h.criado_em)
                                                   order by h.criado_em), '[]'::jsonb)
                           from relato_historico h where h.relato_id = r.id and h.visivel_colaborador)
         ) order by r.criado_em desc), '[]'::jsonb)
    into v_lista
    from relatos r left join locais lo on lo.id = r.local_id
   where r.colaborador_id = v.id;
  return jsonb_build_object('ok', true, 'relatos', v_lista);
end $$;

-- Ao escanear o QR de um LOCAL: dados para pré-preencher o relato
create or replace function public.colaborador_local(p_token text, p_local uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v public.colaboradores; v_res jsonb;
begin
  v := _colaborador_da_sessao(p_token);
  select jsonb_build_object('ok', true, 'id', l.id, 'nome', l.nome, 'descricao', l.descricao, 'setor', s.nome)
    into v_res
    from locais l join setores s on s.id = l.setor_id
   where l.id = p_local and l.empresa_id = v.empresa_id and l.ativo;
  return coalesce(v_res, jsonb_build_object('ok', false, 'motivo', 'local_invalido'));
end $$;

-- ---------------------------------------------------------------------
-- RANKING E PERFIL
-- ---------------------------------------------------------------------
-- Nome no ranking: "Primeiro nome + inicial" (ex.: "Carlos S.")
create or replace function public._nome_curto(p_nome text) returns text
language sql immutable as $$
  select split_part(trim(p_nome), ' ', 1)
         || case when position(' ' in trim(p_nome)) > 0
                 then ' ' || left(split_part(trim(p_nome), ' ', array_length(string_to_array(trim(p_nome), ' '), 1)), 1) || '.'
                 else '' end
$$;

create or replace function public.colaborador_ranking(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v public.colaboradores; c public.campanhas; v_ind jsonb; v_setor jsonb; v_meu jsonb;
begin
  v := _colaborador_da_sessao(p_token);
  c := _campanha_ativa(v.empresa_id);
  if c.id is null then return jsonb_build_object('ok', false, 'motivo', 'sem_campanha'); end if;
  if not c.ranking_visivel then return jsonb_build_object('ok', false, 'motivo', 'ranking_oculto'); end if;

  with rk as (
    select ri.*, rank() over (order by total desc) as pos from v_ranking_individual ri where campanha_id = c.id)
  select coalesce(jsonb_agg(jsonb_build_object('posicao', rk.pos, 'nome', _nome_curto(rk.nome), 'setor', s.nome,
                                               'total', rk.total, 'eu', rk.colaborador_id = v.id) order by rk.pos), '[]'::jsonb)
    into v_ind
    from (select * from rk order by pos limit 10) rk left join setores s on s.id = rk.setor_id;

  with rk as (
    select ri.*, rank() over (order by total desc) as pos from v_ranking_individual ri where campanha_id = c.id)
  select jsonb_build_object('posicao', pos, 'total', total) into v_meu from rk where colaborador_id = v.id;

  select coalesce(jsonb_agg(jsonb_build_object('posicao', pos, 'setor', nome, 'total', total,
                                               'meu_setor', setor_id = v.setor_id) order by pos), '[]'::jsonb)
    into v_setor
    from (select rs.*, rank() over (order by total desc) as pos from v_ranking_setor rs where campanha_id = c.id) x;

  return jsonb_build_object('ok', true, 'top10', v_ind, 'eu', v_meu, 'setores', v_setor);
end $$;

create or replace function public.colaborador_perfil(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v public.colaboradores; c public.campanhas; v_selos jsonb; v_extrato jsonb; v_cert jsonb;
begin
  v := _colaborador_da_sessao(p_token);
  c := _campanha_ativa(v.empresa_id);

  select coalesce(jsonb_agg(jsonb_build_object('slug', s.slug, 'nome', s.nome, 'descricao', s.descricao, 'icone', s.icone,
                                               'conquistado', sc.id is not null, 'em', sc.conquistado_em) order by s.ordem), '[]'::jsonb)
    into v_selos
    from selos s
    left join selos_conquistados sc on sc.selo_id = s.id and sc.colaborador_id = v.id and sc.campanha_id = c.id;

  select coalesce(jsonb_agg(x order by (x ->> 'em') desc), '[]'::jsonb) into v_extrato from (
    select jsonb_build_object('pilar', pilar, 'origem', origem, 'pontos', pontos, 'em', criado_em) as x
      from pontos_lancamentos where colaborador_id = v.id and campanha_id = c.id
     order by criado_em desc limit 50) t;

  select coalesce(jsonb_agg(jsonb_build_object('id', ce.id, 'tipo', ce.tipo, 'titulo', ce.titulo, 'codigo', ce.codigo,
                                               'emitido_em', ce.emitido_em, 'carga_minutos', ce.carga_minutos,
                                               'campanha', ca.nome, 'dados', ce.dados) order by ce.emitido_em desc), '[]'::jsonb)
    into v_cert
    from certificados ce join campanhas ca on ca.id = ce.campanha_id
   where ce.colaborador_id = v.id;

  return jsonb_build_object('ok', true, 'nome', v.nome, 'matricula', v.matricula,
                            'selos', v_selos, 'extrato', v_extrato, 'certificados', v_cert);
end $$;

-- ---------------------------------------------------------------------
-- CANAL DE RESPEITO (anônimo) — NÃO recebe token, NÃO pontua,
-- NÃO grava hora/IP/aparelho. Devolve protocolo + senha UMA vez.
-- ---------------------------------------------------------------------
create or replace function public.registrar_denuncia_assedio(
  p_empresa_codigo text, p_categoria text, p_descricao text,
  p_local text default null, p_periodo text default null, p_quer_retorno boolean default true)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_emp uuid; v_protocolo text; v_senha text;
begin
  select id into v_emp from empresas where codigo = lower(trim(p_empresa_codigo));
  if v_emp is null then return jsonb_build_object('ok', false, 'motivo', 'empresa_nao_encontrada'); end if;
  if p_categoria not in ('moral','sexual','discriminacao','outro') then
    return jsonb_build_object('ok', false, 'motivo', 'categoria_invalida');
  end if;
  if char_length(coalesce(trim(p_descricao), '')) < 20 then
    return jsonb_build_object('ok', false, 'motivo', 'descricao_curta');
  end if;

  loop
    v_protocolo := 'RS-' || upper(encode(gen_random_bytes(4), 'hex'));
    exit when not exists (select 1 from denuncias_assedio where protocolo = v_protocolo);
  end loop;
  v_senha := upper(encode(gen_random_bytes(4), 'hex'));

  insert into denuncias_assedio (empresa_id, protocolo, senha_hash, categoria, descricao, local_aproximado, periodo_aproximado, quer_retorno)
  values (v_emp, v_protocolo, crypt(v_senha, gen_salt('bf', 8)), p_categoria, trim(p_descricao),
          nullif(trim(p_local), ''), nullif(trim(p_periodo), ''), coalesce(p_quer_retorno, true));

  return jsonb_build_object('ok', true, 'protocolo', v_protocolo, 'senha', v_senha);
end $$;

create or replace function public.consultar_denuncia(p_protocolo text, p_senha text)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare d public.denuncias_assedio; v_msgs jsonb;
begin
  select * into d from denuncias_assedio where protocolo = upper(trim(p_protocolo));
  if not found or d.senha_hash <> crypt(upper(trim(coalesce(p_senha, ''))), d.senha_hash) then
    return jsonb_build_object('ok', false, 'motivo', 'protocolo_ou_senha_invalidos');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('autor', autor, 'mensagem', mensagem, 'em', enviada_em) order by ordem), '[]'::jsonb)
    into v_msgs from denuncia_mensagens where denuncia_id = d.id;
  return jsonb_build_object('ok', true, 'status', d.status, 'recebida_em', d.recebida_em, 'mensagens', v_msgs);
end $$;

create or replace function public.responder_denuncia_denunciante(p_protocolo text, p_senha text, p_mensagem text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare d public.denuncias_assedio;
begin
  select * into d from denuncias_assedio where protocolo = upper(trim(p_protocolo));
  if not found or d.senha_hash <> crypt(upper(trim(coalesce(p_senha, ''))), d.senha_hash) then
    return jsonb_build_object('ok', false, 'motivo', 'protocolo_ou_senha_invalidos');
  end if;
  if d.status in ('concluida','arquivada') then return jsonb_build_object('ok', false, 'motivo', 'denuncia_encerrada'); end if;
  insert into denuncia_mensagens (empresa_id, denuncia_id, autor, mensagem)
  values (d.empresa_id, d.id, 'denunciante', trim(p_mensagem));
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------
-- VERIFICAÇÃO PÚBLICA DE CERTIFICADO
-- ---------------------------------------------------------------------
create or replace function public.verificar_certificado(p_codigo text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('ok', true, 'titulo', ce.titulo, 'tipo', ce.tipo,
                               'colaborador', _nome_curto(co.nome), 'empresa', e.nome, 'campanha', ca.nome,
                               'carga_minutos', ce.carga_minutos, 'emitido_em', ce.emitido_em)
       from certificados ce
       join empresas e on e.id = ce.empresa_id
       join campanhas ca on ca.id = ce.campanha_id
       left join colaboradores co on co.id = ce.colaborador_id
      where ce.codigo = upper(trim(p_codigo))),
    jsonb_build_object('ok', false, 'motivo', 'certificado_nao_encontrado'))
$$;
```

### 5.4 `0004_time_rpc_tecnico.sql` — RPCs do painel e do comitê

```sql
-- =====================================================================
-- T.I.M.E. Seguro — 0004_time_rpc_tecnico.sql
-- RPCs do PAINEL DO TÉCNICO (role authenticated / Supabase Auth).
-- CRUD simples (setores, locais, perguntas, lições, eventos...) é feito
-- direto nas tabelas via RLS. Aqui ficam as operações que mexem em
-- PIN, pontuação ou regras de negócio.
-- =====================================================================

-- Gera PIN provisório (6 dígitos) para colaboradores. O PIN puro só é
-- devolvido AQUI, uma única vez, para impressão dos cartões de acesso.
create or replace function public.tecnico_gerar_pins(p_colaboradores uuid[])
returns table (colaborador_id uuid, matricula text, nome text, setor text, pin text)
language plpgsql security definer set search_path = public, extensions as $$
declare v_emp uuid := _exigir_tecnico(); r record; v_pin text;
begin
  for r in
    select c.id, c.matricula, c.nome, s.nome as setor_nome
      from colaboradores c left join setores s on s.id = c.setor_id
     where c.empresa_id = v_emp and c.id = any(p_colaboradores) and c.ativo and not c.anonimizado
     order by s.nome, c.nome
  loop
    v_pin := _pin_aleatorio();
    update colaboradores
       set pin_hash = crypt(v_pin, gen_salt('bf', 8)), pin_provisorio = true,
           tentativas_falhas = 0, bloqueado_ate = null
     where id = r.id;
    update sessoes_colaborador set revogada = true where sessoes_colaborador.colaborador_id = r.id;
    colaborador_id := r.id; matricula := r.matricula; nome := r.nome; setor := r.setor_nome; pin := v_pin;
    return next;
  end loop;
end $$;

-- Importação em lote (CSV já convertido em JSON pelo front):
-- [{ "matricula": "123", "nome": "Fulano", "setor": "Manutenção", "turno": "A" }]
-- Cria setores inexistentes. Devolve os ids NOVOS (para gerar PIN em seguida).
create or replace function public.tecnico_importar_colaboradores(p_linhas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp uuid := _exigir_tecnico(); r jsonb; v_setor uuid; v_id uuid; v_novo boolean;
        v_novos uuid[] := '{}'; v_atualizados int := 0; v_erros jsonb := '[]'::jsonb; v_linha int := 0;
begin
  for r in select * from jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) loop
    v_linha := v_linha + 1;
    if coalesce(trim(r ->> 'matricula'), '') = '' or coalesce(trim(r ->> 'nome'), '') = '' then
      v_erros := v_erros || jsonb_build_object('linha', v_linha, 'erro', 'matricula_ou_nome_vazio');
      continue;
    end if;
    v_setor := null;
    if coalesce(trim(r ->> 'setor'), '') <> '' then
      insert into setores (empresa_id, nome) values (v_emp, trim(r ->> 'setor'))
      on conflict (empresa_id, nome) do update set nome = excluded.nome
      returning id into v_setor;
    end if;
    insert into colaboradores (empresa_id, matricula, nome, setor_id, turno)
    values (v_emp, trim(r ->> 'matricula'), trim(r ->> 'nome'), v_setor, nullif(trim(r ->> 'turno'), ''))
    on conflict (empresa_id, matricula) do update
      set nome = excluded.nome,
          setor_id = coalesce(excluded.setor_id, colaboradores.setor_id),
          turno = coalesce(excluded.turno, colaboradores.turno),
          ativo = true
    returning id, (xmax = 0) into v_id, v_novo;
    if v_novo then v_novos := v_novos || v_id; else v_atualizados := v_atualizados + 1; end if;
  end loop;
  return jsonb_build_object('ok', true, 'novos', to_jsonb(v_novos), 'atualizados', v_atualizados, 'erros', v_erros);
end $$;

create or replace function public.tecnico_desbloquear_colaborador(p_colaborador uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp uuid := _exigir_tecnico();
begin
  update colaboradores set tentativas_falhas = 0, bloqueado_ate = null
   where id = p_colaborador and empresa_id = v_emp;
  return jsonb_build_object('ok', true);
end $$;

-- LGPD: direito de exclusão. Mantém os fatos (relatos, pontos) mas remove a identificação.
create or replace function public.tecnico_anonimizar_colaborador(p_colaborador uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp uuid := _exigir_tecnico(array['admin']);
begin
  update colaboradores
     set nome = 'Colaborador anonimizado',
         matricula = 'anon-' || left(id::text, 8),
         pin_hash = null, ativo = false, anonimizado = true, turno = null
   where id = p_colaborador and empresa_id = v_emp;
  delete from sessoes_colaborador where colaborador_id = p_colaborador;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------
-- RELATOS
-- p_decisao: 'validar' | 'rejeitar' | 'duplicado'
-- Só relato VALIDADO pontua. Limite semanal de relatos pontuados.
-- ---------------------------------------------------------------------
create or replace function public.tecnico_validar_relato(
  p_relato uuid, p_decisao text, p_gravidade text default null,
  p_comentario text default null, p_duplicado_de uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid := _exigir_tecnico(); r public.relatos; c public.campanhas; co public.colaboradores;
  v_pts int := 0; v_semana int; v_status text; v_msg text;
begin
  select * into r from relatos where id = p_relato and empresa_id = v_emp for update;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'relato_invalido'); end if;
  if r.validado or r.status in ('rejeitado','duplicado') then
    return jsonb_build_object('ok', false, 'motivo', 'ja_decidido');
  end if;

  if p_decisao = 'validar' then
    if p_gravidade not in ('baixa','media','alta') then
      return jsonb_build_object('ok', false, 'motivo', 'gravidade_obrigatoria');
    end if;
    update relatos set validado = true, gravidade = p_gravidade, validado_por = auth.uid(), validado_em = now(),
                       status = case when status = 'aberto' then 'em_analise' else status end
     where id = r.id;
    v_status := case when r.status = 'aberto' then 'em_analise' else r.status end;
    v_msg := coalesce(p_comentario, 'Relato validado pelo técnico de SST. Obrigado por cuidar de todos!');

    select * into c from campanhas where id = r.campanha_id and status = 'ativa';
    select * into co from colaboradores where id = r.colaborador_id;
    if c.id is not null and co.id is not null then
      select count(*) into v_semana from pontos_lancamentos
       where colaborador_id = co.id and campanha_id = c.id and origem = 'relato_validado'
         and date_trunc('week', criado_em) = date_trunc('week', now());
      if v_semana < _cfg(c, 'max_relatos_pontuados_semana', 5) then
        v_pts := _lancar_pontos(c.id, co.id, co.setor_id, 'relatos', 'relato_validado', r.id,
                   case p_gravidade
                     when 'alta'  then _cfg(c, 'pontos_relato_alta', 50)
                     when 'media' then _cfg(c, 'pontos_relato_media', 40)
                     else              _cfg(c, 'pontos_relato_baixa', 30) end);
      end if;
      perform _avaliar_selos(co.id, c.id);
    end if;

  elsif p_decisao = 'rejeitar' then
    update relatos set status = 'rejeitado' where id = r.id;
    v_status := 'rejeitado';
    v_msg := coalesce(p_comentario, 'Relato não validado.');

  elsif p_decisao = 'duplicado' then
    update relatos set status = 'duplicado', duplicado_de = coalesce(p_duplicado_de, r.possivel_duplicado_de) where id = r.id;
    v_status := 'duplicado';
    v_msg := coalesce(p_comentario, 'Este problema já tinha sido relatado por outro colega e está sendo tratado.');
  else
    return jsonb_build_object('ok', false, 'motivo', 'decisao_invalida');
  end if;

  insert into relato_historico (empresa_id, relato_id, status, comentario, autor_user_id)
  values (v_emp, r.id, v_status, v_msg, auth.uid());
  return jsonb_build_object('ok', true, 'status', v_status, 'pontos', v_pts);
end $$;

-- Andamento: em_analise -> em_correcao -> resolvido. Resolvido dá bônus ao relator.
create or replace function public.tecnico_atualizar_relato(
  p_relato uuid, p_status text, p_comentario text default null, p_visivel boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp uuid := _exigir_tecnico(); r public.relatos; c public.campanhas; co public.colaboradores; v_pts int := 0;
begin
  if p_status not in ('em_analise','em_correcao','resolvido') then
    return jsonb_build_object('ok', false, 'motivo', 'status_invalido');
  end if;
  select * into r from relatos where id = p_relato and empresa_id = v_emp for update;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'relato_invalido'); end if;
  if not r.validado then return jsonb_build_object('ok', false, 'motivo', 'valide_primeiro'); end if;

  update relatos set status = p_status where id = r.id;
  insert into relato_historico (empresa_id, relato_id, status, comentario, autor_user_id, visivel_colaborador)
  values (v_emp, r.id, p_status, p_comentario, auth.uid(), coalesce(p_visivel, true));

  if p_status = 'resolvido' then
    select * into c from campanhas where id = r.campanha_id and status = 'ativa';
    select * into co from colaboradores where id = r.colaborador_id;
    if c.id is not null and co.id is not null then
      v_pts := _lancar_pontos(c.id, co.id, co.setor_id, 'relatos', 'relato_resolvido', r.id, _cfg(c, 'pontos_relato_resolvido', 10));
    end if;
  end if;
  return jsonb_build_object('ok', true, 'pontos', v_pts);
end $$;

-- ---------------------------------------------------------------------
-- EVENTOS: código de check-in rotativo (a tela da TV chama a cada 60 s)
-- ---------------------------------------------------------------------
create or replace function public.tecnico_rotacionar_codigo(p_evento uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_emp uuid := _exigir_tecnico(); v_novo text;
begin
  -- 5 caracteres sem ambiguidades (sem 0/O, 1/I)
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 32), 1), '')
    into v_novo
    from (select gen_random_bytes(5) as b) x, generate_series(0, 4) as i;
  update eventos
     set codigo_anterior = codigo_checkin, codigo_checkin = v_novo, codigo_atualizado_em = now()
   where id = p_evento and empresa_id = v_emp;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'evento_invalido'); end if;
  return jsonb_build_object('ok', true, 'codigo', v_novo);
end $$;

-- ---------------------------------------------------------------------
-- MODO TV: salva a sessão (1 sessão pontuada por evento).
-- p_equipes:   [{ "setor_id": uuid, "pontos": int }]
-- p_respostas: [{ "setor_id": uuid, "pergunta_id": uuid, "alternativa": int, "tempo_ms": int, "ordem": int }]
-- Modo 'classico': o servidor RECALCULA os pontos (acertos x 10).
-- Modos 'duelo'/'eliminacao': aceita os pontos do motor de jogo, com teto.
-- ---------------------------------------------------------------------
create or replace function public.tecnico_salvar_quiz_tv(
  p_evento uuid, p_modo text, p_duracao_ms int, p_equipes jsonb, p_respostas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid := _exigir_tecnico(); e public.eventos; c public.campanhas; v_sessao uuid;
  r jsonb; v_setor uuid; v_acertos int; v_erros int; v_pts int; v_teto int; v_res jsonb := '[]'::jsonb;
begin
  if p_modo not in ('classico','duelo','eliminacao') then return jsonb_build_object('ok', false, 'motivo', 'modo_invalido'); end if;
  select * into e from eventos where id = p_evento and empresa_id = v_emp;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'evento_invalido'); end if;
  if exists (select 1 from quiz_tv_sessoes where evento_id = e.id) then
    return jsonb_build_object('ok', false, 'motivo', 'evento_ja_tem_sessao');
  end if;

  insert into quiz_tv_sessoes (empresa_id, campanha_id, evento_id, modo, duracao_ms, criado_por)
  values (v_emp, e.campanha_id, e.id, p_modo, greatest(coalesce(p_duracao_ms, 0), 0), auth.uid())
  returning id into v_sessao;

  -- grava respostas, corrigindo pelo gabarito do banco
  insert into quiz_tv_respostas (empresa_id, sessao_id, setor_id, pergunta_id, alternativa, acertou, tempo_ms, ordem)
  select v_emp, v_sessao, (x ->> 'setor_id')::uuid, p.id, (x ->> 'alternativa')::int,
         (x ->> 'alternativa')::int = p.correta, coalesce((x ->> 'tempo_ms')::int, 0), coalesce((x ->> 'ordem')::int, 0)
    from jsonb_array_elements(coalesce(p_respostas, '[]'::jsonb)) x
    join perguntas p on p.id = (x ->> 'pergunta_id')::uuid
                    and (p.empresa_id = v_emp or p.empresa_id is null);

  select * into c from campanhas where id = e.campanha_id and status = 'ativa';

  for r in select * from jsonb_array_elements(coalesce(p_equipes, '[]'::jsonb)) loop
    v_setor := (r ->> 'setor_id')::uuid;
    if not exists (select 1 from setores where id = v_setor and empresa_id = v_emp) then continue; end if;
    select count(*) filter (where acertou), count(*) filter (where not acertou)
      into v_acertos, v_erros from quiz_tv_respostas where sessao_id = v_sessao and setor_id = v_setor;
    v_teto := (select count(*) from quiz_tv_respostas where sessao_id = v_sessao) * 10 + 100;
    v_pts := case when p_modo = 'classico' then v_acertos * 10
                  else least(greatest(coalesce((r ->> 'pontos')::int, 0), 0), v_teto) end;

    insert into quiz_tv_equipes (sessao_id, empresa_id, setor_id, pontos, acertos, erros)
    values (v_sessao, v_emp, v_setor, v_pts, v_acertos, v_erros);

    if c.id is not null then
      perform _lancar_pontos(c.id, null, v_setor, 'quiz_tv', 'quiz_tv', v_sessao, v_pts);
    end if;
    v_res := v_res || jsonb_build_object('setor_id', v_setor, 'pontos', v_pts, 'acertos', v_acertos, 'erros', v_erros);
  end loop;

  update eventos set status = 'realizado' where id = e.id;
  return jsonb_build_object('ok', true, 'sessao_id', v_sessao, 'equipes', v_res);
end $$;

-- ---------------------------------------------------------------------
-- CAMPANHAS
-- ---------------------------------------------------------------------
create or replace function public.tecnico_ativar_campanha(p_campanha uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp uuid := _exigir_tecnico();
begin
  if exists (select 1 from campanhas where empresa_id = v_emp and status = 'ativa' and id <> p_campanha) then
    return jsonb_build_object('ok', false, 'motivo', 'ja_existe_campanha_ativa');
  end if;
  if not exists (select 1 from campanha_temas where campanha_id = p_campanha) then
    return jsonb_build_object('ok', false, 'motivo', 'campanha_sem_temas');
  end if;
  update campanhas set status = 'ativa' where id = p_campanha and empresa_id = v_emp and status = 'rascunho';
  if not found then return jsonb_build_object('ok', false, 'motivo', 'campanha_invalida'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- Encerra o trimestre: congela o ranking, concede selos finais e emite certificados.
-- p_top_n: quantos destaques gerais recebem certificado (o 1º de cada setor sempre recebe).
create or replace function public.tecnico_encerrar_campanha(p_campanha uuid, p_top_n int default 3)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_emp uuid := _exigir_tecnico(); c public.campanhas; r record; v_carga int;
  v_dest int := 0; v_trilha int := 0;
begin
  select * into c from campanhas where id = p_campanha and empresa_id = v_emp and status = 'ativa' for update;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'campanha_invalida'); end if;

  update campanhas set status = 'encerrada', encerrada_em = now() where id = c.id;

  -- 1) foto do ranking individual (desempate: mais relatos, depois conhecimento, depois quem chegou primeiro)
  insert into campanha_resultados (empresa_id, campanha_id, tipo, colaborador_id, setor_id, posicao, pontos, detalhes)
  select v_emp, c.id, 'individual', colaborador_id, setor_id,
         row_number() over (order by total desc, relatos desc, conhecimento desc, ultimo_ponto_em asc),
         total, jsonb_build_object('conhecimento', conhecimento, 'relatos', relatos, 'engajamento', engajamento)
    from v_ranking_individual where campanha_id = c.id;

  -- 2) foto do ranking de setores
  insert into campanha_resultados (empresa_id, campanha_id, tipo, setor_id, posicao, pontos, detalhes)
  select v_emp, c.id, 'setor', setor_id, row_number() over (order by total desc), total,
         jsonb_build_object('media_individual', total - pontos_quiz_tv, 'quiz_tv', pontos_quiz_tv, 'colaboradores', colaboradores_ativos)
    from v_ranking_setor where campanha_id = c.id;

  -- 3) selos finais
  insert into selos_conquistados (empresa_id, selo_id, colaborador_id, campanha_id)
  select v_emp, s.id, cr.colaborador_id, c.id from campanha_resultados cr, selos s
   where cr.campanha_id = c.id and cr.tipo = 'individual' and cr.posicao <= 3 and s.slug = 'podio'
  on conflict do nothing;

  insert into selos_conquistados (empresa_id, selo_id, colaborador_id, campanha_id)
  select v_emp, s.id, x.colaborador_id, c.id
    from (select distinct on (setor_id) colaborador_id from campanha_resultados
           where campanha_id = c.id and tipo = 'individual' and setor_id is not null and pontos > 0
           order by setor_id, posicao) x, selos s
   where s.slug = 'guardiao-do-setor'
  on conflict do nothing;

  -- 4) certificados de DESTAQUE (top N geral + 1º de cada setor)
  for r in
    select cr.colaborador_id, min(cr.posicao) as posicao, bool_or(cr.posicao <= p_top_n) as top_geral,
           (array_agg(s.nome))[1] as setor_nome
      from campanha_resultados cr left join setores s on s.id = cr.setor_id
     where cr.campanha_id = c.id and cr.tipo = 'individual' and cr.pontos > 0
       and (cr.posicao <= p_top_n or cr.colaborador_id in (
             select distinct on (setor_id) colaborador_id from campanha_resultados
              where campanha_id = c.id and tipo = 'individual' and setor_id is not null and pontos > 0
              order by setor_id, posicao))
     group by cr.colaborador_id
  loop
    insert into certificados (empresa_id, campanha_id, colaborador_id, tipo, titulo, codigo, dados)
    values (v_emp, c.id, r.colaborador_id, 'destaque',
            case when r.top_geral then r.posicao || 'º lugar geral — ' || c.nome
                 else 'Destaque do setor ' || coalesce(r.setor_nome, '') || ' — ' || c.nome end,
            'TIME-' || upper(encode(gen_random_bytes(5), 'hex')),
            jsonb_build_object('posicao', r.posicao, 'top_geral', r.top_geral, 'setor', r.setor_nome))
    on conflict do nothing;
    v_dest := v_dest + 1;
  end loop;

  -- 5) certificados de CONCLUSÃO DE TRILHA (aprovado em todas as obrigatórias)
  select coalesce(sum(carga_minutos), 0) into v_carga from licoes where campanha_id = c.id and publicada and obrigatoria;
  if v_carga > 0 then
    for r in
      select pl.colaborador_id
        from progresso_licoes pl join licoes l on l.id = pl.licao_id
       where l.campanha_id = c.id and l.publicada and l.obrigatoria and pl.aprovado_em is not null
       group by pl.colaborador_id
      having count(*) = (select count(*) from licoes where campanha_id = c.id and publicada and obrigatoria)
    loop
      insert into certificados (empresa_id, campanha_id, colaborador_id, tipo, titulo, carga_minutos, codigo)
      values (v_emp, c.id, r.colaborador_id, 'conclusao_trilha', 'Trilha de capacitação — ' || c.nome, v_carga,
              'TIME-' || upper(encode(gen_random_bytes(5), 'hex')))
      on conflict do nothing;
      v_trilha := v_trilha + 1;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'certificados_destaque', v_dest, 'certificados_trilha', v_trilha);
end $$;

-- ---------------------------------------------------------------------
-- COMITÊ DO CANAL DE RESPEITO (apenas perfis com comite_assedio = true)
-- ---------------------------------------------------------------------
create or replace function public.comite_responder_denuncia(p_denuncia uuid, p_mensagem text, p_status text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp uuid := minha_empresa();
begin
  if not sou_comite_assedio() then raise exception 'acesso_negado' using errcode = 'P0001'; end if;
  if not exists (select 1 from denuncias_assedio where id = p_denuncia and empresa_id = v_emp) then
    return jsonb_build_object('ok', false, 'motivo', 'denuncia_invalida');
  end if;
  if coalesce(trim(p_mensagem), '') <> '' then
    insert into denuncia_mensagens (empresa_id, denuncia_id, autor, mensagem) values (v_emp, p_denuncia, 'comite', trim(p_mensagem));
  end if;
  if p_status is not null then
    if p_status not in ('recebida','em_apuracao','concluida','arquivada') then
      return jsonb_build_object('ok', false, 'motivo', 'status_invalido');
    end if;
    update denuncias_assedio set status = p_status where id = p_denuncia;
  end if;
  return jsonb_build_object('ok', true);
end $$;
```

### 5.5 `0005_time_rls_grants.sql` — RLS e permissões

```sql
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
```

### 5.6 `0006_time_seed.sql` — Seed de temas e selos + bootstrap

```sql
-- =====================================================================
-- T.I.M.E. Seguro — 0006_time_seed.sql
-- Catálogos globais: temas e selos. (Perguntas: importar o arquivo
-- do TIME_12 pelo painel, o que também testa o importador.)
-- =====================================================================
insert into public.temas (empresa_id, slug, nome, icone, cor) values
  (null, 'assedio', 'Respeito e prevenção ao assédio', '💜', '#6A1B9A'),
  (null, 'nr10',    'NR-10 · Eletricidade',            '⚡', '#F5A300'),
  (null, 'nr12',    'NR-12 · Máquinas e equipamentos', '⚙️', '#455A64'),
  (null, 'nr35',    'NR-35 · Trabalho em altura',      '🪜', '#1565C0'),
  (null, 'epi',     'EPI · Equipamento de proteção',   '🦺', '#EF6C00'),
  (null, '5s',      '5S · Organização e limpeza',      '🧹', '#2E7D32'),
  (null, 'geral',   'Segurança geral / CIPA',          '🛡️', '#0B3C5D')
on conflict do nothing;

insert into public.selos (slug, nome, descricao, icone, ordem) values
  ('primeiro-passo',    'Primeiro Passo',       'Respondeu a primeira pergunta da campanha',              '👣', 1),
  ('olho-vivo',         'Olho Vivo',            '3 relatos validados pelo técnico de SST',                '👁️', 2),
  ('sentinela',         'Sentinela',            '10 relatos validados na campanha',                       '🛡️', 3),
  ('presenca-firme',    'Presença Firme',       'Sequência de 10 dias com atividade',                     '🔥', 4),
  ('maratonista',       'Maratonista do Saber', '100 acertos no quiz diário',                             '⚡', 5),
  ('dds-em-dia',        'DDS em Dia',           'Check-in em 10 DDS',                                     '🗣️', 6),
  ('mestre-das-nrs',    'Mestre das NRs',       'Todas as lições obrigatórias aprovadas com média ≥ 90',  '🎓', 7),
  ('voz-do-respeito',   'Voz do Respeito',      'Aprovado na lição de prevenção ao assédio',              '💜', 8),
  ('guardiao-do-setor', 'Guardião do Setor',    '1º lugar do setor ao fim do trimestre',                  '🏆', 9),
  ('podio',             'Pódio do T.I.M.E.',    'Top 3 geral ao fim do trimestre',                        '🥇', 10)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- BOOTSTRAP (rodar MANUALMENTE no SQL Editor, depois de criar o
-- primeiro usuário em Authentication > Users). Não faz parte da migração.
-- ---------------------------------------------------------------------
-- insert into empresas (nome, codigo, termo_lgpd_texto)
-- values ('Empresa Piloto', 'piloto', '<cole aqui o termo do TIME_03>')
-- returning id;
--
-- insert into perfis_tecnicos (user_id, empresa_id, nome, papel, comite_assedio)
-- values ('<uuid do usuário>', '<uuid da empresa>', 'Técnico de SST', 'admin', true);
```

## 6. Como testar localmente (opcional)

O arquivo abaixo simula o Supabase num Postgres comum. **Não aplicar no Supabase.**

```sql
-- SOMENTE PARA TESTE LOCAL (simula o ambiente Supabase). NÃO aplicar no Supabase.
do $$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; end if; end $$;
create schema auth; create schema extensions;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, extensions, public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated;
```

Com o CLI, o jeito mais simples é `npx supabase start` (Docker) + `npx supabase db reset`.

## 7. Conferência rápida depois do `db push`

```sql
select count(*) from temas where empresa_id is null;   -- 7
select count(*) from selos;                            -- 10
select proname from pg_proc where proname like 'colaborador_%' order by 1;  -- 18 funções
```
