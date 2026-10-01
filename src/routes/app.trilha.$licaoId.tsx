import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import confetti from "canvas-confetti";
import { ArrowLeft, Check, Loader2, X } from "lucide-react";
import { AlunoLayout } from "@/components/layout/AlunoLayout";
import { Button } from "@/components/ui/button";
import { rpcApp } from "@/lib/rpc";
import { sessao } from "@/lib/sessao";
import { mensagem } from "@/lib/mensagens";
import { LETRAS } from "@/lib/importacao/tipos";

type PerguntaAvaliacao = { id: string; enunciado: string; alternativas: string[] };

type Detalhe =
  | {
      ok: true;
      licao: {
        id: string;
        titulo: string;
        conteudo_md: string | null;
        video_url: string | null;
        carga_minutos: number;
        nota_minima: number;
      };
      progresso: {
        conteudo_concluido: boolean;
        melhor_nota: number | null;
        aprovado: boolean;
        tentativas_hoje: number;
      };
      /** Só vem depois de concluir o conteúdo — e nunca com gabarito. */
      avaliacao: PerguntaAvaliacao[] | null;
    }
  | { ok: false; motivo: string };

type ItemGabarito = {
  pergunta_id: string;
  correta: number;
  escolhida: number | null;
  acertou: boolean;
  explicacao: string | null;
};

type Correcao =
  | {
      ok: true;
      nota: number;
      aprovado: boolean;
      pontos: number;
      gabarito: ItemGabarito[];
      novos_selos: string[];
    }
  | { ok: false; motivo: string };

/** `https://youtu.be/ABC` → id, para montar o embed. */
function idDoYouTube(url: string | null): string | null {
  if (!url) return null;
  const padroes = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([A-Za-z0-9_-]{11})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const re of padroes) {
    const achado = re.exec(url);
    if (achado) return achado[1]!;
  }
  return null;
}

