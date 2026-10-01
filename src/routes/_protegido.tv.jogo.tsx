import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CascaTv } from "@/components/tv/CascaTv";
import { JogoClassico } from "@/components/tv/JogoClassico";
import { JogoDuelo } from "@/components/tv/JogoDuelo";
import { JogoEliminacao } from "@/components/tv/JogoEliminacao";
import { partidaAtual } from "@/lib/jogos/partida";

/**
 * Partida do Modo TV (docs/TIME_06 §4): despacha para o modo escolhido em `/tv`.
 *
 * A partida é lida uma única vez, no primeiro render: se fosse lida a cada
 * render, um `limparPartida()` no fim derrubaria a tela de resultado.
 */
function Jogo() {
  const navigate = useNavigate();
  const [partida] = useState(() => partidaAtual());

  // Recarregar a pagina perde o estado em memoria — volta para a selecao.
  if (!partida) {
    return (
      <CascaTv>
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-8 text-center">
          <p className="font-display text-4xl font-extrabold">Nenhuma partida em andamento</p>
          <p className="text-xl text-white/70">
            A partida fica na memória da TV. Recarregar a página começa de novo.
          </p>
          <Button
            onClick={() => navigate({ to: "/tv", search: {} })}
            className="min-h-16 bg-amarelo px-8 text-xl font-bold text-texto"
          >
            Escolher partida
          </Button>
        </div>
      </CascaTv>
    );
  }

  switch (partida.modo) {
    case "classico":
      return <JogoClassico partida={partida} />;
    case "duelo":
      return <JogoDuelo partida={partida} />;
    case "eliminacao":
      return <JogoEliminacao partida={partida} />;
  }
}

export const Route = createFileRoute("/_protegido/tv/jogo")({
  component: Jogo,
});
