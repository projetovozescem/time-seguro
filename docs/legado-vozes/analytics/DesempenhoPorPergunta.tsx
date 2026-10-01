import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LinhaPergunta } from "@/hooks/useAnalytics";
import { baixarCSV } from "@/lib/exportar";
import { alternativaTexto } from "@/lib/vozes";
import { cn } from "@/lib/utils";
import { Secao, percentual } from "./Secao";

/** Verde acima de 70%, amarelo entre 40 e 70, vermelho abaixo de 40. */
function badge(taxa: number | null) {
  if (taxa === null) return { classe: "bg-muted text-muted-foreground", rotulo: "—" };
  if (taxa > 70)
    return { classe: "bg-grafico-acerto/15 text-grafico-acerto", rotulo: percentual(taxa) };
  if (taxa >= 40) return { classe: "bg-dourado/20 text-[#8a6d0b]", rotulo: percentual(taxa) };
  return { classe: "bg-grafico-erro/15 text-grafico-erro", rotulo: percentual(taxa) };
}

export function DesempenhoPorPergunta({ porPergunta }: { porPergunta: LinhaPergunta[] }) {
  // Crescente por padrão: as perguntas mais difíceis aparecem primeiro.
  const [crescente, setCrescente] = useState(true);

  const ordenadas = useMemo(() => {
    const comDados = porPergunta.filter((p) => p.exibida > 0);
    const semDados = porPergunta.filter((p) => p.exibida === 0);
    comDados.sort((a, b) => {
      const d = (a.taxaAcerto ?? 0) - (b.taxaAcerto ?? 0);
      return crescente ? d : -d;
    });
    return [...comDados, ...semDados];
  }, [porPergunta, crescente]);

  const semDados = porPergunta.every((p) => p.exibida === 0);

  function exportar() {
    baixarCSV(
      "vozes-desempenho-por-pergunta",
      porPergunta.map((p) => ({
        enunciado: p.pergunta.enunciado,
        vezes_exibida: p.exibida,
        acertos: p.acertos,
        erros: p.erros,
        taxa_acerto_pct: p.taxaAcerto?.toFixed(1) ?? "",
        alternativa_errada_mais_escolhida: p.erradaMaisEscolhida
          ? `${p.erradaMaisEscolhida.letra} (${p.erradaMaisEscolhida.vezes}x)`
          : "",
        resposta_correta: p.pergunta.resposta_correta,
      })),
    );
  }

  return (
    <Secao
      titulo="Desempenho por pergunta"
      descricao="As mais difíceis primeiro — mostram onde a turma precisa de reforço."
      vazio={semDados}
      mensagemVazio="Nenhuma pergunta foi respondida ainda."
      acao={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCrescente((c) => !c)}>
            {crescente ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
            Taxa de acerto
          </Button>
          <Button variant="outline" size="sm" onClick={exportar}>
            <Download className="size-4" /> CSV
          </Button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-200 text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="rounded-l-lg px-3 py-2.5 font-semibold">Pergunta</th>
              <th className="px-3 py-2.5 text-right font-semibold">Exibida</th>
              <th className="px-3 py-2.5 text-right font-semibold">Acertos</th>
              <th className="px-3 py-2.5 text-right font-semibold">Erros</th>
              <th className="px-3 py-2.5 text-right font-semibold">Taxa</th>
              <th className="rounded-r-lg px-3 py-2.5 font-semibold">Errada mais escolhida</th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((p) => {
              const b = badge(p.taxaAcerto);
              const errada = p.erradaMaisEscolhida;
              return (
                <tr key={p.pergunta.id} className="border-t border-border align-top">
                  <td className="max-w-md px-3 py-2.5">
                    <p className="line-clamp-2">{p.pergunta.enunciado}</p>
                  </td>
                  <td className="px-3 py-2.5 text-right">{p.exibida}</td>
                  <td className="px-3 py-2.5 text-right text-grafico-acerto">{p.acertos}</td>
                  <td className="px-3 py-2.5 text-right text-grafico-erro">{p.erros}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-xs font-bold",
                        b.classe,
                      )}
                    >
                      {b.rotulo}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {errada ? (
                      <span className="text-xs">
                        <span className="font-bold text-grafico-erro">{errada.letra}</span> (
                        {errada.vezes}×) —{" "}
                        <span className="text-muted-foreground">
                          {alternativaTexto(p.pergunta, errada.letra)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Secao>
  );
}
