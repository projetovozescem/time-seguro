import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AlunoLayout } from "@/components/layout/AlunoLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rpcPublica } from "@/lib/rpc";
import { sessao } from "@/lib/sessao";
import { PENDENCIAS, ehPendencia, mensagem } from "@/lib/mensagens";
import { limparPin } from "@/lib/pin";

type Empresa = { nome: string; logo_url: string | null } | null;

type Login =
  { ok: true; token: string; pendencia: "aceitar_lgpd" | null } | { ok: false; motivo: string };

/**
 * Entrada do colaborador (docs/TIME_05 §2): código da empresa + matrícula + PIN
 * de 6 dígitos. Sem Supabase Auth — a sessão é o token devolvido por
 * `colaborador_login`.
 *
 * O erro de credencial é SEMPRE o mesmo texto, para não revelar matrículas
 * válidas (docs/TIME_03 §3).
 */
function AppEntrar() {
  const navigate = useNavigate();
  const { empresa: empresaDaUrl, expirou } = Route.useSearch();

  const [codigo, setCodigo] = useState("");
  const [empresa, setEmpresa] = useState<Empresa>(null);
  const [matricula, setMatricula] = useState("");
  const [pin, setPin] = useState("");
  const [verPin, setVerPin] = useState(false);
  const [erro, setErro] = useState<string | null>(
    expirou ? "Sua sessão expirou. Entre de novo." : null,
  );
  const [enviando, setEnviando] = useState(false);

  // O código vem do QR do cartão de acesso ou da última vez que a pessoa entrou.
  useEffect(() => {
    const lembrado = empresaDaUrl ?? sessao.empresa();
    if (lembrado) setCodigo(lembrado);
  }, [empresaDaUrl]);

  // Nome da empresa na tela, para a pessoa confirmar que está no lugar certo.
  useEffect(() => {
    if (codigo.length < 2) {
      setEmpresa(null);
      return;
    }
    let cancelado = false;
    rpcPublica<Empresa>("empresa_publica", { p_codigo: codigo })
      .then((e) => !cancelado && setEmpresa(e))
      .catch(() => !cancelado && setEmpresa(null));
    return () => {
      cancelado = true;
    };
  }, [codigo]);

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await rpcPublica<Login>("colaborador_login", {
        p_empresa_codigo: codigo,
        p_matricula: matricula,
        p_pin: pin,
      });

      if (!r.ok) {
        setErro(mensagem(r.motivo));
        setPin("");
        return;
      }

      sessao.salvar(r.token);
      sessao.lembrarEmpresa(codigo);

      const destino = ehPendencia(r.pendencia) ? PENDENCIAS[r.pendencia] : "/app/inicio";
      await navigate({ to: destino, replace: true });
    } catch {
      setErro("Não foi possível entrar agora. Confira a internet e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const pronto = codigo.length >= 2 && matricula.length > 0 && pin.length === 6;

  return (
    <AlunoLayout>
      <div className="rounded-3xl bg-superficie p-6 shadow-sm">
        <h1 className="font-display text-xl font-extrabold text-marinho">Entrar</h1>
        <p className="mt-1 text-sm text-texto-suave">
          {empresa ? empresa.nome : "Use a matrícula e o PIN do seu cartão de acesso."}
        </p>

        <form onSubmit={entrar} className="mt-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="codigo">Código da empresa</Label>
            <Input
              id="codigo"
              required
              autoCapitalize="characters"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.trim())}
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pin">PIN de 6 números</Label>
            <div className="flex items-center gap-2">
              <Input
                id="pin"
                required
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                type={verPin ? "text" : "password"}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="min-h-12 text-center text-xl tracking-[0.5em]"
              />
              <button
                type="button"
                onClick={() => setVerPin((v) => !v)}
                aria-label={verPin ? "Esconder o PIN" : "Mostrar o PIN"}
                className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-borda text-texto-suave"
              >
                {verPin ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
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
            Entrar
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-texto-suave">
          Esqueceu o PIN? Procure o técnico de SST.
        </p>
        <a
          href={`/app/cadastro${codigo ? `?empresa=${encodeURIComponent(codigo)}` : ""}`}
          className="mt-3 block text-center text-sm font-semibold text-marinho underline-offset-4 hover:underline"
        >
          Primeiro acesso? Peça seu cadastro
        </a>
      </div>

      {/*
        Canal de Respeito: link discreto que abre a página pública SEM token
        (docs/TIME_03 §6). A rota entra na Fase 7 — por isso ainda não é um
        <Link> tipado.
      */}
      <a
        href={`/respeito/${codigo}`}
        className="mt-6 text-center text-sm font-medium text-respeito underline-offset-4 hover:underline"
      >
        💜 Canal de Respeito
      </a>
    </AlunoLayout>
  );
}

/** `?empresa=` vem do QR do cartão de acesso; `?expirou=1`, da sessão vencida. */
type Busca = { empresa?: string; expirou?: boolean };

export const Route = createFileRoute("/app/entrar")({
  validateSearch: (bruto: Record<string, unknown>): Busca => {
    const busca: Busca = {};
    if (typeof bruto["empresa"] === "string") busca.empresa = bruto["empresa"];
    if (bruto["expirou"] === "1" || bruto["expirou"] === true) busca.expirou = true;
    return busca;
  },
  component: AppEntrar,
});
