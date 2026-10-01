import type { PerguntaTv, RespostaTv } from "./classico";
import type { Equipe } from "./duelo";

/**
 * Motor da Eliminação (docs/TIME_06 §4), portado do "Quiz Eliminação" do Max Games.
 *
 * Uma equipe por vez, 5 perguntas de valor crescente. Errar zera o acumulado da
 * rodada e encerra o turno daquela equipe — é o que a palavra "eliminação" quer
 * dizer. Cada equipe tem uma ajuda de cada tipo por turno.
 *
 * Reducer puro. O relógio da ajuda "Consultar equipe" é da tela; aqui só fica
 * registrado que a ajuda foi gasta.
 */

/** Valor de cada pergunta da rodada (docs/TIME_06 §4): acumulado máximo 77. */
export const VALORES = [2, 5, 10, 20, 40] as const;
export const PERGUNTAS_POR_RODADA = VALORES.length;
export const MAXIMO_DA_RODADA = VALORES.reduce((s, v) => s + v, 0);

/** Segundos da ajuda "Consultar equipe". */
export const SEGUNDOS_DE_CONSULTA = 15;

export type Ajuda = "meio" | "pular" | "consultar";
export const AJUDAS: readonly Ajuda[] = ["meio", "pular", "consultar"] as const;

export const ROTULO_DA_AJUDA: Record<Ajuda, { emoji: string; rotulo: string; ajuda: string }> = {
  meio: { emoji: "🃏", rotulo: "50/50", ajuda: "Apaga duas alternativas erradas." },
  pular: { emoji: "⏩", rotulo: "Pular", ajuda: "Passa a pergunta sem perder o acumulado." },
  consultar: {
    emoji: "👥",
    rotulo: "Consultar equipe",
    ajuda: `${SEGUNDOS_DE_CONSULTA} segundos para a equipe conversar.`,
  },
};

export type Fase =
  | "pergunta"
  /** Entre a resposta e a próxima: mostra verde/vermelho e a explicação. */
  | "revelado"
  /** Fim do turno de uma equipe (errou ou acabaram as 5). */
  | "fimDoTurno"
  | "fim";

export type EstadoEliminacao = {
  /** Uma lista de 5 perguntas por equipe, na ordem dos turnos. */
  perguntasPorEquipe: PerguntaTv[][];
  equipes: Equipe[];
  /** Índice da equipe da vez em `equipes`. */
  turno: number;
  /** Pergunta da rodada atual, de 0 a 4. */
  indice: number;
  fase: Fase;
  /** Acumulado da rodada em curso — zera quando erra. */
  acumulado: number;
  /** Total fechado por setor, somando as rodadas já encerradas. */
  pontos: Record<string, number>;
  acertos: Record<string, number>;
  erros: Record<string, number>;
  /** Ajudas ainda disponíveis para a equipe da vez. */
  ajudasRestantes: Ajuda[];
  /** Alternativas apagadas pelo 50/50 na pergunta atual. */
  apagadas: number[];
  /** `true` enquanto os 15 s de consulta correm. */
  consultando: boolean;
  escolhida: number | null;
  errou: boolean;
  respostas: (RespostaTv & { setor_id: string })[];
  abertaEm: number;
};

export type AcaoEliminacao =
  | { tipo: "responder"; alternativa: number; agora: number }
  | { tipo: "usarAjuda"; ajuda: Ajuda; sorteio?: readonly number[] }
  | { tipo: "fimDaConsulta" }
  | { tipo: "avancar" };

function zerado(equipes: readonly Equipe[]): Record<string, number> {
  return Object.fromEntries(equipes.map((e) => [e.setorId, 0]));
}

