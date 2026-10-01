# TIME_03 — Segurança, Acesso e LGPD

## 1. Mudanças em relação ao V.O.Z.E.S.

| V.O.Z.E.S.                                         | T.I.M.E.                                                   |
| -------------------------------------------------- | ---------------------------------------------------------- |
| Senha única do professor no front (`localStorage`) | **Supabase Auth** (e-mail + senha) por técnico, com papéis |
| Aluno anônimo por aparelho (líder/aluno/excedente) | **Colaborador individual**: matrícula + PIN de 6 dígitos   |
| Sem consentimento                                  | **Termo LGPD** versionado, aceite registrado               |
| Denúncia fora do escopo                            | **Canal de Respeito** anônimo com protocolo                |

Apagar do projeto copiado: `src/lib/auth.ts` (senha fixa), `src/lib/participante.ts`, RPCs e
tabelas antigas (`participantes`, `acessos_qrcode`, `compartilhamentos`, `respostas_alunos`, `turmas`).

## 2. Painel do técnico — Supabase Auth

- Login: `supabase.auth.signInWithPassword({ email, password })`.
- Recuperação: `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/painel/nova-senha` })`.
- Após login, buscar o perfil: `select * from perfis_tecnicos where user_id = auth.uid()`.
  Sem perfil → tela "Seu usuário ainda não foi vinculado a uma empresa. Fale com o administrador."
- Guardar `{ papel, comite_assedio, empresa }` num contexto `usePerfil()`.
- **Cadastro de novos técnicos** (Configurações, só admin): nesta versão é manual.
  O admin cria o usuário no Supabase (_Authentication → Add user_) e o painel faz o
  `insert` em `perfis_tecnicos` (policy de insert não existe para o cliente → usar o SQL Editor
  ou criar uma Edge Function `convidar-tecnico` na fase pós-prêmio).
- Desativar **cadastro público** em _Authentication → Providers → Email → Disable sign ups_.

### Guard das rotas (TanStack `beforeLoad`)

```ts
// src/routes/_painel.tsx
export const Route = createFileRoute("/_painel")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/painel/login" });
  },
  component: PainelLayout,
});
```

Rotas com papel específico (ex.: `/painel/respeito` exige `comite_assedio`, `/painel/configuracoes`
exige `admin`) checam o perfil no `beforeLoad` e redirecionam para `/painel` se não puder.
**A proteção real é o RLS/RPC** — o guard é só experiência de uso.

## 3. App do colaborador — sessão por token

Fluxo:

```
/app/entrar ──login──▶ pendencia?
   ├─ 'trocar_pin'   ──▶ /app/novo-pin
   ├─ 'aceitar_lgpd' ──▶ /app/termo
   └─ null           ──▶ /app/inicio
