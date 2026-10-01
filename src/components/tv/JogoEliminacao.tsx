import { useNavigate } from "@tanstack/react-router";
import { useEffect, useReducer, useState } from "react";
import confetti from "canvas-confetti";
import { Check, Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CascaTv } from "@/components/tv/CascaTv";
import { SalvarPontuacao } from "@/components/tv/SalvarPontuacao";
import {
  AJUDAS,
  MAXIMO_DA_RODADA,
  PERGUNTAS_POR_RODADA,
  ROTULO_DA_AJUDA,
  SEGUNDOS_DE_CONSULTA,
  VALORES,
  equipeDaVez,
  equipesEliminacaoParaSalvar,
  estadoInicialEliminacao,
  perguntaAtual,
  placarEliminacao,
  reducerEliminacao,
  respostasEliminacaoParaSalvar,
  valorAtual,
} from "@/lib/jogos/eliminacao";
import { limparPartida, type Partida } from "@/lib/jogos/partida";
import { LETRAS } from "@/lib/importacao/tipos";

type PartidaEliminacao = Extract<Partida, { modo: "eliminacao" }>;

const MEDALHAS = ["🥇", "🥈", "🥉"] as const;

/**
 * Eliminação (docs/TIME_06 §4).
 *
 * Uma equipe por vez, 5 perguntas de 2 a 40 pontos. Errar zera o acumulado da
 * rodada e passa a vez. Três ajudas por turno: 50/50, Pular e Consultar equipe.
 */
