import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

const CHAVE_SESSAO = "time_abertura_vista";
const DURACAO_MS = 2200;

/** Se a abertura já rodou nesta sessão (ou se o aparelho pede menos movimento). */
function devePular(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.sessionStorage.getItem(CHAVE_SESSAO) === "1") return true;
  } catch {
    /* sessionStorage bloqueado — segue mostrando a abertura */
  }
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Abertura do app do colaborador (docs/TIME_05 §10): escudo pulsando, o nome
 * T.I.M.E. e a empresa. Roda uma vez por sessão, então navegar entre quiz,
 * trilha e perfil não repete a animação.
 */
export function AberturaAnimada({ nomeEmpresa }: { nomeEmpresa: string }) {
  const [visivel, setVisivel] = useState(false);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    if (devePular()) return;
    setVisivel(true);
    try {
      window.sessionStorage.setItem(CHAVE_SESSAO, "1");
    } catch {
      /* ignora */
    }

    // Começa o fade-out um pouco antes de desmontar, para a transição ser suave.
    const iniciarSaida = window.setTimeout(() => setSaindo(true), DURACAO_MS - 500);
    const remover = window.setTimeout(() => setVisivel(false), DURACAO_MS);
    return () => {
      window.clearTimeout(iniciarSaida);
      window.clearTimeout(remover);
    };
  }, []);

  if (!visivel) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[linear-gradient(160deg,#072A42_0%,#0B3C5D_55%,#13294B_100%)] transition-opacity duration-500 ${
        saindo ? "opacity-0" : "opacity-100"
      }`}
    >
      <ShieldCheck
        className="size-20 animate-[abertura-escudo_1.6s_ease-out_forwards] text-amarelo"
        strokeWidth={2.25}
      />
      <h1 className="animate-[abertura-subir_0.8s_0.35s_ease-out_both] font-display text-4xl font-bold tracking-tight text-white">
        T.I.M.E.
      </h1>
      <p className="max-w-[280px] animate-[abertura-subir_0.8s_0.6s_ease-out_both] text-center text-sm text-white/80">
        Treinar, Identificar, Mobilizar e Evoluir
      </p>
      <p className="animate-[abertura-subir_0.8s_0.95s_ease-out_both] rounded-full bg-white/15 px-5 py-1.5 text-sm font-semibold text-white">
        {nomeEmpresa}
      </p>
    </div>
  );
}
