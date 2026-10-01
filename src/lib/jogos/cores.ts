/**
 * Contraste sobre a cor do setor (docs/TIME_06 §6: "se a cor for escura, borda
 * clara"; docs/TIME_10 §2: texto sobre amarelo sempre escuro, nunca branco).
 *
 * A conta é a luminância relativa do WCAG. Sem isso, um setor cadastrado com
 * amarelo ficaria com texto branco sobre amarelo — ilegível a 5 metros.
 */

/** Luminância relativa de 0 (preto) a 1 (branco). Aceita `#rgb` e `#rrggbb`. */
export function luminancia(hex: string): number {
  const limpo = hex.replace("#", "").trim();
  const completo =
    limpo.length === 3
      ? limpo
          .split("")
          .map((c) => c + c)
          .join("")
      : limpo;
  if (!/^[0-9a-fA-F]{6}$/.test(completo)) return 0;

  const canais = [0, 2, 4].map((i) => {
    const v = parseInt(completo.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * canais[0]! + 0.7152 * canais[1]! + 0.0722 * canais[2]!;
}

/** Limite a partir do qual a cor é "clara" e pede texto escuro. */
export const LIMITE_CLARO = 0.45;

export function corClara(hex: string): boolean {
  return luminancia(hex) >= LIMITE_CLARO;
}

/** Classe de texto para escrever sobre a cor do setor. */
export function corDoTexto(hex: string): string {
  return corClara(hex) ? "text-texto" : "text-white";
}
