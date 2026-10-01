import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCampanhas } from "@/hooks/useCampanhas";
import { useSetores } from "@/hooks/useEventos";
import {
  comPosicao,
  medalha,
  useRankingIndividual,
  useRankingSetor,
  useResultadosCongelados,
} from "@/hooks/useRanking";
import { baixarCsv, montarCsv } from "@/lib/eventos";
import { COR_DO_STATUS, ROTULO_DO_STATUS } from "@/lib/campanha";

/** Rankings individual e por setor (docs/TIME_04 §11). */
function Ranking() {
  const { data: campanhas = [] } = useCampanhas();
  const { data: setores = [] } = useSetores();

  const [campanhaId, setCampanhaId] = useState<string | null>(null);
  const [aba, setAba] = useState<"individual" | "setores">("individual");
  const [filtroSetor, setFiltroSetor] = useState("");

  // Abre na campanha ativa; se não houver, na mais recente.
  useEffect(() => {
    if (campanhaId || campanhas.length === 0) return;
    setCampanhaId((campanhas.find((c) => c.status === "ativa") ?? campanhas[0]!).id);
  }, [campanhas, campanhaId]);

  const campanha = campanhas.find((c) => c.id === campanhaId) ?? null;
  const encerrada = campanha?.status === "encerrada";

  const { data: individual = [], isLoading: carregandoInd } = useRankingIndividual(campanhaId);
  const { data: porSetor = [] } = useRankingSetor(campanhaId);
  const { data: congelados = [] } = useResultadosCongelados(encerrada ? campanhaId : null);

  const nomeDoSetor = useMemo(() => new Map(setores.map((s) => [s.id, s.nome])), [setores]);

  const individualFiltrado = filtroSetor
    ? individual.filter((l) => l.setor_id === filtroSetor)
    : individual;
  const comColocacao = comPosicao(individualFiltrado);
  const setoresComColocacao = comPosicao(porSetor);

  function exportar() {
    if (aba === "individual") {
      baixarCsv(
        `ranking-individual-${campanha?.nome ?? "campanha"}.csv`,
        montarCsv(
          [
            "posicao",
            "nome",
            "matricula",
            "setor",
            "total",
            "conhecimento",
            "relatos",
            "engajamento",
          ],
          comColocacao.map((l) => [
            l.posicao,
            l.nome,
            l.matricula,
            l.setor_id ? (nomeDoSetor.get(l.setor_id) ?? "") : "",
            l.total,
            l.conhecimento,
            l.relatos,
            l.engajamento,
          ]),
        ),
      );
    } else {
      baixarCsv(
        `ranking-setores-${campanha?.nome ?? "campanha"}.csv`,
        montarCsv(
          [
            "posicao",
            "setor",
            "colaboradores_ativos",
            "media_individual",
            "pontos_quiz_tv",
            "total",
          ],
          setoresComColocacao.map((l) => [
            l.posicao,
            l.nome,
            l.colaboradores_ativos,
            l.pontos_individuais,
            l.pontos_quiz_tv,
            l.total,
          ]),
        ),
      );
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-marinho">Ranking</h1>
          <p className="mt-1 text-sm text-texto-suave">
            Individual soma os pontos da campanha. Setor é a média por colaborador ativo mais os
            pontos do Modo TV — assim um setor pequeno e engajado pode vencer um grande.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={exportar}
          disabled={
            aba === "individual" ? comColocacao.length === 0 : setoresComColocacao.length === 0
          }
        >
          <Download className="size-4" aria-hidden />
          Exportar CSV
        </Button>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-borda bg-superficie p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="campanha-ranking">Campanha</Label>
          <select
            id="campanha-ranking"
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

        {aba === "individual" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="setor-ranking">Setor</Label>
            <select
              id="setor-ranking"
              value={filtroSetor}
              onChange={(e) => setFiltroSetor(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">Todos</option>
              {setores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>
        )}

        {campanha && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${COR_DO_STATUS[campanha.status]}`}
          >
            {ROTULO_DO_STATUS[campanha.status]}
          </span>
        )}
      </div>

      {encerrada && (
        <p className="flex items-start gap-2 rounded-2xl bg-marinho/10 p-4 text-sm text-marinho">
          <Snowflake className="mt-0.5 size-4 shrink-0" aria-hidden />
          Campanha encerrada: o resultado oficial são as {congelados.length} linha(s) congeladas em{" "}
          <code>campanha_resultados</code>. A tabela abaixo mostra a apuração atual, que serve de
          conferência.
        </p>
      )}

      <div className="flex gap-1 rounded-xl bg-muted p-1">
        {(
          [
            { id: "individual" as const, rotulo: "Individual" },
            { id: "setores" as const, rotulo: "Setores" },
          ] satisfies { id: "individual" | "setores"; rotulo: string }[]
        ).map((a) => (
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

      {aba === "individual" ? (
        carregandoInd ? (
          <p className="text-sm text-texto-suave">Carregando…</p>
        ) : comColocacao.length === 0 ? (
          <p className="rounded-2xl border border-borda bg-superficie p-6 text-center text-sm text-texto-suave">
            Ninguém pontuou nesta campanha ainda.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-borda bg-superficie">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-texto-suave">
                  <th className="p-3">#</th>
                  <th className="p-3">Colaborador</th>
                  <th className="p-3">Setor</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-right">🧠</th>
                  <th className="p-3 text-right">📢</th>
                  <th className="p-3 text-right">🔥</th>
                </tr>
              </thead>
              <tbody>
                {comColocacao.map((l) => (
                  <tr key={l.colaborador_id} className="border-b border-borda last:border-0">
                    <td className="p-3 font-semibold tabular-nums">
                      {medalha(l.posicao) ?? l.posicao}
                    </td>
                    <td className="p-3">
                      {l.nome}
                      <span className="ml-1 text-xs text-texto-suave">{l.matricula}</span>
                    </td>
                    <td className="p-3 text-texto-suave">
                      {l.setor_id ? (nomeDoSetor.get(l.setor_id) ?? "—") : "—"}
                    </td>
                    <td className="p-3 text-right font-bold tabular-nums text-marinho">
                      {l.total}
                    </td>
                    <td className="p-3 text-right tabular-nums text-texto-suave">
                      {l.conhecimento}
                    </td>
                    <td className="p-3 text-right tabular-nums text-texto-suave">{l.relatos}</td>
                    <td className="p-3 text-right tabular-nums text-texto-suave">
                      {l.engajamento}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : setoresComColocacao.length === 0 ? (
        <p className="rounded-2xl border border-borda bg-superficie p-6 text-center text-sm text-texto-suave">
          Nenhum setor pontuou nesta campanha ainda.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-borda bg-superficie">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-texto-suave">
                <th className="p-3">#</th>
                <th className="p-3">Setor</th>
                <th className="p-3 text-right">Ativos</th>
                <th className="p-3 text-right">Média individual</th>
                <th className="p-3 text-right">Modo TV</th>
                <th className="p-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {setoresComColocacao.map((l) => (
                <tr key={l.setor_id} className="border-b border-borda last:border-0">
                  <td className="p-3 font-semibold tabular-nums">
                    {medalha(l.posicao) ?? l.posicao}
                  </td>
                  <td className="p-3">{l.nome}</td>
                  <td className="p-3 text-right tabular-nums text-texto-suave">
                    {l.colaboradores_ativos}
                  </td>
                  <td className="p-3 text-right tabular-nums text-texto-suave">
                    {l.pontos_individuais}
                  </td>
                  <td className="p-3 text-right tabular-nums text-texto-suave">
                    {l.pontos_quiz_tv}
                  </td>
                  <td className="p-3 text-right font-bold tabular-nums text-marinho">{l.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_protegido/painel/ranking")({
  component: Ranking,
});
