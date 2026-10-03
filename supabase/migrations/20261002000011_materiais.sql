-- =====================================================================
-- T.I.M.E. Seguro — 0011_materiais.sql
--
-- Material informativo de campanha (ex.: "Foco Total na NR-1"): textos curtos
-- que o técnico imprime num cartaz com QR Code. O QR abre uma página pública
-- (`/m/<empresa>/<slug>`) que lê o MESMO conteúdo do banco.
--
-- Padrão do Canal de Respeito e do autocadastro: `anon` não lê a tabela, só
-- executa a RPC pública `material_publico` (CLAUDE.md regra 4).
--
-- Migration NOVA: as anteriores já foram aplicadas e não se editam.
-- =====================================================================

create table public.materiais (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  campanha_id  uuid references public.campanhas(id) on delete set null,
  slug         text not null check (slug ~ '^[a-z0-9-]{2,40}$'),
  titulo       text not null check (char_length(trim(titulo)) between 2 and 120),
  subtitulo    text,
  -- Lista de blocos curtos: [{ "titulo": "...", "texto": "...", "icone": "..." }]
  blocos       jsonb not null default '[]'::jsonb check (jsonb_typeof(blocos) = 'array'),
  publicado    boolean not null default true,
  criado_em    timestamptz not null default now(),
  unique (empresa_id, slug)
);

create index materiais_empresa on public.materiais (empresa_id, criado_em desc);

alter table public.materiais enable row level security;

-- Tabela nova nasce com GRANT amplo no Supabase: tranca explicitamente.
revoke all on public.materiais from anon, authenticated;
grant select, insert, update, delete on public.materiais to authenticated;

-- Mesmo padrão de `licoes` (0005): todos os papéis da empresa leem;
-- admin e técnico escrevem.
create policy materiais_ler on public.materiais for select to authenticated
  using (empresa_id = minha_empresa());
create policy materiais_escrever on public.materiais for all to authenticated
  using (empresa_id = minha_empresa() and meu_papel() in ('admin','tecnico'))
  with check (empresa_id = minha_empresa() and meu_papel() in ('admin','tecnico'));

-- ---------------------------------------------------------------------
-- PÚBLICO: o conteúdo de um material publicado (destino do QR Code).
-- Devolve só o necessário para a página: nome da empresa, título e blocos.
-- ---------------------------------------------------------------------
create or replace function public.material_publico(p_empresa_codigo text, p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object(
              'ok', true,
              'empresa', e.nome,
              'codigo', e.codigo,
              'titulo', m.titulo,
              'subtitulo', m.subtitulo,
              'blocos', m.blocos)
       from materiais m
       join empresas e on e.id = m.empresa_id
      where e.codigo = lower(trim(coalesce(p_empresa_codigo, '')))
        and m.slug = lower(trim(coalesce(p_slug, '')))
        and m.publicado),
    jsonb_build_object('ok', false, 'motivo', 'material_nao_encontrado'))
$$;

revoke execute on function public.material_publico(text, text) from public;
grant execute on function public.material_publico(text, text) to anon, authenticated;
