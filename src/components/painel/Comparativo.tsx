import { useMemo, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useComparativo } from "@/hooks/useAnalytics";
import {
  frasesDeDestaque,
  participacao,
  seta,
  taxaGeral,
  taxaPorTema,
  variacoes,
} from "@/lib/comparativo";
import { formatarDuracao } from "@/lib/analytics";
import { baixarCsv, montarCsv } from "@/lib/eventos";
import { formatarData } from "@/lib/datas";

/** Mínimo e máximo de campanhas no comparativo (docs/TIME_09 §3). */
const MINIMO = 2;
const MAXIMO = 4;

type CampanhaSimples = { id: string; nome: string; inicio: string; fim: string; status: string };

/**
 * Comparativo trimestral (docs/TIME_09 §3).
 *
 * Compara de 2 a 4 campanhas: participação, taxa de acerto geral e por tema,
 * mapa de lacunas antes × depois com setas, relatos e ranking de setores.
 * As contas vivem em `src/lib/comparativo.ts`, testado sem navegador.
 */
export function Comparativo({
  campanhas,
  nomeDoSetor,
  nomeDoTema,
  nomeDaEmpresa,
}: {
  campanhas: readonly CampanhaSimples[];
  nomeDoSetor: (id: string) => string;
  nomeDoTema: (id: string) => string;
  nomeDaEmpresa: string;
}) {
  const [marcadas, setMarcadas] = useState<string[]>(() =>
    campanhas.slice(0, MINIMO).map((c) => c.id),
  );
  const [gerando, setGerando] = useState(false);

  const { data: dados, isLoading } = useComparativo(marcadas);

  function alternar(id: string) {
    setMarcadas((atual) => {
      if (atual.includes(id)) return atual.filter((x) => x !== id);
      if (atual.length >= MAXIMO) return atual;
      return [...atual, id];
    });
  }

  // Ordem cronológica: "antes × depois" só faz sentido na ordem do calendário.
  const naOrdem = useMemo(
    () =>
      (dados ?? [])
        .map((d) => ({ ...d, campanha: campanhas.find((c) => c.id === d.campanhaId)! }))
        .filter((d) => d.campanha !== undefined)
        .sort((a, b) => a.campanha.inicio.localeCompare(b.campanha.inicio)),
    [dados, campanhas],
  );

  const primeira = naOrdem[0];
  const ultima = naOrdem.at(-1);

  const lista = useMemo(
    () =>
      primeira && ultima && primeira !== ultima ? variacoes(primeira.lacunas, ultima.lacunas) : [],
    [primeira, ultima],
  );
  const frases = useMemo(
    () => frasesDeDestaque(lista, nomeDoSetor, nomeDoTema),
    [lista, nomeDoSetor, nomeDoTema],
  );

  // Temas que aparecem em alguma das campanhas escolhidas.
  const temas = useMemo(() => {
    const ids = new Set<string>();
    for (const d of naOrdem) for (const l of d.lacunas) ids.add(l.tema_id);
    return [...ids].sort((a, b) => nomeDoTema(a).localeCompare(nomeDoTema(b), "pt-BR"));
  }, [naOrdem, nomeDoTema]);

  const taxasPorCampanha = useMemo(
    () => naOrdem.map((d) => ({ campanhaId: d.campanhaId, porTema: taxaPorTema(d.lacunas) })),
    [naOrdem],
  );

  const LINHAS: { rotulo: string; valor: (d: (typeof naOrdem)[number]) => string }[] = [
    { rotulo: "Participação", valor: (d) => `${participacao(d)}%` },
    { rotulo: "Participantes", valor: (d) => `${d.participantes} de ${d.ativos}` },
    { rotulo: "Respostas", valor: (d) => String(d.tentativas) },
    { rotulo: "Taxa de acerto", valor: (d) => (taxaGeral(d) === null ? "—" : `${taxaGeral(d)}%`) },
    { rotulo: "Relatos recebidos", valor: (d) => String(d.relatosRecebidos) },
    { rotulo: "Relatos validados", valor: (d) => String(d.relatosValidados) },
    { rotulo: "Relatos resolvidos", valor: (d) => String(d.relatosResolvidos) },
    { rotulo: "Tempo médio até resolver", valor: (d) => formatarDuracao(d.horasAteResolver) },
  ];

  function exportarCsv() {
    const cabecalho = ["indicador", ...naOrdem.map((d) => d.campanha.nome)];
    const corpo: (string | number)[][] = LINHAS.map((l) => [
      l.rotulo,
      ...naOrdem.map((d) => l.valor(d)),
    ]);

    for (const temaId of temas) {
      corpo.push([
        `taxa de acerto — ${nomeDoTema(temaId)}`,
        ...taxasPorCampanha.map((t) => {
          const v = t.porTema.get(temaId);
          return v?.taxa === null || v === undefined ? "" : `${v.taxa}%`;
        }),
      ]);
    }

    for (const v of lista) {
      corpo.push([
        `variação — ${nomeDoSetor(v.setor_id)} / ${nomeDoTema(v.tema_id)}`,
        `${v.antes}%`,
        `${v.depois}%`,
        `${v.delta > 0 ? "+" : ""}${v.delta} pontos`,
      ]);
    }

    baixarCsv(
      `comparativo-${new Date().toISOString().slice(0, 10)}.csv`,
      montarCsv(cabecalho, corpo),
    );
  }

  /** PDF montado por texto (como o Relatório de Evidência), não por captura. */
  async function gerarPdf() {
    if (naOrdem.length < MINIMO) return;
    setGerando(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const largura = pdf.internal.pageSize.getWidth();
      const altura = pdf.internal.pageSize.getHeight();
      const margem = 40;
      let y = margem;

      const quebraDePagina = (espaco: number) => {
        if (y + espaco < altura - margem) return;
        pdf.addPage();
        y = margem;
      };

      pdf.setFontSize(16);
      pdf.text("Comparativo entre campanhas", margem, y);
      y += 20;
      pdf.setFontSize(10);
      pdf.setTextColor(90);
      pdf.text(`${nomeDaEmpresa} · T.I.M.E. Seguro`, margem, y);
      y += 14;
      pdf.text(
        naOrdem
          .map(
            (d) =>
              `${d.campanha.nome} (${formatarData(d.campanha.inicio)} a ${formatarData(d.campanha.fim)})`,
          )
          .join("   ·   "),
        margem,
        y,
      );
      pdf.setTextColor(0);
      y += 24;

      if (frases.length > 0) {
        pdf.setFontSize(11);
        for (const f of frases) {
          const linhas = pdf.splitTextToSize(`• ${f}`, largura - margem * 2);
          pdf.text(linhas, margem, y);
          y += linhas.length * 14;
        }
        y += 10;
      }

      const colunas = [220, ...naOrdem.map(() => (largura - margem * 2 - 220) / naOrdem.length)];
      const escreverLinha = (celulas: string[], negrito = false) => {
        quebraDePagina(18);
        pdf.setFont("helvetica", negrito ? "bold" : "normal");
        let x = margem;
        celulas.forEach((texto, i) => {
          pdf.text(texto, x, y, { maxWidth: colunas[i]! - 6 });
          x += colunas[i]!;
        });
        pdf.setFont("helvetica", "normal");
        y += 16;
      };

      pdf.setFontSize(10);
      escreverLinha(["Indicador", ...naOrdem.map((d) => d.campanha.nome)], true);
      for (const l of LINHAS) escreverLinha([l.rotulo, ...naOrdem.map((d) => l.valor(d))]);

      y += 10;
      escreverLinha(["Taxa de acerto por tema", ...naOrdem.map(() => "")], true);
      for (const temaId of temas) {
        escreverLinha([
          nomeDoTema(temaId),
          ...taxasPorCampanha.map((t) => {
            const v = t.porTema.get(temaId);
            return v?.taxa === null || v === undefined ? "—" : `${v.taxa}%`;
          }),
        ]);
      }

      if (lista.length > 0) {
        y += 10;
        escreverLinha(
          [
            `Mapa de lacunas: ${primeira!.campanha.nome} x ${ultima!.campanha.nome}`,
            ...naOrdem.map(() => ""),
          ],
          true,
        );
        for (const v of lista) {
          escreverLinha([
            `${nomeDoSetor(v.setor_id)} · ${nomeDoTema(v.tema_id)}`,
            `${v.antes}% → ${v.depois}%`,
            `${seta(v.delta)} ${v.delta > 0 ? "+" : ""}${v.delta} pontos`,
          ]);
        }
      }

      pdf.setFontSize(7);
      pdf.setTextColor(110);
      pdf.text(
        "Comparativo gerado pelo T.I.M.E. Seguro a partir das respostas e dos relatos registrados no sistema.",
        margem,
        altura - 20,
      );

      pdf.save(`comparativo-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Comparativo em PDF gerado.");
    } catch {
      toast.error("Não foi possível gerar o PDF.");
    } finally {
      setGerando(false);
    }
  }

  if (campanhas.length < MINIMO) {
    return (
      <section className="rounded-2xl border border-borda bg-superficie p-6 text-center text-sm text-texto-suave">
        O comparativo precisa de pelo menos duas campanhas. Hoje existe{" "}
        {campanhas.length === 0 ? "nenhuma" : "só uma"}.
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-xl font-extrabold text-marinho">Comparativo</h2>
        <p className="mt-1 text-sm text-texto-suave">
          Escolha de {MINIMO} a {MAXIMO} campanhas. As setas comparam a primeira com a última, em
          ordem de calendário, e só aparecem onde houve resposta suficiente nas duas.
        </p>
      </div>

      <fieldset className="flex flex-wrap gap-3 rounded-2xl border border-borda bg-superficie p-4">
        <legend className="px-1 text-sm font-medium">Campanhas</legend>
        {campanhas.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={marcadas.includes(c.id)}
              onCheckedChange={() => alternar(c.id)}
              disabled={!marcadas.includes(c.id) && marcadas.length >= MAXIMO}
              aria-label={c.nome}
            />
            <span className="text-texto">
              {c.nome}
              <span className="ml-1 text-xs text-texto-suave">{formatarData(c.inicio)}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {marcadas.length < MINIMO && (
        <p className="text-sm text-texto-suave">Marque pelo menos duas campanhas.</p>
      )}

      {isLoading && marcadas.length >= MINIMO && (
        <p className="text-sm text-texto-suave">Carregando…</p>
      )}

      {naOrdem.length >= MINIMO && (
        <>
          {frases.length > 0 && (
            <ul className="flex flex-col gap-2 rounded-2xl border border-amarelo bg-amarelo/10 p-4">
              {frases.map((f) => (
                <li key={f} className="text-sm font-medium text-texto">
                  {f}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={exportarCsv}>
              <Download className="size-4" aria-hidden />
              Exportar CSV
            </Button>
            <Button onClick={gerarPdf} disabled={gerando}>
              {gerando ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <FileText className="size-4" aria-hidden />
              )}
              Gerar PDF
            </Button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-borda bg-superficie">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-texto-suave">
                  <th className="p-3">Indicador</th>
                  {naOrdem.map((d) => (
                    <th key={d.campanhaId} className="p-3">
                      {d.campanha.nome}
                      <span className="block font-normal normal-case">
                        {formatarData(d.campanha.inicio)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LINHAS.map((l) => (
                  <tr key={l.rotulo} className="border-b border-borda last:border-0">
                    <td className="p-3 text-texto-suave">{l.rotulo}</td>
                    {naOrdem.map((d) => (
                      <td key={d.campanhaId} className="p-3 font-semibold tabular-nums text-texto">
                        {l.valor(d)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-texto-suave">
            A participação usa o efetivo <strong>de hoje</strong>: o sistema não guarda o quadro de
            pessoal de cada trimestre.
          </p>

          {temas.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-borda bg-superficie">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-texto-suave">
                    <th className="p-3">Taxa de acerto por tema</th>
                    {naOrdem.map((d) => (
                      <th key={d.campanhaId} className="p-3">
                        {d.campanha.nome}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {temas.map((temaId) => (
                    <tr key={temaId} className="border-b border-borda last:border-0">
                      <td className="p-3 text-texto">{nomeDoTema(temaId)}</td>
                      {taxasPorCampanha.map((t) => {
                        const v = t.porTema.get(temaId);
                        return (
                          <td
                            key={t.campanhaId}
                            className="p-3 font-semibold tabular-nums text-texto"
                          >
                            {v === undefined || v.taxa === null ? "—" : `${v.taxa}%`}
                            {v !== undefined && (
                              <span className="ml-1 text-xs font-normal text-texto-suave">
                                ({v.tentativas})
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="rounded-2xl border border-borda bg-superficie p-4">
            <h3 className="font-display text-base font-bold text-marinho">
              Mapa de lacunas: {primeira!.campanha.nome} × {ultima!.campanha.nome}
            </h3>
            {lista.length === 0 ? (
              <p className="mt-2 text-sm text-texto-suave">
                Nenhuma célula tem resposta suficiente nas duas campanhas para comparar. Sem isso,
                qualquer variação seria ruído.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1.5">
                {lista.map((v) => (
                  <li
                    key={`${v.setor_id}|${v.tema_id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-fundo px-3 py-2 text-sm"
                  >
                    <span className="text-texto">
                      {nomeDoSetor(v.setor_id)} · {nomeDoTema(v.tema_id)}
                    </span>
                    <span className="flex items-center gap-3 tabular-nums">
                      <span className="text-texto-suave">
                        {v.antes}% → {v.depois}%
                      </span>
                      <span
                        className={`font-bold ${
                          seta(v.delta) === "▲"
                            ? "text-verde"
                            : seta(v.delta) === "▼"
                              ? "text-vermelho"
                              : "text-texto-suave"
                        }`}
                      >
                        {seta(v.delta)} {v.delta > 0 ? "+" : ""}
                        {v.delta}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {naOrdem.map((d) => (
              <div key={d.campanhaId} className="rounded-2xl border border-borda bg-superficie p-4">
                <h3 className="font-display text-base font-bold text-marinho">
                  Ranking de setores · {d.campanha.nome}
                </h3>
                {d.ranking.length === 0 ? (
                  <p className="mt-2 text-sm text-texto-suave">Sem pontuação nesta campanha.</p>
                ) : (
                  <ol className="mt-2 flex flex-col gap-1 text-sm">
                    {d.ranking.slice(0, 5).map((r, i) => (
                      <li
                        key={`${d.campanhaId}-${r.setor_id ?? i}`}
                        className="flex justify-between gap-2"
                      >
                        <span className="text-texto">
                          {i + 1}º {r.setor_id ? nomeDoSetor(r.setor_id) : "Setor removido"}
                        </span>
                        <span className="font-semibold tabular-nums text-texto">{r.pontos}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
