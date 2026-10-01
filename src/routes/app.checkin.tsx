import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Loader2, MapPin } from "lucide-react";
import { AlunoLayout } from "@/components/layout/AlunoLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rpcApp } from "@/lib/rpc";
import { sessao } from "@/lib/sessao";
import { mensagem } from "@/lib/mensagens";

type Resultado = { ok: true; pontos: number; evento: string } | { ok: false; motivo: string };

/**
 * Check-in em DDS e SIPAT (docs/TIME_05 §8). O QR da TV abre esta tela já com o
 * evento e o código; quem digita o código preenche à mão.
 *
 * Sem sessão, manda para o login — o QR da parede funciona para quem ainda não
 * entrou, e depois de entrar a pessoa volta e confirma.
 */
function Checkin() {
  const navigate = useNavigate();
  const { e: eventoDaUrl, c: codigoDaUrl } = Route.useSearch();

  const [codigo, setCodigo] = useState(codigoDaUrl ?? "");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  useEffect(() => {
    if (!sessao.token()) {
      void navigate({ to: "/app/entrar", replace: true });
    }
  }, [navigate]);

  async function confirmar() {
    if (!eventoDaUrl || !codigo.trim()) return;
    setEnviando(true);
    try {
      setResultado(
        await rpcApp<Resultado>("colaborador_checkin", {
          p_evento: eventoDaUrl,
          p_codigo: codigo.trim().toUpperCase(),
        }),
      );
    } catch {
      setResultado({ ok: false, motivo: "erro_interno" });
    } finally {
      setEnviando(false);
    }
  }

  if (resultado?.ok) {
    return (
      <AlunoLayout comNavegacao>
        <div className="rounded-3xl bg-superficie p-6 text-center shadow-sm">
          <Check className="mx-auto size-12 text-verde" aria-hidden />
          <p className="mt-3 font-display text-xl font-extrabold text-marinho">
            Presença confirmada!
          </p>
          <p className="mt-1 text-sm text-texto-suave">{resultado.evento}</p>
          <p className="mt-3 font-display text-2xl font-extrabold text-verde">
            +{resultado.pontos} pontos
          </p>
          <p className="mt-1 text-sm text-texto">Bom DDS!</p>
          <Button asChild className="mt-5 min-h-12 w-full bg-marinho">
            <Link to="/app/inicio">Voltar ao início</Link>
          </Button>
        </div>
      </AlunoLayout>
    );
  }

  return (
    <AlunoLayout comNavegacao>
      <div className="rounded-3xl bg-superficie p-6 shadow-sm">
        <MapPin className="mx-auto size-10 text-marinho" aria-hidden />
        <h1 className="mt-3 text-center font-display text-xl font-extrabold text-marinho">
          Confirmar presença
        </h1>

        {!eventoDaUrl ? (
          <p className="mt-4 text-center text-sm text-texto">
            Escaneie o QR Code que está na TV para confirmar sua presença.
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-col gap-1.5">
              <Label htmlFor="codigo-checkin">Código da TV</Label>
              <Input
                id="codigo-checkin"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                inputMode="text"
                autoComplete="off"
                className="min-h-14 text-center font-mono text-2xl tracking-[0.3em]"
              />
              <p className="text-xs text-texto-suave">
                O código muda a cada minuto. Se não aceitar, escaneie de novo.
              </p>
            </div>

            {resultado && !resultado.ok && (
              <p role="alert" className="mt-3 text-sm font-medium text-vermelho">
                {mensagem(resultado.motivo)}
              </p>
            )}

            <Button
              onClick={confirmar}
              disabled={!codigo.trim() || enviando}
              className="mt-4 min-h-14 w-full bg-amarelo text-base font-bold text-texto hover:bg-amarelo/90"
            >
              {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Confirmar presença
            </Button>
          </>
        )}
      </div>
    </AlunoLayout>
  );
}

/** `?e=<evento>&c=<codigo>`, vindos do QR da TV. */
type Busca = { e?: string; c?: string };

export const Route = createFileRoute("/app/checkin")({
  validateSearch: (bruto: Record<string, unknown>): Busca => {
    const busca: Busca = {};
    if (typeof bruto["e"] === "string") busca.e = bruto["e"];
    if (typeof bruto["c"] === "string") busca.c = bruto["c"];
    return busca;
  },
  component: Checkin,
});
