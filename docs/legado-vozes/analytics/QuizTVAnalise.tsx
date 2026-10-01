import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Analytics } from "@/hooks/useAnalytics";
import { alternativaTexto, formatarData, type Letra } from "@/lib/vozes";
import { cn } from "@/lib/utils";
import { Secao, percentual, segundos } from "./Secao";

export function QuizTVAnalise({
  quizzes,
  quizRespostas,
  perguntas,
  nomeDaTurma,
}: {
  quizzes: Analytics["quizzes"];
  quizRespostas: Analytics["quizRespostas"];
  perguntas: Analytics["perguntas"];
  nomeDaTurma: Analytics["nomeDaTurma"];
}) {
  const [aberta, setAberta] = useState<string | null>(null);

  const porPergunta = useMemo(() => new Map(perguntas.map((p) => [p.id, p])), [perguntas]);

  const sessoes = useMemo(
    () =>
      [...quizzes].sort((a, b) =>
        String(b.created_at ?? b.data ?? "").localeCompare(String(a.created_at ?? a.data ?? "")),
      ),
    [quizzes],
  );

  return (
    <Secao
      titulo="Quiz TV — análise das sessões"
      descricao="Cada sessão realizada na TV, pergunta a pergunta."
      vazio={sessoes.length === 0}
      mensagemVazio="Nenhum quiz na TV foi realizado ainda."
    >
      <div className="space-y-3">
        {sessoes.map((sessao) => {
          const expandida = aberta === sessao.id;
          const linhas = quizRespostas
            .filter((r) => r.quiz_tv_id === sessao.id)
            .sort((a, b) => a.ordem - b.ordem);

          const tempos = linhas.map((r) => r.tempo_resposta_ms ?? 0).filter((t) => t > 0);
          const tempoMedio =
            tempos.length > 0 ? tempos.reduce((s, t) => s + t, 0) / tempos.length : null;
          const maisRapida = tempos.length > 0 ? Math.min(...tempos) : null;
          const maisLenta = tempos.length > 0 ? Math.max(...tempos) : null;

          return (
            <div key={sessao.id} className="rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setAberta(expandida ? null : sessao.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <div>
                  <p className="font-semibold">Turma {nomeDaTurma(sessao.turma_id)}</p>
                  <p className="text-xs text-muted-foreground">{formatarData(sessao.data)}</p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-grafico-acerto">
                    {sessao.acertos}/{sessao.total_perguntas} acertos
                  </span>
                  <span className="font-bold text-primary">{sessao.pontuacao} pts</span>
                  <span className="text-muted-foreground">{segundos(tempoMedio)} / pergunta</span>
                  <ChevronDown
                    className={cn("size-4 transition-transform", expandida && "rotate-180")}
                  />
                </div>
              </button>

              {expandida && (
                <div className="border-t border-border p-4">
                  <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>
                      Taxa de acerto:{" "}
                      <strong className="text-foreground">
                        {percentual((sessao.acertos / (sessao.total_perguntas || 1)) * 100)}
                      </strong>
                    </span>
                    <span>
                      Mais rápida:{" "}
                      <strong className="text-foreground">{segundos(maisRapida)}</strong>
                    </span>
                    <span>
                      Mais lenta: <strong className="text-foreground">{segundos(maisLenta)}</strong>
                    </span>
                    <span>
                      Tempo total:{" "}
                      <strong className="text-foreground">{segundos(sessao.tempo_total_ms)}</strong>
                    </span>
                  </div>

                  {linhas.length === 0 ? (
                    <p className="py-3 text-center text-sm text-muted-foreground">
                      Esta sessão não tem o detalhamento por pergunta.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-140 text-sm">
                        <thead className="bg-muted text-left">
                          <tr>
                            <th className="rounded-l-lg px-3 py-2 font-semibold">#</th>
                            <th className="px-3 py-2 font-semibold">Pergunta</th>
                            <th className="px-3 py-2 font-semibold">Respondeu</th>
                            <th className="px-3 py-2 font-semibold">Resultado</th>
                            <th className="rounded-r-lg px-3 py-2 text-right font-semibold">
                              Tempo
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {linhas.map((r) => {
                            const pergunta = r.pergunta_id
                              ? porPergunta.get(r.pergunta_id)
                              : undefined;
                            const letra = r.alternativa_escolhida?.toUpperCase() as Letra;
                            return (
                              <tr key={r.id} className="border-t border-border">
                                <td className="px-3 py-2 text-muted-foreground">{r.ordem}</td>
                                <td className="max-w-sm px-3 py-2">
                                  <span className="line-clamp-1">
                                    {pergunta?.enunciado ?? "Pergunta removida"}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <span className="font-bold">{letra}</span>
                                  {pergunta && (
                                    <span className="ml-1 text-xs text-muted-foreground">
                                      {alternativaTexto(pergunta, letra)}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {r.acertou ? (
                                    <span className="font-medium text-grafico-acerto">
                                      ✅ Acertou
                                    </span>
                                  ) : (
                                    <span className="font-medium text-grafico-erro">❌ Errou</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {segundos(r.tempo_resposta_ms)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Secao>
  );
}
