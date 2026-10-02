import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { AlunoLayout } from "@/components/layout/AlunoLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rpcPublica } from "@/lib/rpc";
import { sessao } from "@/lib/sessao";
import { mensagem } from "@/lib/mensagens";
import { emailValido } from "@/lib/cadastro";

type Empresa = { ok: boolean; nome?: string } | null;
type Setores = { ok: boolean; setores?: { id: string; nome: string }[] };
type Resposta = { ok: boolean; motivo?: string };

/**
 * Pedido de cadastro do colaborador (migration 0009).
 *
 * Pública: não tem token, e o pedido não dá acesso a nada. Fica pendente até
 * alguém da SST, da CIPA ou o administrador aprovar; aprovado, o gestor entrega
 * o PIN. A tela responde igual quando a matrícula já existe, de propósito — o
 * servidor também, para não revelar quem trabalha na empresa.
 */
function AppCadastro() {
  const { empresa: empresaDaUrl } = Route.useSearch();

  const [codigo, setCodigo] = useState("");
  const [empresa, setEmpresa] = useState<Empresa>(null);
  const [setores, setSetores] = useState<{ id: string; nome: string }[]>([]);
  const [nome, setNome] = useState("");
  const [matricula, setMatricula] = useState("");
  const [setorId, setSetorId] = useState("");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    const lembrado = empresaDaUrl ?? sessao.empresa();
    if (lembrado) setCodigo(lembrado);
  }, [empresaDaUrl]);

  // Nome da empresa e lista de setores, para a pessoa escolher o dela.
  useEffect(() => {
    if (codigo.length < 2) {
      setEmpresa(null);
      setSetores([]);
      return;
    }
    let cancelado = false;
    rpcPublica<Empresa>("empresa_publica", { p_codigo: codigo })
      .then((e) => !cancelado && setEmpresa(e))
      .catch(() => !cancelado && setEmpresa(null));
    rpcPublica<Setores>("publico_setores_da_empresa", { p_empresa_codigo: codigo })
      .then((r) => !cancelado && setSetores(r.ok ? (r.setores ?? []) : []))
      .catch(() => !cancelado && setSetores([]));
    return () => {
      cancelado = true;
    };
  }, [codigo]);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    if (!emailValido(email)) {
      setErro(mensagem("email_invalido"));
      return;
    }
    setEnviando(true);
    try {
      const r = await rpcPublica<Resposta>("publico_solicitar_cadastro", {
        p_empresa_codigo: codigo,
        p_nome: nome.trim(),
        p_matricula: matricula.trim(),
        p_email: email.trim(),
        // Parâmetro opcional entra só quando existe (exactOptionalPropertyTypes).
        ...(setorId ? { p_setor: setorId } : {}),
      });
      if (!r.ok) {
        setErro(mensagem(r.motivo));
        return;
      }
      setEnviado(true);
    } catch {
      setErro("Não foi possível enviar agora. Confira a internet e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <AlunoLayout>
        <div className="rounded-3xl bg-superficie p-6 text-center shadow-sm">
          <CheckCircle2 className="mx-auto size-12 text-verde" aria-hidden />
          <h1 className="mt-3 font-display text-xl font-extrabold text-marinho">Pedido enviado!</h1>
          <p className="mt-2 text-sm text-texto-suave">
            Seu gestor vai conferir seus dados. Quando aprovar, ele envia o seu PIN. Com a matrícula
            e o PIN você já entra no app.
          </p>
          <a
            href={`/app/entrar${codigo ? `?empresa=${encodeURIComponent(codigo)}` : ""}`}
            className="mt-5 inline-block rounded-xl bg-amarelo px-6 py-3 text-sm font-bold text-texto"
          >
            Ir para a entrada
          </a>
        </div>
      </AlunoLayout>
    );
  }

  const pronto =
    codigo.length >= 2 && nome.trim().length >= 2 && matricula.trim() !== "" && email !== "";

  return (
    <AlunoLayout>
      <div className="rounded-3xl bg-superficie p-6 shadow-sm">
        <h1 className="font-display text-xl font-extrabold text-marinho">Peça seu cadastro</h1>
        <p className="mt-1 text-sm text-texto-suave">
          {empresa?.ok && empresa.nome
            ? empresa.nome
            : "Preencha os dados. Seu gestor aprova e envia o seu PIN."}
        </p>

        <form onSubmit={enviar} className="mt-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="codigo">Código da empresa</Label>
            <Input
              id="codigo"
              required
              autoCapitalize="none"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.trim())}
              className="min-h-12 text-base"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nome">Seu nome</Label>
            <Input
              id="nome"
              required
              autoComplete="name"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="min-h-12 text-base"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="matricula">Matrícula</Label>
            <Input
              id="matricula"
              required
              inputMode="numeric"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value.trim())}
              className="min-h-12 text-base"
            />
          </div>

          {setores.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="setor">Seu setor</Label>
              <select
                id="setor"
                value={setorId}
                onChange={(e) => setSetorId(e.target.value)}
                className="min-h-12 rounded-md border border-input bg-transparent px-3 text-base"
              >
                <option value="">Não sei / outro</option>
                {setores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail da empresa</Label>
            <Input
              id="email"
              required
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              className="min-h-12 text-base"
            />
          </div>

          {erro && (
            <p role="alert" className="text-sm font-medium text-vermelho">
              {erro}
            </p>
          )}

          <Button
            type="submit"
            disabled={enviando || !pronto}
            className="min-h-14 bg-amarelo text-base font-bold text-texto hover:bg-amarelo/90"
          >
            {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Enviar pedido
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-texto-suave">
          Já tem PIN?{" "}
          <a
            href={`/app/entrar${codigo ? `?empresa=${encodeURIComponent(codigo)}` : ""}`}
            className="font-semibold text-marinho underline-offset-4 hover:underline"
          >
            Entrar
          </a>
        </p>
      </div>
    </AlunoLayout>
  );
}

/** `?empresa=` vem do link da entrada ou de um QR da empresa. */
type Busca = { empresa?: string };

export const Route = createFileRoute("/app/cadastro")({
  validateSearch: (bruto: Record<string, unknown>): Busca => {
    const busca: Busca = {};
    if (typeof bruto["empresa"] === "string") busca.empresa = bruto["empresa"];
    return busca;
  },
  component: AppCadastro,
});
