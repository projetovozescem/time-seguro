import { useNavigate } from "@tanstack/react-router";
import { useEffect, useReducer, useState } from "react";
import confetti from "canvas-confetti";
import { Check, Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CascaTv } from "@/components/tv/CascaTv";
import { SalvarPontuacao } from "@/components/tv/SalvarPontuacao";
import {
  SEGUNDOS_POR_PERGUNTA,
  equipesParaSalvar,
  estadoInicialDuelo,
  placar,
  pontosDaVez,
  reducerDuelo,
  respostasDueloParaSalvar,
} from "@/lib/jogos/duelo";
import { limparPartida, type Partida } from "@/lib/jogos/partida";
import { LETRAS } from "@/lib/importacao/tipos";
import { corDoTexto } from "@/lib/jogos/cores";

type PartidaDuelo = Extract<Partida, { modo: "duelo" }>;

const MEDALHAS = ["🥇", "🥈", "🥉"] as const;

/**
 * Duelo de Setores (docs/TIME_06 §4).
 *
 * O fluxo é: a pergunta aparece para todos, o técnico toca no buzzer do setor
 * que levantou a mão primeiro e depois na alternativa que a equipe escolheu.
 * Quem acerta primeiro leva mais. Timer de 30 s.
 */
export function JogoDuelo({ partida }: { partida: PartidaDuelo }) {
  const navigate = useNavigate();
  const [estado, despachar] = useReducer(reducerDuelo, null, () =>
    estadoInicialDuelo(partida.perguntas, partida.equipes, Date.now()),
  );
  /** Setor que apertou o buzzer e ainda não escolheu a alternativa. */
  const [naVez, setNaVez] = useState<string | null>(null);
  const [restantes, setRestantes] = useState(SEGUNDOS_POR_PERGUNTA);

  // Timer de 30 s. Roda só na fase de pergunta; `abertaEm` reinicia a contagem.
  useEffect(() => {
    if (estado.fase !== "pergunta") return;
    const inicio = Date.now();
    setRestantes(SEGUNDOS_POR_PERGUNTA);
    const timer = window.setInterval(() => {
      const passados = Math.floor((Date.now() - inicio) / 1000);
      const falta = SEGUNDOS_POR_PERGUNTA - passados;
      setRestantes(Math.max(0, falta));
      if (falta <= 0) despachar({ tipo: "tempoEsgotou" });
    }, 250);
    return () => window.clearInterval(timer);
  }, [estado.fase, estado.indice]);

  // Buzzer aberto só até a equipe responder; a troca de pergunta limpa a vez.
  useEffect(() => setNaVez(null), [estado.indice, estado.fase]);

  useEffect(() => {
    if (estado.fase === "fim") {
      void confetti({ particleCount: 180, spread: 100, origin: { y: 0.6 } });
    }
  }, [estado.fase]);

  const classificacao = placar(estado);

  // ------------------------------------------------------------------ fim
  if (estado.fase === "fim") {
    return (
      <CascaTv>
        <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-6 px-8 py-10 text-center">
          <p className="font-display text-6xl font-extrabold text-amarelo">Fim do duelo!</p>

          <ol className="flex w-full flex-col gap-3">
            {classificacao.map((l, i) => (
              <li
                key={l.equipe.setorId}
                className="flex items-center gap-4 rounded-3xl bg-white/10 p-5 text-left"
              >
                <span className="font-display text-4xl font-extrabold tabular-nums">
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

          <SalvarPontuacao
            eventoId={partida.eventoId}
            modo="duelo"
            duracaoMs={Date.now() - partida.iniciadaEm}
            equipes={equipesParaSalvar(estado)}
            respostas={respostasDueloParaSalvar(estado)}
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
  const todasResponderam = estado.jaResponderam.length >= estado.equipes.length;

  return (
    <CascaTv>
      <div className="mx-auto flex min-h-screen max-w-7xl gap-6 px-8 py-8">
        <div className="flex flex-1 flex-col gap-5">
          <header className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-2xl text-white/70">
              Pergunta {estado.indice + 1} de {estado.perguntas.length}
              {pergunta.tema && ` · ${pergunta.tema}`}
            </p>
            {!revelado && (
              <p
                className={`flex items-center gap-2 font-display text-4xl font-extrabold tabular-nums ${
                  restantes <= 5 ? "text-vermelho" : "text-amarelo"
                }`}
              >
                <Timer className="size-8" aria-hidden />
                {restantes}s
              </p>
            )}
          </header>

          <h1 className="font-display text-5xl font-extrabold leading-tight">
            {pergunta.enunciado}
          </h1>

          {/* Passo 1: quem apertou o buzzer. Passo 2: o que a equipe respondeu. */}
          {!revelado && naVez === null && (
            <section className="flex flex-col gap-3">
              <p className="text-2xl text-white/70">
                Quem levantou a mão primeiro? Próximo acerto vale{" "}
                <strong className="text-amarelo">{pontosDaVez(estado.acertaramNaOrdem)}</strong>.
              </p>
              <ul className="grid gap-4 sm:grid-cols-2">
                {estado.equipes.map((e) => {
                  const jaRespondeu = estado.jaResponderam.includes(e.setorId);
                  return (
                    <li key={e.setorId}>
                      <button
                        type="button"
                        disabled={jaRespondeu}
                        onClick={() => setNaVez(e.setorId)}
                        style={{ backgroundColor: jaRespondeu ? undefined : e.cor }}
                        className={`min-h-28 w-full rounded-3xl border-4 border-white/30 px-6 font-display text-3xl font-extrabold ${
                          jaRespondeu ? "bg-white/5 text-white/30" : corDoTexto(e.cor)
                        }`}
                      >
                        {e.nome}
                        {jaRespondeu && <span className="block text-xl">já respondeu</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {!revelado && naVez !== null && (
            <section className="flex flex-1 flex-col gap-3">
              <p className="text-2xl text-white/70">
                Resposta de{" "}
                <strong className="text-amarelo">
                  {estado.equipes.find((e) => e.setorId === naVez)?.nome}
                </strong>
                :
              </p>
              <ul className="grid flex-1 gap-4 sm:grid-cols-2">
                {pergunta.alternativas.map((a, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => {
                        despachar({
                          tipo: "responder",
                          setorId: naVez,
                          alternativa: i,
                          agora: Date.now(),
                        });
                        setNaVez(null);
                      }}
                      className="flex min-h-28 w-full items-center gap-5 rounded-3xl border-4 border-white/20 bg-white/5 p-5 text-left"
                    >
                      <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/15 font-display text-2xl font-extrabold">
                        {LETRAS[i]}
                      </span>
                      <span className="flex-1 text-3xl leading-snug">{a}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                onClick={() => setNaVez(null)}
                className="min-h-14 self-start border-white/30 px-6 text-lg text-white hover:bg-white/10"
              >
                Voltar
              </Button>
            </section>
          )}

          {!revelado && naVez === null && !todasResponderam && (
            <Button
              variant="outline"
              onClick={() => despachar({ tipo: "revelar" })}
              className="min-h-14 self-start border-white/30 px-6 text-lg text-white hover:bg-white/10"
            >
              Ninguém soube — revelar
            </Button>
          )}

          {revelado && (
            <section className="flex flex-col gap-4">
              <ul className="grid gap-3 sm:grid-cols-2">
                {pergunta.alternativas.map((a, i) => {
                  const certa = i === pergunta.correta;
                  return (
                    <li
                      key={i}
                      className={`flex min-h-20 items-center gap-4 rounded-3xl border-4 p-4 ${
                        certa ? "border-verde bg-verde/25" : "border-white/10 bg-white/5 opacity-60"
                      }`}
                    >
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/15 font-display text-xl font-extrabold">
                        {LETRAS[i]}
                      </span>
                      <span className="flex-1 text-2xl">{a}</span>
                      {certa && <Check className="size-8 shrink-0 text-verde" aria-hidden />}
                    </li>
                  );
                })}
              </ul>

              {estado.tempoEsgotado && estado.acertaramNaOrdem.length === 0 && (
                <p className="text-2xl text-white/70">
                  Tempo esgotado sem acerto — ninguém pontuou nesta pergunta.
                </p>
              )}

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
            </section>
          )}
        </div>

        {/* Placar lateral (docs/TIME_06 §5): um card por setor, na cor dele. */}
        <aside className="flex w-64 shrink-0 flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-amarelo">Placar</h2>
          {classificacao.map((l) => {
            const acertouAgora = estado.acertaramNaOrdem.includes(l.equipe.setorId);
            return (
              <div
                key={l.equipe.setorId}
                className={`rounded-2xl border-4 p-3 ${
                  acertouAgora ? "border-verde" : "border-white/20"
                }`}
                style={{ backgroundColor: `${l.equipe.cor}33` }}
              >
                <p className="flex items-center gap-2 font-display text-lg font-bold">
                  <span
                    className="size-4 shrink-0 rounded-full"
                    style={{ backgroundColor: l.equipe.cor }}
                    aria-hidden
                  />
                  {l.equipe.nome}
                </p>
                <p className="font-display text-3xl font-extrabold tabular-nums">{l.pontos}</p>
                <p className="flex items-center gap-2 text-sm text-white/70">
                  <Check className="size-4" aria-hidden />
                  {l.acertos}
                  <X className="size-4" aria-hidden />
                  {l.erros}
                </p>
              </div>
            );
          })}
        </aside>
      </div>
    </CascaTv>
  );
}
