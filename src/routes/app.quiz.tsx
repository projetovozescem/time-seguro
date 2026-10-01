import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import confetti from "canvas-confetti";
import { AlunoLayout } from "@/components/layout/AlunoLayout";
import { Button } from "@/components/ui/button";
import { rpcApp } from "@/lib/rpc";
import { sessao } from "@/lib/sessao";
import { mensagem } from "@/lib/mensagens";

const LETRAS = ["A", "B", "C", "D", "E"] as const;

/** Uma pergunta como `colaborador_perguntas_do_dia` devolve (docs/TIME_02 §5.3). */
type Pergunta = {
  id: string;
  enunciado: string;
  alternativas: string[];
  tema: string;
  tema_icone: string | null;
  respondida: boolean;
  acertou: boolean | null;
  alternativa_escolhida: number | null;
  /** Só vem preenchido nas perguntas JÁ respondidas — nunca antes. */
  correta: number | null;
  explicacao: string | null;
};

type ListaDoDia =
  | { ok: true; dia: string; perguntas: Pergunta[]; pontos_por_acerto: number }
  | { ok: false; motivo: string };

type Correcao =
  | {
      ok: true;
      acertou: boolean;
      correta: number;
      explicacao: string | null;
      pontos: number;
      novos_selos: string[];
    }
  | { ok: false; motivo: string; correta?: number; explicacao?: string | null };

/**
 * Quiz do dia (docs/TIME_05 §5). Fluxo: lista → uma pergunta por vez →
 * correção pelo servidor com explicação → resumo do dia.
 *
 * O gabarito NUNCA é pedido antes da resposta: `correta` só existe no retorno de
 * `colaborador_responder_pergunta` e nas perguntas já respondidas.
 */
