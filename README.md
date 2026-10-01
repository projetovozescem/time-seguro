# Plataforma V.O.Z.E.S.

**V.O.Z.E.S.** (Valorização, Orientação e Zelo pela Existência das Mulheres) é
uma plataforma educativa de campanha contra a violência contra a mulher, para
alunos e professores do Ensino Médio do CEM de Gurupi.

A especificação canônica do sistema — telas, regras de pontuação, modelo de
dados e funções do banco — está em [VOZES.md](VOZES.md). As regras de trabalho
para agentes e os gates de validação estão em [AGENTS.md](AGENTS.md).

## Stack

- TanStack Start (React 19) + Vite
- Tailwind CSS 4 + shadcn/ui (Radix)
- Supabase (Postgres, RLS, funções `SECURITY DEFINER`)
- Drizzle Kit para migrations auxiliares

## Desenvolvimento

Requer Node.js 20+.

```sh
git clone <url-do-repositorio>
cd T.I.M.E
npm install
cp .env.example .env   # preencha com o projeto Supabase de DEV
npm run dev
```

> O `.env` nunca vai para o git. Aponte sempre para o projeto Supabase de
> **desenvolvimento** — nunca para produção.

## Banco de dados

As migrations oficiais ficam em [supabase/migrations/](supabase/migrations/) e são
**append-only**: nunca edite uma migration já aplicada, crie uma nova.

```sh
node scripts/db-migrate.mjs   # aplica as migrations pendentes no DEV
```

## Validação

Nenhuma mudança é considerada pronta sem este comando passando:

```sh
npm run verify   # lint + typecheck + testes de unidade + testes de RLS
```

Scripts individuais: `npm run lint`, `npm run typecheck`, `npm run test`,
`npm run test:rls`.
