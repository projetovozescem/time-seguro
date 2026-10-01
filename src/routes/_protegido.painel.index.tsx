import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Início do painel (docs/TIME_04 §3). Nesta fase mostra apenas quem está logado
 * e o aviso de vínculo, para fechar o fluxo de acesso. Os cartões do dashboard,
 * o chip da campanha ativa e o menu de 16 itens entram com as telas de
 * `/painel/*` — ver docs/TIME_04 §2 e §3.
 */
function PainelInicio() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function sair() {
    await supabase.auth.signOut();
    await navigate({ to: "/painel/login", replace: true });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-marinho">Início</h1>
          {email && <p className="mt-1 text-sm text-texto-suave">{email}</p>}
        </div>
        <Button variant="outline" onClick={sair} className="min-h-11">
          <LogOut className="size-4" aria-hidden />
          Sair
        </Button>
      </header>

      <section className="rounded-2xl border border-borda bg-superficie p-5">
        <h2 className="font-display text-lg font-bold text-texto">Painel em construção</h2>
        <p className="mt-2 text-sm text-texto-suave">
          O acesso está funcionando. As telas de colaboradores, campanhas, relatos e analytics
          entram nas próximas etapas, na ordem de <code>docs/TIME_11</code>.
        </p>
      </section>
    </div>
  );
}

export const Route = createFileRoute("/_protegido/painel/")({
  component: PainelInicio,
});
