import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Analytics } from "@/hooks/useAnalytics";
import { formatarData, type Turma } from "@/lib/vozes";
import { Secao } from "./Secao";

const TODAS = "__todas__";

export function EvolucaoTemporal({
  turmas,
  evolucaoDiaria,
}: {
  turmas: Turma[];
  evolucaoDiaria: Analytics["evolucaoDiaria"];
}) {
  const [turmaId, setTurmaId] = useState(TODAS);
  const [modo, setModo] = useState<"quantidade" | "taxa">("quantidade");

  const serie = evolucaoDiaria(turmaId === TODAS ? null : turmaId);

  return (
    <Secao
      titulo="Evolução no tempo"
      descricao="Como a participação e o aproveitamento mudaram dia a dia."
      vazio={serie.length === 0}
      mensagemVazio="Sem respostas registradas no período."
      acao={
        <div className="flex flex-wrap items-center gap-2">
          <Select value={turmaId} onValueChange={setTurmaId}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todas as turmas</SelectItem>
              {turmas.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  Turma {t.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tabs value={modo} onValueChange={(v) => setModo(v as typeof modo)}>
            <TabsList className="h-9">
              <TabsTrigger value="quantidade">Quantidade</TabsTrigger>
              <TabsTrigger value="taxa">Taxa de acerto</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={serie} margin={{ top: 8, right: 16, bottom: 4 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="dia"
            tickFormatter={formatarData}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
          />
          <YAxis
            allowDecimals={false}
            {...(modo === "taxa" ? { domain: [0, 100] as [number, number] } : {})}
            tickFormatter={(v: number) => (modo === "taxa" ? `${v}%` : String(v))}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
          />
          <Tooltip
            labelFormatter={formatarData}
            formatter={(valor: number, nome: string) => [
              modo === "taxa" ? `${Number(valor).toFixed(1)}%` : valor,
              nome,
            ]}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />

          {modo === "quantidade" ? (
            <>
              <Line
                type="monotone"
                dataKey="acertos"
                name="Acertos"
                stroke="var(--grafico-acerto)"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              {/* Traço pontilhado separa acertos de erros mesmo sem distinguir a cor. */}
              <Line
                type="monotone"
                dataKey="erros"
                name="Erros"
                stroke="var(--grafico-erro)"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={{ r: 4 }}
              />
            </>
          ) : (
            <Line
              type="monotone"
              dataKey="taxaAcerto"
              name="Taxa de acerto"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </Secao>
  );
}
