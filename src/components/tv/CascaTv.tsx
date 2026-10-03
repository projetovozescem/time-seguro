import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Maximize, Minimize, X } from "lucide-react";
import { useTelaCheia } from "@/hooks/useTelaCheia";
import { calcularEscalaTv } from "@/lib/escalaTv";

/**
 * Em tela cheia, ajusta o tamanho de tudo à resolução da tela: muda o
 * `font-size` da raiz (as telas TV são todas em rem) e devolve o valor
 * anterior ao sair. Fora da tela cheia a TV fica no layout do painel, no
 * tamanho normal do site.
 */
function useEscalaTv(ativa: boolean) {
  useEffect(() => {
    if (!ativa) return;
    const raiz = document.documentElement;
    const anterior = raiz.style.fontSize;
    const aplicar = () => {
      raiz.style.fontSize = `${16 * calcularEscalaTv(window.innerWidth, window.innerHeight)}px`;
    };
    aplicar();
    window.addEventListener("resize", aplicar);
    return () => {
      window.removeEventListener("resize", aplicar);
      raiz.style.fontSize = anterior;
    };
  }, [ativa]);
}

/**
 * Casca das telas de TV (docs/TIME_06 §6): fundo azul-noite e legível a 5 metros.
 *
 * Abre dentro do painel, com o menu ao lado, como o resto do site. O botão
 * "Tela cheia" esconde o menu (`PainelLayout`) e ocupa a tela toda; Esc ou
 * "Sair da tela cheia" volta ao normal.
 */
export function CascaTv({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const cheia = useTelaCheia();
  useEscalaTv(cheia);

  async function alternarTelaCheia() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Navegador pode recusar sem gesto do usuário; o botão só não faz nada.
    }
  }

  async function sairDoModoTv() {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    navigate({ to: "/painel" });
  }

  return (
    <div
      className={
        cheia
          ? "fundo-tv relative min-h-screen text-white"
          : "fundo-tv relative overflow-hidden rounded-2xl text-white"
      }
    >
      <div
        className={`${cheia ? "fixed" : "absolute"} right-4 top-4 z-50 flex gap-2 transition-opacity ${cheia ? "opacity-30 hover:opacity-100 focus-within:opacity-100" : ""}`}
      >
        <button
          type="button"
          onClick={alternarTelaCheia}
          className="flex h-11 items-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-semibold hover:bg-white/20"
        >
          {cheia ? (
            <Minimize className="size-5" aria-hidden />
          ) : (
            <Maximize className="size-5" aria-hidden />
          )}
          {cheia ? "Sair da tela cheia" : "Tela cheia"}
        </button>
        {cheia && (
          <button
            type="button"
            onClick={sairDoModoTv}
            aria-label="Sair do Modo TV"
            className="flex size-11 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20"
          >
            <X className="size-5" aria-hidden />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
