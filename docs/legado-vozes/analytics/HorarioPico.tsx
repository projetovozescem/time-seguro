import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Analytics } from "@/hooks/useAnalytics";
import { Secao } from "./Secao";

export function HorarioPico({ horarioPico }: { horarioPico: Analytics["horarioPico"] }) {
  const { linhas, pico } = horarioPico;
  const vazio = linhas.every((l) => l.total === 0);

  return (
    <Secao
      titulo="Horário de pico"
      descricao={
        pico
          ? `A turma participa mais por volta das ${pico.rotulo} (${pico.total} registros).`
          : "Em que horas do dia os alunos mais participam."
      }
      vazio={vazio}
      mensagemVazio="Nenhum acesso ou resposta registrado ainda."
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={linhas} margin={{ top: 8, right: 16, bottom: 4 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="rotulo"
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            formatter={(v: number) => [v, "Registros"]}
            contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }}
          />
          <Bar dataKey="total" name="Registros" radius={[4, 4, 0, 0]}>
            {/* A faixa de pico ganha o roxo cheio; as demais ficam recuadas. */}
            {linhas.map((l) => (
              <Cell
                key={l.hora}
                fill={pico && l.hora === pico.hora ? "var(--chart-1)" : "var(--secondary)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Secao>
  );
}
