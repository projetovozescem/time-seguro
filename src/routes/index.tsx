import { createFileRoute, Link } from "@tanstack/react-router";
import { HardHat, ShieldCheck } from "lucide-react";
import { TimeLogo } from "@/components/TimeLogo";

/**
 * Porta de entrada: separa os dois públicos (docs/TIME_00 §3). O colaborador vai
 * para o app PWA; o técnico, CIPA e admin vão para o painel.
 * O Canal de Respeito tem link próprio e público — entra na Fase 7.
 */
function Inicio() {
  return (
    <div className="min-h-screen bg-fundo">
      <div className="faixa-seguranca" />
      <main className="mx-auto flex min-h-[calc(100vh-6px)] w-full max-w-md flex-col justify-center gap-10 px-5 py-12">
        <div className="flex flex-col items-center gap-3 text-center">
          <TimeLogo tamanho="lg" comLegenda={false} />
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-marinho">
            T.I.M.E. Seguro
          </h1>
          <p className="text-sm text-texto-suave">Treinar, Identificar, Mobilizar e Evoluir</p>
        </div>

        <nav className="flex flex-col gap-3">
          <Link
            to="/app/entrar"
            className="flex min-h-14 items-center gap-4 rounded-2xl bg-marinho px-5 py-4 text-white transition-colors hover:bg-marinho-escuro"
          >
            <HardHat className="size-7 shrink-0 text-amarelo" aria-hidden />
            <span>
              <span className="block font-display text-lg font-bold leading-tight">
                Sou colaborador
              </span>
              <span className="block text-sm text-white/75">Entrar com matrícula e PIN</span>
            </span>
          </Link>

          <Link
            to="/painel/login"
            className="flex min-h-14 items-center gap-4 rounded-2xl border border-borda bg-superficie px-5 py-4 text-texto transition-colors hover:bg-muted"
          >
            <ShieldCheck className="size-7 shrink-0 text-marinho" aria-hidden />
            <span>
              <span className="block font-display text-lg font-bold leading-tight">
                Sou da SST ou da CIPA
              </span>
              <span className="block text-sm text-texto-suave">Entrar com e-mail e senha</span>
            </span>
          </Link>
        </nav>
      </main>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: Inicio,
});
