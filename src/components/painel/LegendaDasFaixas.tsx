import { FAIXAS, type Faixa } from "@/lib/lacunas";

/** Ordem de leitura: do melhor desempenho ao pior, e por último "sem dado". */
const ORDEM: readonly Faixa[] = ["domina", "atencao", "lacuna", "insuficiente"];

/**
 * Legenda do mapa de lacunas (docs/TIME_09 §1.2).
 *
 * Um cartão por faixa: a cor grande com o intervalo, o que ela significa e
 * QUANTAS células do mapa caem nela. A contagem transforma a legenda numa
 * leitura rápida do quadro ("quantas lacunas eu tenho?") em vez de só decifrar
 * a cor. As cores vêm de `FAIXAS`, que já garante contraste e não depende só da
 * cor (docs/TIME_10 §2): cada cartão traz o intervalo escrito.
 */
export function LegendaDasFaixas({ contagem }: { contagem: Record<Faixa, number> }) {
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Legenda do mapa de lacunas">
      {ORDEM.map((f) => {
        const faixa = FAIXAS[f];
        const n = contagem[f];
        return (
          <li key={f} className="overflow-hidden rounded-2xl border border-borda bg-superficie">
            <div
              className={`px-3 py-2.5 font-display text-base font-extrabold tabular-nums sm:text-lg ${faixa.cor}`}
            >
              {faixa.rotulo}
            </div>
            <div className="p-3">
              <p className="text-sm font-semibold leading-snug text-texto">{faixa.leitura}</p>
              <p className="mt-1 text-xs tabular-nums text-texto-suave">
                {n} {n === 1 ? "célula" : "células"}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
