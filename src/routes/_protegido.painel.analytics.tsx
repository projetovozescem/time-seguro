import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useCampanhas } from "@/hooks/useCampanhas";
import { useSetores } from "@/hooks/useEventos";
import { useLocais } from "@/hooks/useLocais";
import { useTemas } from "@/hooks/usePerguntas";
import {
  useDesempenhoPerguntas,
  useLacunas,
  usePerguntasMaisErradas,
  useVisaoGeral,
} from "@/hooks/useAnalytics";
import {
  FAIXAS,
  MINIMO_RESPOSTAS,
  montarMatriz,
  percentual,
  contarPorFaixa,
  prioridadeDeTreinamento,
  type Celula,
} from "@/lib/lacunas";
import { baixarCsv, montarCsv } from "@/lib/eventos";
import { LETRAS } from "@/lib/importacao/tipos";
import { ROTULO_DO_STATUS } from "@/lib/campanha";
import { AbaEngajamento, AbaRelatos } from "@/components/painel/AbasAnalytics";
import { LegendaDasFaixas } from "@/components/painel/LegendaDasFaixas";
import { MaisOpcoes } from "@/components/painel/MaisOpcoes";

type Aba = "geral" | "lacunas" | "perguntas" | "relatos" | "engajamento";

/** Gaveta da célula: as 5 perguntas mais erradas daquele setor e tema. */
function GavetaDaCelula({
  celula,
  campanhaId,
  nomeDoSetor,
  nomeDoTema,
  aoFechar,
}: {
  celula: Celula;
  campanhaId: string;
  nomeDoSetor: string;
  nomeDoTema: string;
  aoFechar: () => void;
}) {
  const { data: perguntas = [], isLoading } = usePerguntasMaisErradas(campanhaId, celula.tema_id);

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-marinho">
            {nomeDoSetor} · {nomeDoTema}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-texto-suave">
          {celula.tentativas < MINIMO_RESPOSTAS
            ? `Só ${celula.tentativas} resposta(s). Sem dado suficiente para concluir nada — rode um quiz deste tema antes de tirar conclusão.`
            : `${percentual(celula.taxa)}% de acerto em ${celula.tentativas} respostas. ${FAIXAS[celula.faixa].leitura}.`}
        </p>

        <div>
          <h3 className="text-sm font-semibold text-texto">Perguntas mais erradas do tema</h3>
          {isLoading && <p className="mt-2 text-sm text-texto-suave">Carregando…</p>}
          {!isLoading && perguntas.length === 0 && (
            <p className="mt-2 text-sm text-texto-suave">
              Ninguém respondeu perguntas deste tema ainda.
            </p>
          )}
          <ol className="mt-2 flex flex-col gap-3">
            {perguntas.map((p) => (
              <li key={p.pergunta_id} className="rounded-xl bg-fundo p-3">
                <p className="text-sm text-texto">{p.enunciado}</p>
                <p className="mt-1 text-xs text-texto-suave">
                  {percentual(Number(p.taxa_acerto))}% de acerto em {p.tentativas} respostas
                  {p.alternativa_errada_mais_comum !== null && (
                    <>
                      {" "}
                      · erro mais comum:{" "}
                      <strong>{LETRAS[p.alternativa_errada_mais_comum] ?? "?"}</strong>
                    </>
                  )}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" asChild>
            <Link to="/painel/eventos">Agendar DDS sobre este tema</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/painel/campanhas">Criar lição</Link>
          </Button>
          <Button onClick={aoFechar}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Analytics e mapa de lacunas (docs/TIME_09 §1). */
function Analytics() {
  const { data: campanhas = [] } = useCampanhas();
  const { data: setores = [] } = useSetores();
  const { data: temas = [] } = useTemas();
  const { data: locais = [] } = useLocais();

  const [campanhaId, setCampanhaId] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("lacunas");
  const [aberta, setAberta] = useState<Celula | null>(null);

  useEffect(() => {
    if (campanhaId || campanhas.length === 0) return;
    setCampanhaId((campanhas.find((c) => c.status === "ativa") ?? campanhas[0]!).id);
  }, [campanhas, campanhaId]);

  const { data: lacunas = [], isLoading: carregandoLacunas } = useLacunas(campanhaId);
  const { data: desempenho = [] } = useDesempenhoPerguntas(campanhaId);
  const { data: geral } = useVisaoGeral(campanhaId);

  const nomeDoSetor = useMemo(() => new Map(setores.map((s) => [s.id, s.nome])), [setores]);
  const nomeDoTema = useMemo(
    () => new Map(temas.map((t) => [t.id, `${t.icone} ${t.nome}`])),
    [temas],
  );
  const nomeDoLocal = useMemo(() => new Map(locais.map((l) => [l.id, l.nome])), [locais]);

  // Só os temas que aparecem nos dados, para a matriz não virar um deserto.
  const temasDaMatriz = useMemo(() => {
    const comDado = new Set(lacunas.map((l) => l.tema_id));
    return temas.filter((t) => comDado.has(t.id)).map((t) => t.id);
  }, [lacunas, temas]);

  const setoresDaMatriz = useMemo(() => setores.map((s) => s.id), [setores]);

  const matriz = useMemo(
    () => montarMatriz(lacunas, setoresDaMatriz, temasDaMatriz),
    [lacunas, setoresDaMatriz, temasDaMatriz],
  );

  const prioridades = useMemo(() => prioridadeDeTreinamento(matriz), [matriz]);
  const contagemPorFaixa = useMemo(() => contarPorFaixa(matriz), [matriz]);

  function exportarLacunas() {
    baixarCsv(
      `mapa-de-lacunas-${new Date().toISOString().slice(0, 10)}.csv`,
      montarCsv(
        ["setor", "tema", "tentativas", "acertos", "taxa_acerto_percentual", "leitura"],
        [...matriz.values()].map((c) => [
          nomeDoSetor.get(c.setor_id) ?? c.setor_id,
          nomeDoTema.get(c.tema_id) ?? c.tema_id,
          c.tentativas,
          c.acertos,
          c.tentativas >= MINIMO_RESPOSTAS ? percentual(c.taxa) : "",
          FAIXAS[c.faixa].leitura,
        ]),
      ),
    );
  }

  const ABAS: { id: Aba; rotulo: string }[] = [
    { id: "geral", rotulo: "Visão geral" },
    { id: "lacunas", rotulo: "🔍 Mapa de lacunas" },
    { id: "perguntas", rotulo: "Perguntas" },
    { id: "relatos", rotulo: "Relatos" },
    { id: "engajamento", rotulo: "Engajamento" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">Resultados</h1>

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-borda bg-superficie p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="campanha-analytics">Campanha</Label>
          <select
            id="campanha-analytics"
            value={campanhaId ?? ""}
            onChange={(e) => setCampanhaId(e.target.value || null)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {campanhas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} ({ROTULO_DO_STATUS[c.status]})
              </option>
            ))}
          </select>
        </div>
        {aba === "lacunas" && (
          <MaisOpcoes
            opcoes={[
              {
                rotulo: "Exportar CSV",
                icone: <Download aria-hidden />,
                aoClicar: exportarLacunas,
                desabilitado: matriz.size === 0,
              },
            ]}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAba(a.id)}
            aria-pressed={aba === a.id}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
              aba === a.id ? "bg-superficie text-marinho shadow-sm" : "text-texto-suave"
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {aba === "geral" && (
        <>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { r: "Colaboradores ativos", v: geral?.colaboradoresAtivos },
              { r: "Participaram", v: geral?.participantes },
              { r: "Respostas", v: geral?.respostas },
              {
                r: "Taxa de acerto",
                v: geral ? `${percentual(geral.taxaAcerto)}%` : undefined,
              },
              { r: "Lições aprovadas", v: geral?.licoesAprovadas },
              { r: "Relatos recebidos", v: geral?.relatos },
              { r: "Relatos validados", v: geral?.relatosValidados },
            ].map((n) => (
              <div key={n.r} className="rounded-2xl border border-borda bg-superficie p-4">
                <dt className="text-xs uppercase tracking-wide text-texto-suave">{n.r}</dt>
                <dd className="mt-1 font-display text-2xl font-extrabold tabular-nums text-marinho">
                  {n.v ?? "—"}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}

      {aba === "lacunas" && (
        <>
          <LegendaDasFaixas contagem={contagemPorFaixa} />

          {carregandoLacunas && <p className="text-sm text-texto-suave">Carregando…</p>}

          {!carregandoLacunas && matriz.size === 0 && (
            <p className="rounded-2xl border border-borda bg-superficie p-6 text-center text-sm text-texto-suave">
              Sem respostas nesta campanha ainda. O mapa aparece quando o pessoal começar a
              responder o quiz.
            </p>
          )}

          {matriz.size > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-borda bg-superficie">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="p-3 text-left text-xs uppercase tracking-wide text-texto-suave">
                      Setor
                    </th>
                    {temasDaMatriz.map((t) => (
                      <th
                        key={t}
                        className="p-3 text-center text-xs font-semibold text-texto-suave"
                      >
                        {nomeDoTema.get(t) ?? t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {setoresDaMatriz.map((s) => (
                    <tr key={s} className="border-t border-borda">
                      <th className="p-3 text-left font-medium text-texto">
                        {nomeDoSetor.get(s) ?? s}
                      </th>
                      {temasDaMatriz.map((t) => {
                        const c = matriz.get(`${s}|${t}`)!;
                        return (
                          <td key={t} className="p-1.5">
                            <button
                              type="button"
                              onClick={() => setAberta(c)}
                              title={`${FAIXAS[c.faixa].leitura} · ${c.tentativas} resposta(s)`}
                              className={`flex min-h-12 w-full flex-col items-center justify-center rounded-lg px-2 py-1 font-semibold tabular-nums ${FAIXAS[c.faixa].cor}`}
                            >
                              {c.tentativas >= MINIMO_RESPOSTAS ? (
                                <>
                                  <span>{percentual(c.taxa)}%</span>
                                  <span className="text-[10px] font-normal opacity-80">
                                    {c.tentativas} resp.
                                  </span>
                                </>
                              ) : (
                                <span className="text-xs">
                                  {c.tentativas === 0 ? "sem dado" : `${c.tentativas} resp.`}
                                </span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {prioridades.length > 0 && (
            <section className="rounded-2xl border border-borda bg-superficie p-4">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-marinho">
                <Target className="size-5" aria-hidden />O que treinar primeiro
              </h2>
              <ol className="mt-2 flex flex-col gap-1.5 text-sm">
                {prioridades.slice(0, 5).map((c) => (
                  <li key={`${c.setor_id}|${c.tema_id}`} className="flex flex-wrap gap-x-2">
                    <strong className="text-texto">{nomeDoSetor.get(c.setor_id)}</strong>
                    <span className="text-texto-suave">{nomeDoTema.get(c.tema_id)}</span>
                    <span className="ml-auto tabular-nums text-texto">{percentual(c.taxa)}%</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      {aba === "relatos" && (
        <AbaRelatos
          campanhaId={campanhaId}
          nomeDoSetor={(id) => nomeDoSetor.get(id) ?? "Setor removido"}
          nomeDoLocal={(id) => nomeDoLocal.get(id) ?? "Local removido"}
        />
      )}

      {aba === "engajamento" && <AbaEngajamento campanhaId={campanhaId} />}

      {aba === "perguntas" && (
        <>
          <p className="text-sm text-texto-suave">
            Ordenado pelas mais erradas. Serve para revisar pergunta mal formulada — uma taxa muito
            baixa pode ser enunciado confuso, não falta de conhecimento.
          </p>
          {desempenho.length === 0 ? (
            <p className="rounded-2xl border border-borda bg-superficie p-6 text-center text-sm text-texto-suave">
              Nenhuma pergunta respondida nesta campanha ainda.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-borda bg-superficie">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-texto-suave">
                    <th className="p-3">Pergunta</th>
                    <th className="p-3">Tema</th>
                    <th className="p-3 text-right">Tentativas</th>
                    <th className="p-3 text-right">% acerto</th>
                    <th className="p-3 text-center">Erro mais comum</th>
                  </tr>
                </thead>
                <tbody>
                  {desempenho.map((p) => (
                    <tr key={p.pergunta_id} className="border-b border-borda last:border-0">
                      <td className="max-w-md p-3 text-texto">{p.enunciado}</td>
                      <td className="p-3 text-texto-suave">{nomeDoTema.get(p.tema_id) ?? "—"}</td>
                      <td className="p-3 text-right tabular-nums text-texto-suave">
                        {p.tentativas}
                      </td>
                      <td className="p-3 text-right font-bold tabular-nums text-marinho">
                        {percentual(Number(p.taxa_acerto))}%
                      </td>
                      <td className="p-3 text-center font-semibold text-texto-suave">
                        {p.alternativa_errada_mais_comum !== null
                          ? (LETRAS[p.alternativa_errada_mais_comum] ?? "—")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {aberta && campanhaId && (
        <GavetaDaCelula
          celula={aberta}
          campanhaId={campanhaId}
          nomeDoSetor={nomeDoSetor.get(aberta.setor_id) ?? aberta.setor_id}
          nomeDoTema={nomeDoTema.get(aberta.tema_id) ?? aberta.tema_id}
          aoFechar={() => setAberta(null)}
        />
      )}
    </div>
  );
}

export const Route = createFileRoute("/_protegido/painel/analytics")({
  component: Analytics,
});