function AppQuiz() {
  const navigate = useNavigate();
  const [lista, setLista] = useState<ListaDoDia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [indice, setIndice] = useState(0);
  const [correcao, setCorrecao] = useState<Correcao | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pontosDeHoje, setPontosDeHoje] = useState(0);
  const [acertosDeHoje, setAcertosDeHoje] = useState(0);
  const abertaEm = useRef<number>(Date.now());

  useEffect(() => {
    if (!sessao.token()) {
      void navigate({ to: "/app/entrar", replace: true });
      return;
    }
    rpcApp<ListaDoDia>("colaborador_perguntas_do_dia")
      .then((r) => {
        setLista(r);
        if (r.ok) {
          // Retoma de onde parou: primeira pergunta ainda sem resposta.
          const proxima = r.perguntas.findIndex((p) => !p.respondida);
          setIndice(proxima === -1 ? r.perguntas.length : proxima);
          setAcertosDeHoje(r.perguntas.filter((p) => p.acertou === true).length);
        }
      })
      .catch(() => setErro(mensagem("erro_interno")));
  }, [navigate]);

  async function responder(alternativa: number) {
    if (!lista?.ok || enviando) return;
    const pergunta = lista.perguntas[indice];
    if (!pergunta) return;

    setEnviando(true);
    try {
      const r = await rpcApp<Correcao>("colaborador_responder_pergunta", {
        p_pergunta_id: pergunta.id,
        p_alternativa: alternativa,
        p_tempo_ms: Date.now() - abertaEm.current,
      });
      setCorrecao(r);

      if (r.ok) {
        setPontosDeHoje((p) => p + r.pontos);
        if (r.acertou) setAcertosDeHoje((a) => a + 1);
        if (r.novos_selos.length > 0) {
          void confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 } });
        }
      }
    } catch {
      setErro(mensagem("erro_interno"));
    } finally {
      setEnviando(false);
    }
  }

  function avancar() {
    setCorrecao(null);
    setIndice((i) => i + 1);
    abertaEm.current = Date.now();
  }

  if (erro) {
    return (
      <AlunoLayout>
        <p role="alert" className="rounded-2xl bg-superficie p-6 text-sm text-vermelho shadow-sm">
          {erro}
        </p>
      </AlunoLayout>
    );
  }

  if (!lista) {
    return (
      <AlunoLayout>
        <p className="rounded-2xl bg-superficie p-6 text-sm text-texto-suave shadow-sm">
          Carregando o quiz…
        </p>
      </AlunoLayout>
    );
  }

  if (!lista.ok) {
    return (
      <AlunoLayout>
        <div className="rounded-3xl bg-superficie p-6 text-center shadow-sm">
          <p className="text-sm text-texto">{mensagem(lista.motivo)}</p>
          <Link
            to="/app/inicio"
            className="mt-4 inline-block font-medium text-marinho underline-offset-4 hover:underline"
          >
            Voltar ao início
          </Link>
        </div>
      </AlunoLayout>
    );
  }

  // Fim do dia: resumo (docs/TIME_05 §5.4 e §5.5)
  if (indice >= lista.perguntas.length) {
    const total = lista.perguntas.length;
    return (
      <AlunoLayout>
        <div className="rounded-3xl bg-superficie p-6 text-center shadow-sm">
          <p className="font-display text-xl font-extrabold text-marinho">
            {pontosDeHoje > 0 ? "Quiz de hoje concluído!" : "Você já fez o quiz de hoje."}
          </p>
          <p className="mt-2 text-sm text-texto-suave">
            {pontosDeHoje > 0
              ? `${acertosDeHoje} de ${total} acertos · +${pontosDeHoje} pontos`
              : "Volte amanhã! 🔥 Não quebre a sequência."}
          </p>
          <Link
            to="/app/inicio"
            className="mt-5 inline-flex min-h-12 items-center rounded-2xl bg-marinho px-6 font-display font-bold text-white"
          >
            Voltar ao início
          </Link>
        </div>
      </AlunoLayout>
    );
  }

  const pergunta = lista.perguntas[indice]!;
  const gabarito = correcao?.ok ? correcao.correta : correcao?.correta;
  const explicacao = correcao?.ok ? correcao.explicacao : correcao?.explicacao;

  return (
    <AlunoLayout>
      <div className="rounded-3xl bg-superficie p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-texto-suave">
            {pergunta.tema_icone} {pergunta.tema}
          </span>
          <span className="text-xs font-semibold tabular-nums text-texto-suave">
            Pergunta {indice + 1} de {lista.perguntas.length}
          </span>
        </div>

        <h1 className="mt-4 font-display text-lg font-bold leading-snug text-texto">
          {pergunta.enunciado}
        </h1>

        <ul className="mt-5 flex flex-col gap-2.5">
          {pergunta.alternativas.map((texto, i) => {
            const respondeu = correcao !== null;
            const ehCorreta = respondeu && gabarito === i;
            const escolhida =
              respondeu && correcao?.ok === true && !correcao.acertou && gabarito !== i;

            let estilo = "border-borda bg-superficie text-texto";
            if (ehCorreta) estilo = "border-verde bg-verde/10 text-texto";
            else if (escolhida) estilo = "border-vermelho bg-vermelho/10 text-texto";

            return (
              <li key={i}>
                <button
                  type="button"
                  disabled={respondeu || enviando}
                  onClick={() => responder(i)}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors ${estilo} disabled:cursor-default`}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-display font-bold text-marinho">
                    {LETRAS[i]}
                  </span>
                  <span className="flex-1 text-base">{texto}</span>
                  {ehCorreta && <Check className="size-5 shrink-0 text-verde" aria-hidden />}
                  {escolhida && <X className="size-5 shrink-0 text-vermelho" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>

        {enviando && (
          <p className="mt-4 flex items-center gap-2 text-sm text-texto-suave">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Conferindo…
          </p>
        )}

        {correcao && (
          <div className="mt-5 rounded-2xl bg-fundo p-4">
            {correcao.ok ? (
              <p className="font-display font-bold text-texto">
                {correcao.acertou ? `✅ Acertou! +${correcao.pontos} pts` : "❌ Não foi essa."}
              </p>
            ) : (
              <p className="font-display font-bold text-texto">{mensagem(correcao.motivo)}</p>
            )}
            {explicacao && <p className="mt-2 text-sm leading-relaxed text-texto">{explicacao}</p>}

            <Button
              onClick={avancar}
              className="mt-4 min-h-12 w-full bg-amarelo font-bold text-texto hover:bg-amarelo/90"
            >
              {indice + 1 >= lista.perguntas.length ? "Ver resumo" : "Próxima"}
            </Button>
          </div>
        )}
      </div>
    </AlunoLayout>
  );
}

export const Route = createFileRoute("/app/quiz")({
  component: AppQuiz,
});