```

```ts
// src/lib/sessao.ts
const CHAVE = "time_token";
const CHAVE_EMPRESA = "time_empresa";
export const sessao = {
  token: () => localStorage.getItem(CHAVE),
  salvar: (t: string) => localStorage.setItem(CHAVE, t),
  sair: () => localStorage.removeItem(CHAVE),
  empresa: () => localStorage.getItem(CHAVE_EMPRESA), // lembra o código da empresa
  lembrarEmpresa: (c: string) => localStorage.setItem(CHAVE_EMPRESA, c),
};
```

```ts
// src/lib/rpc.ts — wrapper único para as RPCs do app
export async function rpcApp<T = any>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const token = sessao.token();
  const { data, error } = await supabase.rpc(fn, { p_token: token, ...args });
  if (error) {
    if (error.message?.includes("sessao_invalida")) {
      sessao.sair();
      window.location.href = "/app/entrar?expirou=1";
    }
    throw error;
  }
  if (data && data.ok === false && ["trocar_pin", "aceitar_lgpd"].includes(data.motivo)) {
    window.location.href = data.motivo === "trocar_pin" ? "/app/novo-pin" : "/app/termo";
  }
  return data as T;
}
```

Regras:

- Sessão dura **30 dias**. Logout revoga no servidor.
- **5 PINs errados** → bloqueio de 15 min (mensagem: "Muitas tentativas. Tente de novo em 15 minutos
  ou procure o técnico de SST").
- O erro de login é **sempre o mesmo** ("Matrícula ou PIN incorretos"), para não revelar matrículas.
- PIN novo: 6 dígitos, sem repetição (111111) e sem sequência (123456).
- Técnico pode **gerar novo PIN** (esqueceu) e **desbloquear**.
- Guard das rotas `/app/*` (exceto `/app/entrar`): sem token → `/app/entrar`.

### Cartões de acesso

Ao gerar PINs, o painel mostra uma tela de impressão com **1 cartão por colaborador**
(8 por folha A4): nome, matrícula, setor, código da empresa, PIN provisório e QR do app
(`{origin}/app/entrar?empresa={codigo}`). Aviso no cartão: "PIN provisório. Você vai criar
o seu no primeiro acesso. Não compartilhe." O PIN **não fica salvo em lugar nenhum** depois.

## 4. RLS — resumo

- `anon`: zero acesso a tabelas. Só `EXECUTE` nas RPCs do app e públicas.
- `authenticated`: lê a própria empresa; `admin`/`tecnico` escrevem no CRUD.
- `colaboradores.pin_hash`: fora do `GRANT` por coluna (ilegível pelo painel).
- `denuncias_assedio.senha_hash`: idem.
- Tabelas de fatos (respostas, pontos, checkins, progresso...) só aceitam escrita via RPC.
- Views com `security_invoker = on` respeitam o RLS.

## 5. Edge Function `relato-upload-url`

Por que existe: o colaborador não é usuário do Supabase Auth, então não pode ter policy de
upload. A função valida o token e devolve uma **URL assinada de upload** só para aquele relato.

```ts
// supabase/functions/relato-upload-url/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { token, relato_id } = await req.json();
    if (!token || !relato_id) return json({ ok: false, motivo: "dados_invalidos" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: path, error } = await admin.rpc("_relato_caminho_foto", {
      p_token: token,
      p_relato: relato_id,
    });
    if (error || !path) return json({ ok: false, motivo: "upload_nao_permitido" }, 403);

    const { data, error: e2 } = await admin.storage
      .from("relatos-fotos")
      .createSignedUploadUrl(path);
    if (e2) throw e2;
    return json({ ok: true, path, upload_token: data.token });
  } catch (_e) {
    return json({ ok: false, motivo: "erro_interno" }, 500);
  }
});
```

No app:

```ts
const foto = await comprimirImagem(arquivo, 1280, 0.7); // canvas → JPEG, lado maior 1280px
const { data } = await supabase.functions.invoke("relato-upload-url", {
  body: { token: sessao.token(), relato_id },
});
if (data?.ok) {
  await supabase.storage
    .from("relatos-fotos")
    .uploadToSignedUrl(data.path, data.upload_token, foto, { contentType: "image/jpeg" });
}
```

- A foto é **opcional**. Janela de upload: 30 minutos após criar o relato, 1 foto por relato.
- Se o upload falhar, o relato continua válido; o painel mostra "foto indisponível".
- Aviso na tela da câmera: **"Fotografe o risco, não as pessoas."**

## 6. Canal de Respeito — garantias de anonimato

- Rota pública `/respeito/{codigo}`, fora do layout do app (sem PWA, sem service worker de cache).
- **Nunca** enviar `p_token`, mesmo se o colaborador estiver logado no mesmo aparelho.
- Sem analytics, sem logs de acesso próprios, sem gravar em `localStorage`.
- Banco: sem `colaborador_id`, `recebida_em` é só **data**; mensagens também só com data.
- Protocolo `RS-XXXXXXXX` + senha de 8 caracteres, mostrados **uma vez** com botão "Copiar" e o
  aviso "Anote. Sem eles não é possível acompanhar a denúncia."
- Texto de transparência na página: "Não pedimos seu nome. O sistema não registra quem você é.
  Se você mesmo escrever seu nome ou detalhes que identifiquem você, o comitê poderá saber."
- Nota técnica honesta: a infraestrutura de hospedagem pode manter logs técnicos de acesso
  (padrão de qualquer site). O sistema **não** grava nem cruza esses dados.

## 7. LGPD

### Dados tratados

| Dado                          | Para quê                                     |
| ----------------------------- | -------------------------------------------- |
| Nome, matrícula, setor, turno | Identificar o participante e montar rankings |
| Respostas, notas, check-ins   | Pontuação e evidência de treinamento         |
| Relatos e fotos               | Tratar riscos no ambiente de trabalho        |
| Pontos e selos                | Reconhecimento e premiação                   |

**Não coletar**: CPF, e-mail, telefone, data de nascimento, dados de saúde.

### Regras

- Termo versionado em `empresas.termo_lgpd_texto` / `termo_lgpd_versao`. Subir a versão força
  novo aceite de todos no próximo acesso.
- Aceite registrado em `consentimentos_lgpd` (data/hora e versão).
- No ranking do app aparece só **"Primeiro nome + inicial"** (ex.: "Carlos S.").
- **Anonimização** (admin): remove nome/matrícula/PIN e mantém estatísticas.
- Exportar dados de um colaborador (direito de acesso): botão no painel gera JSON com
  perfil, pontos, respostas, relatos e certificados dele.

### Termo modelo (editável pela empresa em Configurações)

> ⚠️ Modelo de referência. A empresa deve revisá-lo com o jurídico/encarregado de dados.

```
TERMO DE CIÊNCIA E CONSENTIMENTO — T.I.M.E. SEGURO

A [NOME DA EMPRESA] utiliza a plataforma T.I.M.E. Seguro para ações de
capacitação, prevenção de acidentes e prevenção ao assédio.

1. Dados utilizados: nome, matrícula, setor e turno, além das suas respostas,
   participações em DDS/SIPAT, relatos enviados e pontuação.
2. Finalidade: capacitação em segurança do trabalho, tratamento de riscos
   relatados, reconhecimento dos participantes e relatórios internos da área de SST
   e da CIPA.
3. Ranking: se ativado na campanha, seu primeiro nome e a inicial do sobrenome
   podem aparecer para os colegas.
4. Fotos: fotografe apenas o risco. Evite pessoas no enquadramento.
5. Canal de Respeito: é separado do seu login e não identifica você.
6. Seus direitos: pedir acesso, correção ou exclusão dos seus dados à área de SST
   ou ao encarregado de dados da empresa: [CONTATO].
7. Os dados ficam armazenados enquanto você participar das campanhas e pelo prazo
   exigido para comprovação de treinamentos, sendo depois excluídos ou anonimizados.

Ao tocar em "Li e aceito", você confirma que leu este termo.
```

## 8. Checklist de segurança antes de publicar

- [ ] Cadastro público desativado no Supabase Auth
- [ ] `anon` não consegue `select` em nenhuma tabela (testar com a chave anon no console)
- [ ] Gabarito ausente em `colaborador_perguntas_do_dia` antes de responder
- [ ] Página `/respeito` sem nenhuma chamada com token (conferir na aba Rede do navegador)
- [ ] Bucket `relatos-fotos` privado
- [ ] Service role key **só** nas Edge Functions, nunca no front
- [ ] Variáveis no front: apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
