import { useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Maximize, Minimize, X } from "lucide-react";

/**
 * Casca das telas de TV (docs/TIME_06 §6): fundo azul-noite, tudo legível a 5
 * metros, e os dois botões fixos no canto — tela cheia e sair.
 */
export function CascaTv({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [cheia, setCheia] = useState(false);

  async function alternarTelaCheia() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setCheia(false);
      } else {
        await document.documentElement.requestFullscreen();
        setCheia(true);
      }
    } catch {
      // Navegador pode recusar sem gesto do usuário; o botão só não faz nada.
    }
  }

  return (
    <div className="fundo-tv min-h-screen text-white">
      <div className="fixed right-4 top-4 z-50 flex gap-2">
        <button
          type="button"
          onClick={alternarTelaCheia}
          aria-label={cheia ? "Sair da tela cheia" : "Tela cheia"}
          className="flex size-11 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20"
        >
          {cheia ? (
            <Minimize className="size-5" aria-hidden />
          ) : (
            <Maximize className="size-5" aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={() => navigate({ to: "/painel" })}
          aria-label="Sair do Modo TV"
          className="flex size-11 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      {children}
    </div>
  );
}
