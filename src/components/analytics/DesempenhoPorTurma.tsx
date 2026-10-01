import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Download } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import type { Analytics, LinhaTurma } from "@/hooks/useAnalytics";
import { baixarCSV } from "@/lib/exportar";
import { formatarData } from "@/lib/vozes";
import { cn } from "@/lib/utils";
import { Secao, percentual, segundos } from "./Secao";

type Coluna = keyof Pick<
  LinhaTurma,
  | "tentativas"
  | "acertos"
  | "erros"
  | "taxaAcerto"
  | "tempoMedioMs"
  | "acessos"
  | "compartilhamentos"
>;

const COLUNAS: { chave: Coluna; rotulo: string }[] = [
  { chave: "tentativas", rotulo: "Tentativas" },
  { chave: "acertos", rotulo: "Acertos" },
  { chave: "erros", rotulo: "Erros" },
  { chave: "taxaAcerto", rotulo: "Taxa acerto" },
  { chave: "tempoMedioMs", rotulo: "Tempo médio" },
  { chave: "acessos", rotulo: "Acessos QR" },
  { chave: "compartilhamentos", rotulo: "Compart." },
];

export function DesempenhoPorTurma({
  porTurma,
  evolucaoDiaria,
}: {
  porTurma: LinhaTurma[];
  evolucaoDiaria: Analytics["evolucaoDiaria"];
}) {
  const [coluna, setColuna] = useState<Coluna>("tentativas");
  const [crescente, setCrescente] = useState(false);
  const [expandida, setExpandida] = useState<string | null>(null);

  const ordenadas = useMemo(() => {
    const copia = [...porTurma];
    copia.sort((a, b) => {
      const va = a[coluna] ?? -1;
      const vb = b[coluna] ?? -1;
      return crescente ? va - vb : vb - va;
    });
    return copia;
  }, [porTurma, coluna, crescente]);

  const semDados = porTurma.every((l) => l.tentativas === 0 && l.acessos === 0);

  function exportar() {
    baixarCSV(
      "vozes-desempenho-por-turma",
      porTurma.map((l) => ({
        turma: l.turma.nome,
        serie: l.turma.serie,
        tentativas: l.tentativas,
        acertos: l.acertos,
        erros: l.erros,
        taxa_acerto_pct: l.taxaAcerto?.toFixed(1) ?? "",
        tempo_medio_ms: l.tempoMedioMs?.toFixed(0) ?? "",
        acessos_qrcode: l.acessos,
        compartilhamentos: l.compartilhamentos,
        pontos_total: l.pontos,
      })),
    );
  }

  function alternar(nova: Coluna) {
    if (nova === coluna) setCrescente((c) => !c);
    else {
      setColuna(nova);
      setCrescente(false);
    }
  }

  return (
    <Secao
      titulo="Desempenho por turma"
      descricao="Clique numa turma para ver a evolução diária dela."
      vazio={semDados}
      mensagemVazio="Nenhuma participação registrada ainda."
      acao={
        <Button variant="outline" size="sm" onClick={exportar} disabled={porTurma.length === 0}>
          <Download className="size-4" /> Exportar CSV
        </Button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-200 text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="rounded-l-lg px-3 py-2.5 font-semibold">Turma</th>
              {COLUNAS.map(({ chave, rotulo }) => (
                <th key={chave} className="px-3 py-2.5 text-right font-semibold">
                  <button
                    type="button"
                    onClick={() => alternar(chave)}
                    className={cn(
                      "inline-flex items-center gap-1 transition-colors hover:text-primary",
                      coluna === chave && "text-primary",
                    )}
                  >
                    {rotulo}
                    {coluna === chave &&
                      (crescente ? (
                        <ArrowUp className="size-3.5" />
                      ) : (
                        <ArrowDown className="size-3.5" />
                      ))}
                  </button>
                </th>
              ))}
              <th className="w-8 rounded-r-lg" />
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((l) => {
              const aberta = expandida === l.turma.id;
              const serie = aberta ? evolucaoDiaria(l.turma.id) : [];
              return [
                <tr
                  key={l.turma.id}
                  onClick={() => setExpandida(aberta ? null : l.turma.id)}
                  className="cursor-pointer border-t border-border transition-colors hover:bg-muted/50"
                >
                  <td className="px-3 py-2.5 font-medium">{l.turma.nome}</td>
                  <td className="px-3 py-2.5 text-right">{l.tentativas}</td>
                  <td className="px-3 py-2.5 text-right text-grafico-acerto">{l.acertos}</td>
                  <td className="px-3 py-2.5 text-right text-grafico-erro">{l.erros}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{percentual(l.taxaAcerto)}</td>
                  <td className="px-3 py-2.5 text-right">{segundos(l.tempoMedioMs)}</td>
                  <td className="px-3 py-2.5 text-right">{l.acessos}</td>
                  <td className="px-3 py-2.5 text-right">{l.compartilhamentos}</td>
                  <td className="px-3 py-2.5 text-right">
                    <ChevronDown
                      className={cn("size-4 transition-transform", aberta && "rotate-180")}
                    />
                  </td>
                </tr>,
                aberta && (
                  <tr key={`${l.turma.id}-detalhe`} className="border-t border-border bg-muted/30">
                    <td colSpan={COLUNAS.length + 2} className="p-4">
                      {serie.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                          Sem respostas registradas para a turma {l.turma.nome}.
                        </p>
                      ) : (
                        <>
                          <p className="mb-2 text-xs font-semibold text-muted-foreground">
                            Evolução diária — turma {l.turma.nome}
                          </p>
                          <ResponsiveContainer width="100%" height={180}>
                            <LineChart data={serie} margin={{ top: 8, right: 12, bottom: 4 }}>
                              <CartesianGrid stroke="var(--border)" vertical={false} />
                              <XAxis
                                dataKey="dia"
                                tickFormatter={formatarData}
                                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                                stroke="var(--border)"
                              />
                              <YAxis
                                allowDecimals={false}
                                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                                stroke="var(--border)"
                              />
                              <Tooltip
                                labelFormatter={formatarData}
                                contentStyle={{
                                  borderRadius: 12,
                                  border: "1px solid var(--border)",
                                  fontSize: 12,
                                }}
                              />
                              <Line
                                type="monotone"
                                dataKey="acertos"
                                name="Acertos"
                                stroke="var(--grafico-acerto)"
                                strokeWidth={2}
                                dot={{ r: 3 }}
                              />
                              <Line
                                type="monotone"
                                dataKey="erros"
                                name="Erros"
                                stroke="var(--grafico-erro)"
                                strokeWidth={2}
                                strokeDasharray="5 3"
                                dot={{ r: 3 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </>
                      )}
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
    </Secao>
  );
}
