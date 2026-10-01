import { useNavigate } from "@tanstack/react-router";
import { useEffect, useReducer } from "react";
import confetti from "canvas-confetti";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CascaTv } from "@/components/tv/CascaTv";
import { SalvarPontuacao } from "@/components/tv/SalvarPontuacao";
import {
  acertos,
  erros,
  estadoInicial,
  pontos,
  reducer,
  respostasParaSalvar,
} from "@/lib/jogos/classico";
import { limparPartida, type Partida } from "@/lib/jogos/partida";
import { LETRAS } from "@/lib/importacao/tipos";

/** Suspense entre o toque e a revelação (docs/TIME_06 §4: 1 s). */
const MS_DO_DESTAQUE = 1000;

type PartidaClassico = Extract<Partida, { modo: "classico" }>;

/** Partida do Modo TV Clássico (docs/TIME_06 §4 e §5). */
export function JogoClassico({ partida }: { partida: PartidaClassico }) {
  const navigate = useNavigate();
  const [estado, despachar] = useReducer(reducer, partida.perguntas, (perguntas) =>
    estadoInicial(perguntas, performance.now()),
  );

  // Destaque → revelação, depois de 1 s.
  useEffect(() => {
    if (estado.fase !== "destacando") return;
    const timer = window.setTimeout(() => despachar({ tipo: "revelar" }), MS_DO_DESTAQUE);
    return () => window.clearTimeout(timer);
  }, [estado.fase]);

  // Confete no fim, se houve acerto.
  useEffect(() => {
    if (estado.fase === "fim" && acertos(estado) > 0) {
      void confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.fase]);

  // ------------------------------------------------------------------ fim
  if (estado.fase === "fim") {
    return (
      <CascaTv>
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-8 text-center">
          <p className="font-display text-6xl font-extrabold text-amarelo">Fim do quiz!</p>
          <p className="font-display text-3xl">{partida.setorNome}</p>

          <dl className="grid w-full grid-cols-3 gap-4">
            {[
              { r: "Acertos", v: acertos(estado) },
              { r: "Erros", v: erros(estado) },
              { r: "Pontos", v: pontos(estado) },
            ].map((n) => (
              <div key={n.r} className="rounded-3xl bg-white/10 p-6">
                <dt className="text-lg text-white/70">{n.r}</dt>
                <dd className="font-display text-5xl font-extrabold tabular-nums">{n.v}</dd>
              </div>
            ))}
          </dl>

          <SalvarPontuacao
            eventoId={partida.eventoId}
            modo="classico"
            duracaoMs={Date.now() - partida.iniciadaEm}
            equipes={[{ setor_id: partida.setorId, pontos: pontos(estado) }]}
            respostas={respostasParaSalvar(estado, partida.setorId)}
          />

          <Button
            variant="outline"
            onClick={() => {
              limparPartida();
              void navigate({ to: "/tv", search: {} });
            }}
            className="min-h-16 border-white/30 px-8 text-xl text-white hover:bg-white/10"
          >
            Nova partida
          </Button>
        </div>
      </CascaTv>
    );
  }

  // ------------------------------------------------------------- pergunta
  const pergunta = estado.perguntas[estado.indice]!;
  const revelado = estado.fase === "revelado";

  return (
    <CascaTv>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-8 py-10">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-2xl text-white/70">
            Pergunta {estado.indice + 1} de {estado.perguntas.length}
            {pergunta.tema && ` · ${pergunta.tema}`}
          </p>
          <p className="font-display text-3xl font-extrabold text-amarelo">
            {partida.setorNome} · {pontos(estado)} pts
          </p>
        </header>

        <h1 className="font-display text-5xl font-extrabold leading-tight">{pergunta.enunciado}</h1>

        <ul className="grid flex-1 gap-4 sm:grid-cols-2">
          {pergunta.alternativas.map((a, i) => {
            const destacada = estado.escolhida === i;
            const certa = revelado && i === pergunta.correta;
            const errada = revelado && destacada && i !== pergunta.correta;

            let estilo = "border-white/20 bg-white/5";
            if (certa) estilo = "border-verde bg-verde/25";
            else if (errada) estilo = "border-vermelho bg-vermelho/25";
            else if (destacada) estilo = "border-amarelo bg-amarelo/20";

            return (
              <li key={i}>
                <button
                  type="button"
                  disabled={estado.fase !== "pergunta"}
                  onClick={() =>
                    despachar({ tipo: "escolher", alternativa: i, agora: performance.now() })
                  }
                  className={`flex min-h-32 w-full items-center gap-5 rounded-3xl border-4 p-6 text-left transition-colors ${estilo} disabled:cursor-default`}
                >
                  <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-white/15 font-display text-3xl font-extrabold">
                    {LETRAS[i]}
                  </span>
                  <span className="flex-1 text-3xl leading-snug">{a}</span>
                  {certa && <Check className="size-10 shrink-0 text-verde" aria-hidden />}
                  {errada && <X className="size-10 shrink-0 text-vermelho" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>

        {revelado && (
          <div className="rounded-3xl bg-white/10 p-6">
            {pergunta.explicacao && (
              <p className="text-2xl leading-relaxed">{pergunta.explicacao}</p>
            )}
            <Button
              onClick={() => despachar({ tipo: "avancar" })}
              className="mt-4 min-h-16 bg-amarelo px-8 text-xl font-bold text-texto hover:bg-amarelo/90"
            >
              {estado.indice + 1 >= estado.perguntas.length ? "Ver resultado" : "Próxima"}
            </Button>
          </div>
        )}
      </div>
    </CascaTv>
  );
}
