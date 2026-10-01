import { CheckCircle2, ClipboardList, Percent, XCircle } from "lucide-react";
import type { Analytics } from "@/hooks/useAnalytics";
import { percentual } from "./Secao";

export function StatsOverview({ totais }: { totais: Analytics["totais"] }) {
  const cards = [
    {
      rotulo: "Total de tentativas",
      valor: totais.tentativas.toLocaleString("pt-BR"),
      Icone: ClipboardList,
      cor: "text-primary",
      nota: "Respostas no celular e na TV",
    },
    {
      rotulo: "Total de acertos",
      valor: totais.acertos.toLocaleString("pt-BR"),
      Icone: CheckCircle2,
      cor: "text-grafico-acerto",
      nota: "Respostas corretas",
    },
    {
      rotulo: "Total de erros",
      valor: totais.erros.toLocaleString("pt-BR"),
      Icone: XCircle,
      cor: "text-grafico-erro",
      nota: "Respostas incorretas",
    },
    {
      rotulo: "Taxa de acerto geral",
      valor: percentual(totais.taxaAcerto, 1),
      Icone: Percent,
      cor: "text-accent",
      nota: "Acertos sobre tentativas",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ rotulo, valor, Icone, cor, nota }) => (
        <div key={rotulo} className="rounded-2xl border border-border bg-card p-5">
          <Icone className={`size-5 ${cor}`} />
          <p className="mt-3 font-display text-3xl font-bold">{valor}</p>
          <p className="text-sm font-medium text-foreground">{rotulo}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{nota}</p>
        </div>
      ))}
    </div>
  );
}
