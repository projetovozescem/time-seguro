import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Analytics, LinhaTurma } from "@/hooks/useAnalytics";
import { Secao, percentual } from "./Secao";

/*
 * As três cores foram validadas juntas para daltonismo (separação CVD ΔE 14,5
 * contra o fundo dos cards). O âmbar tem contraste abaixo de 3:1, por isso a
 * legenda e os totais em texto ao lado são obrigatórios — não tirar.
 */
const FONTES = [
  { chave: "qrcode", rotulo: "QR Code", cor: "var(--chart-1)" },
  { chave: "quizTv", rotulo: "Quiz TV", cor: "var(--chart-2)" },
  { chave: "compartilhamento", rotulo: "Compartilhamento", cor: "var(--chart-3)" },
] as const;

export function ComparativoFontes({
  porTurma,
  comparativoFontes,
}: {
  porTurma: LinhaTurma[];
  comparativoFontes: Analytics["comparativoFontes"];
}) {
  const totalGeral = comparativoFontes.reduce((s, f) => s + f.pontos, 0);

  const dados = porTurma
    .filter((l) => l.pontos > 0)
    .map((l) => ({
      turma: l.turma.nome,
      qrcode: l.turma.pontuacao_qrcode ?? 0,
      quizTv: l.turma.pontuacao_quiz_tv ?? 0,
      compartilhamento: l.turma.pontuacao_compartilhamento ?? 0,
    }));

  return (
    <Secao
      titulo="De onde vêm os pontos"
      descricao="Comparativo das três fontes de pontuação, no geral e por turma."
      vazio={totalGeral === 0}
      mensagemVazio="Nenhum ponto foi marcado ainda."
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {comparativoFontes.map((f, i) => (
          <div key={f.fonte} className="rounded-xl border border-border p-4">
            <div className="flex items-center gap-2">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: FONTES[i]!.cor }}
                aria-hidden
              />
              <span className="text-sm font-medium">{f.fonte}</span>
            </div>
            <p className="mt-2 font-display text-2xl font-bold">
              {f.pontos.toLocaleString("pt-BR")}
            </p>
            <p className="text-xs text-muted-foreground">
              {percentual(totalGeral > 0 ? (f.pontos / totalGeral) * 100 : null)} do total
            </p>
          </div>
        ))}
      </div>

      {dados.length > 0 && (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dados} margin={{ top: 8, right: 16, bottom: 4 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="turma"
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
              contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {FONTES.map(({ chave, rotulo, cor }, i) => (
              <Bar
                key={chave}
                dataKey={chave}
                name={rotulo}
                stackId="pontos"
                fill={cor}
                // 2px de folga entre os segmentos empilhados.
                stroke="var(--card)"
                strokeWidth={2}
                {...(i === FONTES.length - 1
                  ? { radius: [4, 4, 0, 0] as [number, number, number, number] }
                  : {})}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </Secao>
  );
}
