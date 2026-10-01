import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AlunoLayout } from "@/components/layout/AlunoLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { rpcApp } from "@/lib/rpc";

type Termo = { versao: string; texto: string };
type Resposta = { ok: true } | { ok: false; motivo: string };

/**
 * Termo LGPD versionado (docs/TIME_03 §7, docs/TIME_05 §3). Sem o aceite as RPCs
 * devolvem `aceitar_lgpd` e nada mais funciona. Subir a versão do termo força
 * novo aceite de todos.
 */
function AppTermo() {
  const navigate = useNavigate();
  const [termo, setTermo] = useState<Termo | null>(null);
  const [aceito, setAceito] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    rpcApp<Termo>("colaborador_termo_lgpd")
      .then(setTermo)
      .catch(() => setErro("Não foi possível carregar o termo. Tente de novo."));
  }, []);

  async function aceitar() {
    setErro(null);
    setEnviando(true);
    try {
      const r = await rpcApp<Resposta>("colaborador_aceitar_lgpd");
      if (!r.ok) {
        setErro("Não foi possível registrar o aceite. Tente de novo.");
        return;
      }
      await navigate({ to: "/app/inicio", replace: true });
    } catch {
      setErro("Não foi possível registrar o aceite. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AlunoLayout>
      <div className="rounded-3xl bg-superficie p-6 shadow-sm">
        <h1 className="font-display text-xl font-extrabold text-marinho">Termo de uso dos dados</h1>

        <div className="mt-4 max-h-[45vh] overflow-y-auto rounded-xl border border-borda bg-fundo p-4">
          {termo ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-texto">{termo.texto}</p>
          ) : (
            <p className="text-sm text-texto-suave">Carregando o termo…</p>
          )}
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-texto">
          <Checkbox
            checked={aceito}
            onCheckedChange={(v) => setAceito(v === true)}
            className="mt-0.5 size-5"
          />
          Li e entendi.
        </label>

        {erro && (
          <p role="alert" className="mt-3 text-sm font-medium text-vermelho">
            {erro}
          </p>
        )}

        <Button
          onClick={aceitar}
          disabled={!aceito || !termo || enviando}
          className="mt-4 min-h-14 w-full bg-amarelo text-base font-bold text-texto hover:bg-amarelo/90"
        >
          {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Li e aceito
        </Button>
      </div>
    </AlunoLayout>
  );
}

export const Route = createFileRoute("/app/termo")({
  component: AppTermo,
});