/** Lição e avaliação (docs/TIME_05 §6). */
function Licao() {
  const { licaoId } = Route.useParams();
  const navigate = useNavigate();

  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [concluindo, setConcluindo] = useState(false);
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [enviando, setEnviando] = useState(false);
  const [correcao, setCorrecao] = useState<Correcao | null>(null);

  async function carregar() {
    try {
      setDetalhe(await rpcApp<Detalhe>("colaborador_licao", { p_licao: licaoId }));
    } catch {
      setErro(mensagem("erro_interno"));
    }
  }

  useEffect(() => {
    if (!sessao.token()) {
      void navigate({ to: "/app/entrar", replace: true });
      return;
    }
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [licaoId, navigate]);

  /** "Terminei de estudar": libera a avaliação e pontua na primeira vez. */
  async function concluirConteudo() {
    setConcluindo(true);
    try {
      const r = await rpcApp<{
        ok: boolean;
        pontos?: number;
        novos_selos?: string[];
        motivo?: string;
      }>("colaborador_concluir_conteudo", { p_licao: licaoId });
      if (!r.ok) {
        setErro(mensagem(r.motivo));
        return;
      }
      if ((r.novos_selos ?? []).length > 0) {
        void confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 } });
      }
      await carregar();
    } catch {
      setErro(mensagem("erro_interno"));
    } finally {
      setConcluindo(false);
    }
  }

  async function enviarAvaliacao() {
    if (!detalhe?.ok || !detalhe.avaliacao) return;
    setEnviando(true);
    try {
      const r = await rpcApp<Correcao>("colaborador_enviar_avaliacao", {
        p_licao: licaoId,
        // O banco espera [{ pergunta_id, alternativa }].
        p_respostas: Object.entries(respostas).map(([pergunta_id, alternativa]) => ({
          pergunta_id,
          alternativa,
        })),
      });
      setCorrecao(r);
      if (r.ok && r.aprovado) {
        void confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
      }
      await carregar();
    } catch {
      setErro(mensagem("erro_interno"));
    } finally {
      setEnviando(false);
    }
  }

  if (erro) {
    return (
      <AlunoLayout comNavegacao>
        <p role="alert" className="rounded-2xl bg-superficie p-6 text-sm text-vermelho shadow-sm">
          {erro}
        </p>
      </AlunoLayout>
    );
  }

  if (!detalhe) {
    return (
      <AlunoLayout comNavegacao>
        <p className="rounded-2xl bg-superficie p-6 text-sm text-texto-suave shadow-sm">
          Carregando…
        </p>
      </AlunoLayout>
    );
  }

  if (!detalhe.ok) {
    return (
      <AlunoLayout comNavegacao>
        <div className="rounded-3xl bg-superficie p-6 text-center shadow-sm">
          <p className="text-sm text-texto">{mensagem(detalhe.motivo)}</p>
          <Link
            to="/app/trilha"
            className="mt-4 inline-block font-medium text-marinho underline-offset-4 hover:underline"
          >
            Voltar à trilha
          </Link>
        </div>
      </AlunoLayout>
    );
  }

  const { licao, progresso, avaliacao } = detalhe;
  const videoId = idDoYouTube(licao.video_url);
  const esgotou = progresso.tentativas_hoje >= 3;
  const porPergunta = new Map(
    (correcao?.ok ? correcao.gabarito : []).map((g) => [g.pergunta_id, g]),
  );

  return (
    <AlunoLayout comNavegacao>
      <div className="flex flex-col gap-4">
        <Link to="/app/trilha" className="flex items-center gap-1.5 text-sm font-medium text-white">
          <ArrowLeft className="size-4" aria-hidden />
          Trilha
        </Link>

        <div className="rounded-3xl bg-superficie p-5 shadow-sm">
          <h1 className="font-display text-xl font-extrabold text-marinho">{licao.titulo}</h1>
          <p className="mt-1 text-sm text-texto-suave">
            {licao.carga_minutos} min · nota mínima {licao.nota_minima}
            {progresso.aprovado && ` · aprovado com ${progresso.melhor_nota}`}
          </p>

          {videoId && (
            <div className="mt-4 aspect-video overflow-hidden rounded-xl bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                title={`Vídeo da lição ${licao.titulo}`}
                allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
                className="size-full"
              />
            </div>
          )}

          {licao.conteudo_md && (
            <div className="prose-time mt-4 text-base leading-relaxed text-texto">
              <Markdown>{licao.conteudo_md}</Markdown>
            </div>
          )}

          {!progresso.conteudo_concluido && (
            <Button
              onClick={concluirConteudo}
              disabled={concluindo}
              className="mt-5 min-h-14 w-full bg-amarelo text-base font-bold text-texto hover:bg-amarelo/90"
            >
              {concluindo && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Terminei de estudar
            </Button>
          )}
        </div>

        {progresso.conteudo_concluido && (avaliacao?.length ?? 0) === 0 && (
          <p className="rounded-2xl bg-superficie p-5 text-sm text-texto-suave shadow-sm">
            Esta lição ainda não tem avaliação. Volte depois.
          </p>
        )}

        {progresso.conteudo_concluido && (avaliacao?.length ?? 0) > 0 && (
          <div className="rounded-3xl bg-superficie p-5 shadow-sm">
            <h2 className="font-display text-lg font-bold text-marinho">Avaliação</h2>
            <p className="mt-1 text-sm text-texto-suave">
              {correcao?.ok
                ? `Nota ${correcao.nota}. ${correcao.aprovado ? "Aprovado! ✅" : "Faltou pouco!"}`
                : `${progresso.tentativas_hoje} de 3 tentativas usadas hoje.`}
            </p>

            <ol className="mt-4 flex flex-col gap-5">
              {avaliacao!.map((p, i) => {
                const g = porPergunta.get(p.id);
                return (
                  <li key={p.id}>
                    <p className="font-medium text-texto">
                      {i + 1}. {p.enunciado}
                    </p>
                    <ul className="mt-2 flex flex-col gap-2">
                      {p.alternativas.map((a, j) => {
                        const escolhida = respostas[p.id] === j;
                        let estilo = "border-borda bg-superficie";
                        if (g) {
                          if (g.correta === j) estilo = "border-verde bg-verde/10";
                          else if (g.escolhida === j) estilo = "border-vermelho bg-vermelho/10";
                        } else if (escolhida) {
                          estilo = "border-marinho bg-marinho/5";
                        }
                        return (
                          <li key={j}>
                            <button
                              type="button"
                              disabled={Boolean(correcao) || enviando}
                              onClick={() => setRespostas((r) => ({ ...r, [p.id]: j }))}
                              className={`flex min-h-12 w-full items-center gap-2.5 rounded-xl border-2 px-3 py-2 text-left text-sm transition-colors ${estilo} disabled:cursor-default`}
                            >
                              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-display font-bold text-marinho">
                                {LETRAS[j]}
                              </span>
                              <span className="flex-1 text-texto">{a}</span>
                              {g?.correta === j && (
                                <Check className="size-4 text-verde" aria-hidden />
                              )}
                              {g && g.escolhida === j && !g.acertou && (
                                <X className="size-4 text-vermelho" aria-hidden />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    {g?.explicacao && (
                      <p className="mt-2 rounded-lg bg-fundo p-3 text-sm text-texto">
                        {g.explicacao}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>

            {!correcao && (
              <>
                <Button
                  onClick={enviarAvaliacao}
                  disabled={
                    enviando || esgotou || Object.keys(respostas).length < (avaliacao?.length ?? 0)
                  }
                  className="mt-5 min-h-14 w-full bg-amarelo text-base font-bold text-texto hover:bg-amarelo/90"
                >
                  {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  Enviar avaliação
                </Button>
                {esgotou && (
                  <p className="mt-2 text-center text-sm text-laranja">
                    {mensagem("limite_tentativas")}
                  </p>
                )}
              </>
            )}

            {correcao && !correcao.ok && (
              <p className="mt-4 text-sm text-vermelho">{mensagem(correcao.motivo)}</p>
            )}

            {correcao?.ok && !correcao.aprovado && (
              <div className="mt-5">
                <p className="text-sm text-texto">
                  Faltou pouco! Revise o conteúdo e tente de novo.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCorrecao(null);
                    setRespostas({});
                  }}
                  disabled={progresso.tentativas_hoje >= 3}
                  className="mt-3 min-h-12 w-full"
                >
                  Tentar de novo
                </Button>
              </div>
            )}

            {correcao?.ok && correcao.aprovado && (
              <p className="mt-5 rounded-xl bg-verde/10 p-4 text-center font-display font-bold text-verde">
                Aprovado com {correcao.nota}! +{correcao.pontos} pontos
              </p>
            )}
          </div>
        )}
      </div>
    </AlunoLayout>
  );
}

export const Route = createFileRoute("/app/trilha/$licaoId")({
  component: Licao,
});
