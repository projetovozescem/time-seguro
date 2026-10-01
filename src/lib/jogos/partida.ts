import type { PerguntaTv } from "./classico";

/**
 * Partida escolhida em `/tv`, lida por `/tv/jogo`.
 *
 * Fica em memória de propósito (docs/TIME_06 §1: "estado em memória"): a partida
 * é de uma sessão de TV, não precisa sobreviver a recarregamento, e guardar em
 * `localStorage` faria o técnico retomar um jogo velho sem querer. Recarregar a
 * página manda de volta para a seleção.
 */
export type Partida = {
  /** `null` quando é treino: mostra resultado e não salva nada. */
  eventoId: string | null;
  eventoTitulo: string | null;
  /** `null` quando a partida é de "Todos os setores". */
  setorId: string | null;
  setorNome: string;
  perguntas: PerguntaTv[];
  iniciadaEm: number;
};

let atual: Partida | null = null;

export function definirPartida(p: Partida): void {
  atual = p;
}

export function partidaAtual(): Partida | null {
  return atual;
}

export function limparPartida(): void {
  atual = null;
}