export function estadoInicialEliminacao(
  perguntasPorEquipe: PerguntaTv[][],
  equipes: Equipe[],
  agora = 0,
): EstadoEliminacao {
  const semJogo = equipes.length === 0 || (perguntasPorEquipe[0] ?? []).length === 0;
  return {
    perguntasPorEquipe,
    equipes,
    turno: 0,
    indice: 0,
    fase: semJogo ? "fim" : "pergunta",
    acumulado: 0,
    pontos: zerado(equipes),
    acertos: zerado(equipes),
    erros: zerado(equipes),
    ajudasRestantes: [...AJUDAS],
    apagadas: [],
    consultando: false,
    escolhida: null,
    errou: false,
    respostas: [],
    abertaEm: agora,
  };
}

/** Pergunta da vez, ou `null` no fim. */
export function perguntaAtual(estado: EstadoEliminacao): PerguntaTv | null {
  return estado.perguntasPorEquipe[estado.turno]?.[estado.indice] ?? null;
}

/** Quanto vale a pergunta da vez. */
export function valorAtual(estado: EstadoEliminacao): number {
  return VALORES[estado.indice] ?? 0;
}

export function equipeDaVez(estado: EstadoEliminacao): Equipe | null {
  return estado.equipes[estado.turno] ?? null;
}

/**
 * Duas alternativas erradas para o 50/50 apagar.
 *
 * `sorteio` entra por parâmetro para o teste ser determinístico; sem ele, a
 * escolha é aleatória.
 */
export function alternativasParaApagar(
  pergunta: PerguntaTv,
  sorteio?: readonly number[],
): number[] {
  const erradas = pergunta.alternativas.map((_, i) => i).filter((i) => i !== pergunta.correta);
  const ordem = sorteio ? erradas.filter((i) => sorteio.includes(i)) : erradas;
  const embaralhada = sorteio ? ordem : [...erradas].sort(() => Math.random() - 0.5);
  return embaralhada.slice(0, 2);
}

export function reducerEliminacao(
  estado: EstadoEliminacao,
  acao: AcaoEliminacao,
): EstadoEliminacao {
  switch (acao.tipo) {
    case "responder": {
      if (estado.fase !== "pergunta") return estado;
      const pergunta = perguntaAtual(estado);
      const equipe = equipeDaVez(estado);
      if (!pergunta || !equipe) return estado;
      if (acao.alternativa < 0 || acao.alternativa >= pergunta.alternativas.length) return estado;
      // Alternativa apagada pelo 50/50 não é clicável na tela; aqui também não.
      if (estado.apagadas.includes(acao.alternativa)) return estado;

      const acertou = acao.alternativa === pergunta.correta;
      const resposta = {
        setor_id: equipe.setorId,
        pergunta_id: pergunta.id,
        alternativa: acao.alternativa,
        tempo_ms: Math.max(0, Math.round(acao.agora - estado.abertaEm)),
        ordem: estado.indice + 1,
        acertou,
      };

      return {
        ...estado,
        fase: "revelado",
        escolhida: acao.alternativa,
        errou: !acertou,
        // Errar zera o acumulado da rodada (docs/TIME_06 §4).
        acumulado: acertou ? estado.acumulado + valorAtual(estado) : 0,
        acertos: {
          ...estado.acertos,
          [equipe.setorId]: (estado.acertos[equipe.setorId] ?? 0) + (acertou ? 1 : 0),
        },
        erros: {
          ...estado.erros,
          [equipe.setorId]: (estado.erros[equipe.setorId] ?? 0) + (acertou ? 0 : 1),
        },
        respostas: [...estado.respostas, resposta],
        consultando: false,
      };
    }

    case "usarAjuda": {
      if (estado.fase !== "pergunta") return estado;
      if (!estado.ajudasRestantes.includes(acao.ajuda)) return estado;
      const pergunta = perguntaAtual(estado);
      if (!pergunta) return estado;

      const restantes = estado.ajudasRestantes.filter((a) => a !== acao.ajuda);

      if (acao.ajuda === "meio") {
        return {
          ...estado,
          ajudasRestantes: restantes,
          apagadas: alternativasParaApagar(pergunta, acao.sorteio),
        };
      }

      if (acao.ajuda === "consultar") {
        return { ...estado, ajudasRestantes: restantes, consultando: true };
      }

      // Pular: passa a pergunta mantendo o acumulado e sem contar acerto nem
      // erro. Na última, encerra o turno com o que a equipe já tinha.
      const proximo = estado.indice + 1;
      if (proximo >= PERGUNTAS_POR_RODADA) {
        return { ...estado, ajudasRestantes: restantes, fase: "fimDoTurno", apagadas: [] };
      }
      return {
        ...estado,
        ajudasRestantes: restantes,
        indice: proximo,
        apagadas: [],
        escolhida: null,
        consultando: false,
        abertaEm: 0,
      };
    }

    case "fimDaConsulta":
      return estado.consultando ? { ...estado, consultando: false } : estado;

    case "avancar": {
      if (estado.fase === "revelado") {
        // Errou: o turno acaba na hora, com acumulado zerado.
        if (estado.errou) return { ...estado, fase: "fimDoTurno", apagadas: [] };

        const proximo = estado.indice + 1;
        if (proximo >= PERGUNTAS_POR_RODADA) {
          return { ...estado, fase: "fimDoTurno", apagadas: [] };
        }
        return {
          ...estado,
          indice: proximo,
          fase: "pergunta",
          escolhida: null,
          apagadas: [],
          errou: false,
          abertaEm: 0,
        };
      }

      if (estado.fase === "fimDoTurno") {
        const equipe = equipeDaVez(estado);
        const pontos = equipe
          ? {
              ...estado.pontos,
              [equipe.setorId]: (estado.pontos[equipe.setorId] ?? 0) + estado.acumulado,
            }
          : estado.pontos;

        const proximoTurno = estado.turno + 1;
        if (proximoTurno >= estado.equipes.length) {
          return { ...estado, pontos, acumulado: 0, fase: "fim" };
        }
        return {
          ...estado,
          pontos,
          turno: proximoTurno,
          indice: 0,
          fase: "pergunta",
          acumulado: 0,
          ajudasRestantes: [...AJUDAS],
          apagadas: [],
          escolhida: null,
          errou: false,
          consultando: false,
          abertaEm: 0,
        };
      }

      return estado;
    }
  }
}

