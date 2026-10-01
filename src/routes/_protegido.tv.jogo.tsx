import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useReducer, useState } from "react";
import confetti from "canvas-confetti";
import { Check, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CascaTv } from "@/components/tv/CascaTv";
import {
  acertos,
  erros,
  estadoInicial,
  pontos,
  reducer,
  respostasParaSalvar,
} from "@/lib/jogos/classico";
import { limparPartida, partidaAtual, type Partida } from "@/lib/jogos/partida";
import { LETRAS } from "@/lib/importacao/tipos";
import { mensagem } from "@/lib/mensagens";

/** Suspense entre o toque e a revelação (docs/TIME_06 §4: 1 s). */
const MS_DO_DESTAQUE = 1000;

/**
 * Partida do Modo TV Clássico (docs/TIME_06 §4 e §5).
 *
 * Separado em dois componentes porque o TypeScript nao estreita `partida` dentro
 * dos closures (`salvar`): o interno recebe a partida ja garantida.
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

  return <EmAndamento partida={partida} />;
}

function EmAndamento({ partida }: { partida: Partida }) {
  const navigate = useNavigate();
  const [estado, despachar] = useReducer(reducer, partida?.perguntas ?? [], (perguntas) =>
    estadoInicial(perguntas, performance.now()),
  );
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

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

  async function salvar() {
    if (!partida.eventoId) return;
    setSalvando(true);

    const { data, error } = await supabase.rpc("tecnico_salvar_quiz_tv", {
      p_evento: partida.eventoId,
      p_modo: "classico",
      p_duracao_ms: Date.now() - partida.iniciadaEm,
      p_equipes: [{ setor_id: partida.setorId, pontos: pontos(estado) }],
      p_respostas: respostasParaSalvar(estado, partida.setorId),
    });
    setSalvando(false);

    const r = data as { ok?: boolean; motivo?: string } | null;
    if (error || !r?.ok) {
      toast.error(
        r?.motivo === "evento_ja_tem_sessao"
          ? "Este evento já tem pontuação salva."
          : r?.motivo
            ? mensagem(r.motivo)
            : "Não foi possível salvar a pontuação.",
      );
      return;
    }
    setSalvo(true);
    toast.success("Pontuação salva. Os pontos entraram no ranking do setor.");
  }

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

          {partida.eventoId ? (
            salvo ? (
              <p className="flex items-center gap-2 text-2xl text-verde">
                <Check className="size-7" aria-hidden />
                Pontuação salva
              </p>
            ) : (
              <Button
                onClick={salvar}
                disabled={salvando}
                className="min-h-20 bg-amarelo px-10 text-2xl font-extrabold text-texto hover:bg-amarelo/90"
              >
                {salvando && <Loader2 className="size-6 animate-spin" aria-hidden />}
                <Save className="size-6" aria-hidden />
                Salvar pontuação
              </Button>
            )
          ) : (
            <p className="text-xl text-white/70">
              Treino: o resultado não é salvo e não entra no ranking.
            </p>
          )}

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
  const colunas = pergunta.alternativas.length > 4 ? "sm:grid-cols-2" : "sm:grid-cols-2";

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

        <ul className={`grid flex-1 gap-4 ${colunas}`}>
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

export const Route = createFileRoute("/_protegido/tv/jogo")({
  component: Jogo,
});