export function JogoEliminacao({ partida }: { partida: PartidaEliminacao }) {
  const navigate = useNavigate();
  const [estado, despachar] = useReducer(reducerEliminacao, null, () =>
    estadoInicialEliminacao(partida.perguntasPorEquipe, partida.equipes, Date.now()),
  );
  const [consultaRestante, setConsultaRestante] = useState(SEGUNDOS_DE_CONSULTA);

  // Relógio da ajuda "Consultar equipe": 15 s e volta para a pergunta.
  useEffect(() => {
    if (!estado.consultando) return;
    const inicio = Date.now();
    setConsultaRestante(SEGUNDOS_DE_CONSULTA);
    const timer = window.setInterval(() => {
      const falta = SEGUNDOS_DE_CONSULTA - Math.floor((Date.now() - inicio) / 1000);
      setConsultaRestante(Math.max(0, falta));
      if (falta <= 0) despachar({ tipo: "fimDaConsulta" });
    }, 250);
    return () => window.clearInterval(timer);
  }, [estado.consultando]);

  useEffect(() => {
    if (estado.fase === "fim") {
      void confetti({ particleCount: 180, spread: 100, origin: { y: 0.6 } });
    }
  }, [estado.fase]);

  const equipe = equipeDaVez(estado);
  const pergunta = perguntaAtual(estado);

  // ------------------------------------------------------------------ fim
  if (estado.fase === "fim") {
    const classificacao = placarEliminacao(estado);
    return (
      <CascaTv>
        <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-6 px-8 py-10 text-center">
          <p className="font-display text-6xl font-extrabold text-amarelo">Fim da eliminação!</p>

          <ol className="flex w-full flex-col gap-3">
            {classificacao.map((l, i) => (
              <li
                key={l.equipe.setorId}
                className="flex items-center gap-4 rounded-3xl bg-white/10 p-5 text-left"
              >
                <span className="font-display text-4xl font-extrabold">
                  {MEDALHAS[i] ?? `${l.posicao}º`}
                </span>
                <span
                  className="size-8 shrink-0 rounded-full border-2 border-white/40"
                  style={{ backgroundColor: l.equipe.cor }}
                  aria-hidden
                />
                <span className="flex-1 font-display text-3xl font-bold">{l.equipe.nome}</span>
                <span className="text-xl text-white/70">
                  {l.acertos} acerto(s) · {l.erros} erro(s)
                </span>
                <span className="font-display text-4xl font-extrabold tabular-nums text-amarelo">
                  {l.pontos}
                </span>
              </li>
            ))}
          </ol>

          <p className="text-lg text-white/60">Máximo possível por rodada: {MAXIMO_DA_RODADA}.</p>

          <SalvarPontuacao
            eventoId={partida.eventoId}
            modo="eliminacao"
            duracaoMs={Date.now() - partida.iniciadaEm}
            equipes={equipesEliminacaoParaSalvar(estado)}
            respostas={respostasEliminacaoParaSalvar(estado)}
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

  // --------------------------------------------------------- fim do turno
  if (estado.fase === "fimDoTurno") {
    const ultima = estado.turno + 1 >= estado.equipes.length;
    return (
      <CascaTv>
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-8 text-center">
          <p className="font-display text-5xl font-extrabold">{equipe?.nome}</p>
          {estado.acumulado > 0 ? (
            <>
              <p className="font-display text-7xl font-extrabold text-amarelo tabular-nums">
                {estado.acumulado}
              </p>
              <p className="text-2xl text-white/70">pontos nesta rodada</p>
            </>
          ) : (
            <p className="text-3xl text-white/80">
              A rodada fecha em zero — errar zera o acumulado.
            </p>
          )}
          <Button
            onClick={() => despachar({ tipo: "avancar" })}
            className="min-h-20 bg-amarelo px-10 text-2xl font-extrabold text-texto hover:bg-amarelo/90"
          >
            {ultima ? "Ver resultado" : `Vez de ${estado.equipes[estado.turno + 1]?.nome}`}
          </Button>
        </div>
      </CascaTv>
    );
  }

  if (!pergunta || !equipe) return null;

  const revelado = estado.fase === "revelado";

  return (
    <CascaTv>
      <div className="mx-auto flex min-h-screen max-w-7xl gap-6 px-8 py-8">
        <div className="flex flex-1 flex-col gap-5">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-3 font-display text-3xl font-extrabold">
              <span
                className="size-7 shrink-0 rounded-full border-2 border-white/40"
                style={{ backgroundColor: equipe.cor }}
                aria-hidden
              />
              {equipe.nome}
            </p>
            <p className="text-2xl text-white/70">
              Pergunta {estado.indice + 1} de {PERGUNTAS_POR_RODADA}
              {pergunta.tema && ` · ${pergunta.tema}`}
            </p>
          </header>

          {/* Escada de valores: a equipe vê quanto está em jogo. */}
          <ol className="flex gap-2">
            {VALORES.map((v, i) => (
              <li
                key={v}
                className={`flex-1 rounded-xl border-2 py-2 text-center font-display text-xl font-extrabold tabular-nums ${
                  i < estado.indice
                    ? "border-verde bg-verde/20 text-white"
                    : i === estado.indice
                      ? "border-amarelo bg-amarelo/25 text-amarelo"
                      : "border-white/15 text-white/40"
                }`}
              >
                {v}
              </li>
            ))}
          </ol>

          <h1 className="font-display text-5xl font-extrabold leading-tight">
            {pergunta.enunciado}
          </h1>

          {estado.consultando && (
            <p className="flex items-center gap-3 rounded-2xl bg-amarelo/20 p-4 font-display text-3xl font-extrabold text-amarelo">
              <Timer className="size-8" aria-hidden />
              Consultando a equipe — {consultaRestante}s
            </p>
          )}

          <ul className="grid flex-1 gap-4 sm:grid-cols-2">
            {pergunta.alternativas.map((a, i) => {
              const apagada = estado.apagadas.includes(i);
              const escolhida = estado.escolhida === i;
              const certa = revelado && i === pergunta.correta;
              const errada = revelado && escolhida && i !== pergunta.correta;

              let estilo = "border-white/20 bg-white/5";
              if (apagada) estilo = "border-white/5 bg-white/5 opacity-25 line-through";
              else if (certa) estilo = "border-verde bg-verde/25";
              else if (errada) estilo = "border-vermelho bg-vermelho/25";

              return (
                <li key={i}>
                  <button
                    type="button"
                    disabled={revelado || apagada || estado.consultando}
                    onClick={() =>
                      despachar({ tipo: "responder", alternativa: i, agora: Date.now() })
                    }
                    className={`flex min-h-28 w-full items-center gap-5 rounded-3xl border-4 p-5 text-left transition-colors ${estilo} disabled:cursor-default`}
                  >
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/15 font-display text-2xl font-extrabold">
                      {LETRAS[i]}
                    </span>
                    <span className="flex-1 text-3xl leading-snug">{a}</span>
                    {certa && <Check className="size-9 shrink-0 text-verde" aria-hidden />}
                    {errada && <X className="size-9 shrink-0 text-vermelho" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>

          {!revelado && (
            <ul className="flex flex-wrap gap-3">
              {AJUDAS.map((ajuda) => {
                const usada = !estado.ajudasRestantes.includes(ajuda);
                const r = ROTULO_DA_AJUDA[ajuda];
                return (
                  <li key={ajuda}>
                    <button
                      type="button"
                      disabled={usada || estado.consultando}
                      onClick={() => despachar({ tipo: "usarAjuda", ajuda })}
                      title={r.ajuda}
                      className={`min-h-16 rounded-2xl border-4 px-6 text-xl font-bold ${
                        usada
                          ? "border-white/10 text-white/25 line-through"
                          : "border-amarelo text-amarelo"
                      }`}
                    >
                      {r.emoji} {r.rotulo}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {revelado && (
            <div className="rounded-3xl bg-white/10 p-6">
              {pergunta.explicacao && (
                <p className="text-2xl leading-relaxed">{pergunta.explicacao}</p>
              )}
              <p className="mt-2 text-2xl font-bold">
                {estado.errou ? (
                  <span className="text-vermelho">Errou — a rodada zera aqui.</span>
                ) : (
                  <span className="text-verde">
                    Acertou! Acumulado: {estado.acumulado} ponto(s).
                  </span>
                )}
              </p>
              <Button
                onClick={() => despachar({ tipo: "avancar" })}
                className="mt-4 min-h-16 bg-amarelo px-8 text-xl font-bold text-texto hover:bg-amarelo/90"
              >
                Continuar
              </Button>
            </div>
          )}
        </div>

        <aside className="flex w-56 shrink-0 flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-amarelo">Rodada</h2>
          <div className="rounded-2xl border-4 border-amarelo/60 p-3 text-center">
            <p className="text-sm text-white/70">Acumulado</p>
            <p className="font-display text-4xl font-extrabold tabular-nums">{estado.acumulado}</p>
            <p className="mt-1 text-sm text-white/60">
              Vale agora: <strong>{valorAtual(estado)}</strong>
            </p>
          </div>

          <h2 className="mt-2 font-display text-xl font-bold text-amarelo">Fechados</h2>
          {estado.equipes.map((e, i) => (
            <div
              key={e.setorId}
              className={`rounded-2xl border-2 p-3 ${
                i === estado.turno ? "border-amarelo" : "border-white/15"
              }`}
              style={{ backgroundColor: `${e.cor}26` }}
            >
              <p className="font-display text-base font-bold">{e.nome}</p>
              <p className="font-display text-2xl font-extrabold tabular-nums">
                {i < estado.turno
                  ? (estado.pontos[e.setorId] ?? 0)
                  : i === estado.turno
                    ? "…"
                    : "—"}
              </p>
            </div>
          ))}
        </aside>
      </div>
    </CascaTv>
  );
}
