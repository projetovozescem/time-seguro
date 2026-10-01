import type { PerguntaTv, RespostaTv } from "./classico";

/**
 * Motor do Duelo de Setores (docs/TIME_06 §4), portado do "Quiz por Tempo" do
 * Max Games.
 *
 * Todas as equipes veem a pergunta; cada setor tem um buzzer na sua cor. Quem
 * acerta primeiro leva mais. Reducer puro: o tempo entra por parâmetro (`agora`),
 * nunca é lido aqui dentro — é o que torna o timer de 30 s testável.
 *
 * Quem grava é o servidor: `tecnico_salvar_quiz_tv` recalcula os pontos a partir
 * das respostas (docs/TIME_06 §5).
 */

export const SEGUNDOS_POR_PERGUNTA = 30;

/** Pontos pela ordem de acerto. Da 5ª equipe em diante, acertar não pontua. */
export const PONTOS_POR_ORDEM = [10, 5, 2, 2] as const;

/** Erro custa 2, mas o total do setor nunca fica negativo. */
export const PENALIDADE_ERRO = 2;

export type Equipe = {
  setorId: string;
  nome: string;
  cor: string;
};

export type Fase = "pergunta" | "revelado" | "fim";

export type EstadoDuelo = {
  perguntas: PerguntaTv[];
  equipes: Equipe[];
  indice: number;
  fase: Fase;
  /** Pontos acumulados por setor. Nunca negativo. */
  pontos: Record<string, number>;
  acertos: Record<string, number>;
  erros: Record<string, number>;
  /** Setores que já responderam a pergunta atual — cada um responde uma vez. */
  jaResponderam: string[];
  /** Setores que acertaram a atual, na ordem: define quem leva 10, 5 e 2. */
  acertaramNaOrdem: string[];
  respostas: (RespostaTv & { setor_id: string })[];
  /** `Date.now()`/`performance.now()` de quando a pergunta abriu. */
  abertaEm: number;
  /** `true` quando o tempo estourou sem ninguém acertar. */
  tempoEsgotado: boolean;
};

export type AcaoDuelo =
  | { tipo: "responder"; setorId: string; alternativa: number; agora: number }
  | { tipo: "tempoEsgotou" }
  | { tipo: "revelar" }
  | { tipo: "avancar" };

export function estadoInicialDuelo(
  perguntas: PerguntaTv[],
  equipes: Equipe[],
  agora = 0,
): EstadoDuelo {
  const zerado = (): Record<string, number> =>
    Object.fromEntries(equipes.map((e) => [e.setorId, 0]));
  return {
    perguntas,
    equipes,
    indice: 0,
    fase: perguntas.length === 0 || equipes.length === 0 ? "fim" : "pergunta",
    pontos: zerado(),
    acertos: zerado(),
    erros: zerado(),
    jaResponderam: [],
    acertaramNaOrdem: [],
    respostas: [],
    abertaEm: agora,
    tempoEsgotado: false,
  };
}

/** Pontos que a próxima equipe a acertar vai levar. */
export function pontosDaVez(acertaramNaOrdem: readonly string[]): number {
  return PONTOS_POR_ORDEM[acertaramNaOrdem.length] ?? 0;
}

export function reducerDuelo(estado: EstadoDuelo, acao: AcaoDuelo): EstadoDuelo {
  switch (acao.tipo) {
    case "responder": {
      if (estado.fase !== "pergunta") return estado;
      const pergunta = estado.perguntas[estado.indice];
      if (!pergunta) return estado;
      if (!estado.equipes.some((e) => e.setorId === acao.setorId)) return estado;
      // Um buzzer por equipe por pergunta: o segundo toque não vale.
      if (estado.jaResponderam.includes(acao.setorId)) return estado;
      if (acao.alternativa < 0 || acao.alternativa >= pergunta.alternativas.length) return estado;

      const acertou = acao.alternativa === pergunta.correta;
      const ganho = acertou ? pontosDaVez(estado.acertaramNaOrdem) : -PENALIDADE_ERRO;
      const atual = estado.pontos[acao.setorId] ?? 0;

      const jaResponderam = [...estado.jaResponderam, acao.setorId];
      const acertaramNaOrdem = acertou
        ? [...estado.acertaramNaOrdem, acao.setorId]
        : estado.acertaramNaOrdem;

      return {
        ...estado,
        // Todas as equipes já responderam: não há mais o que esperar.
        fase: jaResponderam.length >= estado.equipes.length ? "revelado" : "pergunta",
        pontos: { ...estado.pontos, [acao.setorId]: Math.max(0, atual + ganho) },
        acertos: {
          ...estado.acertos,
          [acao.setorId]: (estado.acertos[acao.setorId] ?? 0) + (acertou ? 1 : 0),
        },
        erros: {
          ...estado.erros,
          [acao.setorId]: (estado.erros[acao.setorId] ?? 0) + (acertou ? 0 : 1),
        },
        jaResponderam,
        acertaramNaOrdem,
        respostas: [
          ...estado.respostas,
          {
            setor_id: acao.setorId,
            pergunta_id: pergunta.id,
            alternativa: acao.alternativa,
            tempo_ms: Math.max(0, Math.round(acao.agora - estado.abertaEm)),
            ordem: estado.indice + 1,
            acertou,
          },
        ],
      };
    }

    case "tempoEsgotou":
      if (estado.fase !== "pergunta") return estado;
      return { ...estado, fase: "revelado", tempoEsgotado: true };

    case "revelar":
      if (estado.fase !== "pergunta") return estado;
      return { ...estado, fase: "revelado" };

    case "avancar": {
      if (estado.fase !== "revelado") return estado;
      const proximo = estado.indice + 1;
      if (proximo >= estado.perguntas.length) return { ...estado, fase: "fim" };
      return {
        ...estado,
        indice: proximo,
        fase: "pergunta",
        jaResponderam: [],
        acertaramNaOrdem: [],
        abertaEm: 0,
        tempoEsgotado: false,
      };
    }
  }
}

/** Segundos que faltam, nunca negativo. `agora` e `abertaEm` em milissegundos. */
export function segundosRestantes(estado: EstadoDuelo, agora: number): number {
  const passados = (agora - estado.abertaEm) / 1000;
  return Math.max(0, Math.ceil(SEGUNDOS_POR_PERGUNTA - passados));
}

/** Placar ordenado, com a posição já resolvida (empate divide o lugar). */
export function placar(estado: EstadoDuelo): {
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

/** Corpo do `p_equipes` de `tecnico_salvar_quiz_tv` (docs/TIME_06 §5). */
export function equipesParaSalvar(estado: EstadoDuelo): { setor_id: string; pontos: number }[] {
  return estado.equipes.map((e) => ({
    setor_id: e.setorId,
    pontos: estado.pontos[e.setorId] ?? 0,
  }));
}

export function respostasDueloParaSalvar(estado: EstadoDuelo): {
  setor_id: string;
  pergunta_id: string;
  alternativa: number;
  tempo_ms: number;
  ordem: number;
}[] {
  return estado.respostas.map((r) => ({
    setor_id: r.setor_id,
    pergunta_id: r.pergunta_id,
    alternativa: r.alternativa,
    tempo_ms: r.tempo_ms,
    ordem: r.ordem,
  }));
}
