# Roteiro de deploy — T.I.M.E. Seguro

Escrito para: quem vai publicar o sistema (você, Max, ou quem assumir isso).
Nada aqui foi executado: é o passo a passo para quando a hospedagem estiver decidida.

Estado em 01/10/2026: a aplicação **roda e passa todos os gates**, e nunca foi publicada.
O build já sai pronto para Cloudflare (`npm run build` gera `.output/server/wrangler.json` e
`.wrangler/deploy/config.json`), que por isso é o caminho mais curto.

---

## 1. Decisão pendente: hospedagem

| Opção                 | O que falta fazer                                                            |
| --------------------- | ---------------------------------------------------------------------------- |
| **Cloudflare Pages**  | Nada no código. Criar o projeto e rodar `npx nitro deploy --prebuilt`.       |
| Vercel                | Trocar o preset do Nitro para `vercel` e conectar o repositório.             |
| Netlify               | Trocar o preset do Nitro para `netlify` e conectar o repositório.            |

O repositório é `https://github.com/projetovozescem/time-seguro` (branch `main`).

## 2. Banco: a decisão tomada e o risco que ela traz

**Decidido em 01/10/2026: usar o mesmo projeto Supabase de desenvolvimento
(`niazcsjnxvoeeolwrcqx`) também em produção**, para chegar na inscrição do dia 05/10.

Consequência, registrada aqui porque ela não é óbvia depois:

- os **dados de demonstração** (`Empresa Demonstração`) e os **dados de apresentação** ficam no
  mesmo banco que os testes automatizados;
- `npm run test:fluxo` cria e apaga colaboradores, eventos e campanhas de teste a cada execução,
  na empresa `piloto`. Ele devolve a campanha de demonstração ao ar no fim, mas **não** é uma
  transação: se ele morrer no meio, sobra lixo;
- `node scripts/seed-demo.mjs` **apaga e recria** a empresa `demo` inteira. Rodar isso durante uma
  apresentação derruba o que está na tela;
- `scripts/_db.mjs` só protege contra o projeto **do V.O.Z.E.S.** (`irpyxizuwzuquqtyajam`). Não há
  guarda contra rodar os scripts no banco que agora também é produção.

Mitigação mínima enquanto a decisão valer: **não rodar `npm run test:fluxo` nem
`scripts/seed-demo.mjs` nas horas que cercam uma demonstração**. Separar o banco depois da
inscrição é meio dia de trabalho (as 7 migrations em ordem + `db:configurar` + `db:bootstrap`).

## 3. Variáveis de ambiente no provedor

Só estas duas, e nenhuma mais (`docs/TIME_03` §8, verificado por `src/lib/seguranca.test.ts`):

```
VITE_SUPABASE_URL=https://<project_ref>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

A chave `sb_secret_` e o `SUPABASE_ACCESS_TOKEN` **não** vão para o provedor de hospedagem. A
Edge Function `relato-upload-url` recebe a service role do próprio Supabase, não daqui.

## 4. Supabase Auth: Site URL e Redirect URLs

Depois de saber o endereço público, no painel do Supabase (Authentication → URL Configuration):

- **Site URL**: `https://<endereco-publicado>`
- **Redirect URLs**: `https://<endereco-publicado>/painel/nova-senha`

Hoje os dois apontam para `http://localhost:3000`. Quem aplica é o próprio script:

```bash
# edite SITE_URL em scripts/db-configurar.mjs e rode:
node scripts/db-configurar.mjs --aplicar
```

O script confere, no mesmo passo, que o cadastro público continua desativado e que os buckets
`relatos-fotos` (privado) e `logos` (público) estão como devem.

## 5. Edge Function

```bash
npx supabase functions deploy relato-upload-url
```

É ela que dá a URL assinada para a foto do relato: sem isso, relatar com foto falha.

## 6. Antes de publicar — a lista que já tem prova

```bash
npm run verify     # lint, tsc, 429 testes, RLS (249) e fluxo (189)
npm run build      # e conferir .output/public
node scripts/db-configurar.mjs   # sem --aplicar: só mostra o estado
```

O checklist de segurança do `docs/TIME_03` §8 está revisado, item por item, em
`memory/progress.md`. O que se verifica no código virou teste (`src/lib/seguranca.test.ts`); o que
depende do banco está no `db-configurar` e no `test:rls`.

## 7. Depois de publicar

1. Trocar a senha provisória do admin (`BOOTSTRAP_SENHA` do `.env`) no primeiro acesso.
2. **Rotacionar o `SUPABASE_ACCESS_TOKEN` e a chave `sb_secret_`**: as duas foram colocadas no
   chat durante o desenvolvimento e seguem válidas. Isso é pendência de segurança real, não
   formalidade.
3. Testar no celular: `/app/entrar` com matrícula e PIN, instalar o PWA, responder o quiz.
4. Testar na TV do refeitório: `/tv`, um modo de cada, e o check-in por QR.
5. Conferir que `/respeito/<codigo>` abre **sem** login e que a aba Rede não mostra nenhuma
   chamada com token nessa página.

## 8. O que **não** deve ir para produção

- O MCP do Supabase (`.mcp.json`) aponta para desenvolvimento e deve continuar assim
  (`AGENTS.md`, seção Segurança).
- `scripts/seed-dev.mjs`, `scripts/seed-demo.mjs` e `scripts/bootstrap-dev.mjs` são de
  desenvolvimento. Ficam no repositório porque são a receita dos dados de demonstração, mas não
  se roda nenhum deles contra um banco com dado real de colaborador.
- A empresa `Empresa Demonstração` é demonstração do sistema. `docs/TIME_11` §3 é explícito:
  print de dado fictício nunca se apresenta como resultado de uso real.
