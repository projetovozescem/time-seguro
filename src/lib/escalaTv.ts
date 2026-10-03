/**
 * Escala das telas do Modo TV conforme a resolução.
 *
 * As telas foram desenhadas para 1280×720. Toda medida delas é em `rem`
 * (classes do Tailwind), então basta mudar o `font-size` da raiz para a tela
 * inteira crescer ou encolher junto. O lado que aperta (largura ou altura)
 * decide, para nada sair da tela.
 */
export const BASE_TV = { largura: 1280, altura: 720 } as const;
const MINIMA = 0.75;
const MAXIMA = 2.5;

export function calcularEscalaTv(largura: number, altura: number): number {
  if (!(largura > 0) || !(altura > 0)) return 1;
  const escala = Math.min(largura / BASE_TV.largura, altura / BASE_TV.altura);
  return Math.min(MAXIMA, Math.max(MINIMA, Math.round(escala * 100) / 100));
}
