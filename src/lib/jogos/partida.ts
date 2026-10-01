import type { PerguntaTv } from "./classico";
import type { Equipe } from "./duelo";

/**
 * Partida escolhida em `/tv`, lida por `/tv/jogo`.
 *
 * Fica em memória de propósito (docs/TIME_06 §1: "estado em memória"): a partida
 * é de uma sessão de TV, não precisa sobreviver a recarregamento, e guardar em
 * `localStorage` faria o técnico retomar um jogo velho sem querer. Recarregar a
 * página manda de volta para a seleção.
 */

export type Modo = "classico" | "duelo" | "eliminacao";

type Base = {
  /** `null` quando é treino: mostra resultado e não salva nada. */
  eventoId: string | null;
  eventoTitulo: string | null;
  iniciadaEm: number;
};

/**
 * União discriminada pelo modo: cada modo precisa de dados diferentes, e o
 * TypeScript garante que a tela do Duelo nunca receba uma partida de Clássico.
 */
export type Partida =
  | (Base & {
      modo: "classico";
      /** `null` quando a partida é de "Todos os setores". */
      setorId: string | null;
      setorNome: string;
      perguntas: PerguntaTv[];
    })
  | (Base & {
      modo: "duelo";
      equipes: Equipe[];
      perguntas: PerguntaTv[];
    })
  | (Base & {
      modo: "eliminacao";
      equipes: Equipe[];
      /** Uma lista de 5 perguntas por equipe, na ordem dos turnos. */
      perguntasPorEquipe: PerguntaTv[][];
    });

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