/** Placar final por setor, do maior para o menor. */
export function placarEliminacao(estado: EstadoEliminacao): {
  equipe: Equipe;
  pontos: number;
  acertos: number;
  erros: number;
  posicao: number;
}[] {
  const linhas = estado.equipes
    .map((equipe) => ({
      equipe,
      pontos: estado.pontos[equipe.setorId] ?? 0,
      acertos: estado.acertos[equipe.setorId] ?? 0,
      erros: estado.erros[equipe.setorId] ?? 0,
    }))
    .sort(
      (a, b) =>
        b.pontos - a.pontos ||
        b.acertos - a.acertos ||
        a.equipe.nome.localeCompare(b.equipe.nome, "pt-BR"),
    );

  let posicao = 0;
  let anterior: number | null = null;
  return linhas.map((l, i) => {
    if (anterior === null || l.pontos !== anterior) posicao = i + 1;
    anterior = l.pontos;
    return { ...l, posicao };
  });
}

export function equipesEliminacaoParaSalvar(
  estado: EstadoEliminacao,
): { setor_id: string; pontos: number }[] {
  return estado.equipes.map((e) => ({
    setor_id: e.setorId,
    pontos: estado.pontos[e.setorId] ?? 0,
  }));
}

export function respostasEliminacaoParaSalvar(estado: EstadoEliminacao): {
  setor_id: string;
  pergunta_id: string;
  alternativa: number;
  tempo_ms: number;
  ordem: number;
}[] {
  return estado.respostas.map((r, i) => ({
    setor_id: r.setor_id,
    pergunta_id: r.pergunta_id,
    alternativa: r.alternativa,
    tempo_ms: r.tempo_ms,
    // `ordem` global da partida: a mesma pergunta pode cair em dois turnos, e o
    // banco não tem chave única aqui — a ordem é o que reconstrói a sequência.
    ordem: i + 1,
  }));
}
