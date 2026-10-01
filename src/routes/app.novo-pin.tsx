import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { AlunoLayout } from "@/components/layout/AlunoLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rpcApp } from "@/lib/rpc";
import { mensagem } from "@/lib/mensagens";
import { limparPin, pinFraco } from "@/lib/pin";

type Resposta = { ok: true } | { ok: false; motivo: string };

/** Troca obrigatória do PIN provisório no primeiro acesso (docs/TIME_05 §3). */
function AppNovoPin() {
  const navigate = useNavigate();
  const [atual, setAtual] = useState("");
  const [novo, setNovo] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);

    if (novo !== confirma) {
      setErro("Os dois PINs não são iguais.");
      return;
    }
    if (pinFraco(novo)) {
      setErro(mensagem("pin_fraco"));
      return;
    }

    setEnviando(true);
    try {
      const r = await rpcApp<Resposta>("colaborador_trocar_pin", {
        p_atual: atual,
        p_novo: novo,
      });
      if (!r.ok) {
        setErro(mensagem(r.motivo));
        return;
      }
      await navigate({ to: "/app/inicio", replace: true });
    } catch {
      setErro("Não foi possível salvar agora. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const campos = [
    { id: "atual", rotulo: "PIN atual", valor: atual, set: setAtual },
    { id: "novo", rotulo: "Novo PIN", valor: novo, set: setNovo },
    { id: "confirma", rotulo: "Repita o novo PIN", valor: confirma, set: setConfirma },
  ];

  return (
    <AlunoLayout>
      <div className="rounded-3xl bg-superficie p-6 shadow-sm">
        <h1 className="font-display text-xl font-extrabold text-marinho">Crie seu PIN</h1>
        <p className="mt-1 text-sm text-texto-suave">
          Crie seu PIN de 6 números. Não use 123456 nem números repetidos.
        </p>

        <form onSubmit={salvar} className="mt-5 flex flex-col gap-4">
          {campos.map(({ id, rotulo, valor, set }) => (
            <div key={id} className="flex flex-col gap-1.5">
              <Label htmlFor={id}>{rotulo}</Label>
              <Input
                id={id}
                type="password"
                required
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={valor}
                onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="min-h-12 text-center text-xl tracking-[0.5em]"
              />
            </div>
          ))}

          {erro && (
            <p role="alert" className="text-sm font-medium text-vermelho">
              {erro}
            </p>
          )}

          <Button
            type="submit"
            disabled={enviando || novo.length !== 6 || confirma.length !== 6}
            className="min-h-14 bg-amarelo text-base font-bold text-texto hover:bg-amarelo/90"
          >
            {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Salvar PIN
          </Button>
        </form>
      </div>
    </AlunoLayout>
  );
}

export const Route = createFileRoute("/app/novo-pin")({
  component: AppNovoPin,
});
