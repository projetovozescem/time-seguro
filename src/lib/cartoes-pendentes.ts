import type { CartaoDeAcesso } from "./colaboradores";

/**
 * Passagem dos cartões de `/painel/colaboradores` para `/painel/colaboradores/cartoes`.
 *
 * O PIN puro só existe nesta resposta de `tecnico_gerar_pins` — depois dela, o
 * banco guarda apenas o bcrypt. Por isso a entrega é em MEMÓRIA, e não em
 * `sessionStorage` nem na URL: PIN não vai para o disco do computador do
 * técnico, nem para o histórico do navegador. Recarregar a página de impressão
 * perde os cartões de propósito — o técnico gera de novo.
 */
let pendentes: CartaoDeAcesso[] = [];

export function guardarCartoes(cartoes: readonly CartaoDeAcesso[]): void {
  pendentes = [...cartoes];
}

/** Lê sem consumir: o React pode montar o componente duas vezes em dev. */
export function cartoesPendentes(): CartaoDeAcesso[] {
  return pendentes;
}

export function limparCartoes(): void {
  pendentes = [];
}
