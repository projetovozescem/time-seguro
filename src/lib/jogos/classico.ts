/**
 * Motor do Modo TV Clássico (docs/TIME_06 §4).
 *
 * Portado do Quiz TV do V.O.Z.E.S.: a turma discute, o técnico toca a resposta,
 * a tela revela com a explicação. Um setor por partida (ou "Todos").
 *
 * Reducer puro, sem React e sem rede: é o que permite testar a regra de
 * pontuação e as transições sem subir tela nenhuma. Quem grava é o servidor —
 * `tecnico_salvar_quiz_tv` recalcula os pontos (docs/TIME_06 §5).
 */

export type PerguntaTv = {
  id: string;
  enunciado: string;
  alternativas: string[];
  correta: number;
  explicacao: string | null;
  tema: string | null;
};

export type RespostaTv = {
  pergunta_id: string;
  alternativa: number;
  tempo_ms: number;
  ordem: number;
  acertou: boolean;
};

/** Pontos por acerto no Clássico (docs/TIME_06 §4: acertos × 10). */
export const PONTOS_POR_ACERTO = 10;

export type Fase =
  | "pergunta"
  /** Alternativa tocada, antes de revelar — o 1 s de suspense da TV. */
  | "destacando"
  | "revelado"
  | "fim";

export type Estado = {
  perguntas: PerguntaTv[];
  indice: number;
  fase: Fase;
  /** Alternativa tocada pelo técnico; null enquanto ninguém respondeu. */
  escolhida: number | null;
  respostas: RespostaTv[];
  /** `performance.now()` de quando a pergunta apareceu, para medir o tempo. */
  abertaEm: number;
};

export type Acao =
  | { tipo: "escolher"; alternativa: number; agora: number }
  | { tipo: "revelar" }
  | { tipo: "avancar" };

export function estadoInicial(perguntas: PerguntaTv[], agora = 0): Estado {
  return {
    perguntas,
    indice: 0,
    fase: perguntas.length === 0 ? "fim" : "pergunta",
    escolhida: null,
    respostas: [],
    abertaEm: agora,
  };
}

export function reducer(estado: Estado, acao: Acao): Estado {
  switch (acao.tipo) {
    case "escolher": {
      // Só aceita toque na fase de pergunta: depois de revelar, o toque não muda nada.
      if (estado.fase !== "pergunta") return estado;
      const pergunta = estado.perguntas[estado.indice];
      if (!pergunta) return estado;
      if (acao.alternativa < 0 || acao.alternativa >= pergunta.alternativas.length) return estado;

      return {
        ...estado,
        fase: "destacando",
        escolhida: acao.alternativa,
        respostas: [
          ...estado.respostas,
          {
            pergunta_id: pergunta.id,
            alternativa: acao.alternativa,
            tempo_ms: Math.max(0, Math.round(acao.agora - estado.abertaEm)),
            ordem: estado.indice + 1,
            acertou: acao.alternativa === pergunta.correta,
          },
        ],
      };
    }

    case "revelar":
      if (estado.fase !== "destacando") return estado;
      return { ...estado, fase: "revelado" };

    case "avancar": {
      if (estado.fase !== "revelado") return estado;
      const proximo = estado.indice + 1;
      if (proximo >= estado.perguntas.length) {
        return { ...estado, fase: "fim", escolhida: null };
      }
      return { ...estado, indice: proximo, fase: "pergunta", escolhida: null, abertaEm: 0 };
    }
  }
}

/** Acertos da partida. */
export function acertos(estado: Estado): number {
  return estado.respostas.filter((r) => r.acertou).length;
}

export function erros(estado: Estado): number {
  return estado.respostas.filter((r) => !r.acertou).length;
}

/**
 * Pontos do setor. O servidor recalcula a partir das respostas — este número é
 * só para a TV mostrar na hora.
 */
export function pontos(estado: Estado): number {
  return acertos(estado) * PONTOS_POR_ACERTO;
}

/** Corpo do `p_respostas` de `tecnico_salvar_quiz_tv` (docs/TIME_06 §5). */
export function respostasParaSalvar(
  estado: Estado,
  setorId: string | null,
): {
  setor_id: string | null;
  pergunta_id: string;
  alternativa: number;
  tempo_ms: number;
  ordem: number;
}[] {
  return estado.respostas.map((r) => ({
    setor_id: setorId,
    pergunta_id: r.pergunta_id,
    alternativa: r.alternativa,
    tempo_ms: r.tempo_ms,
    ordem: r.ordem,
  }));
}

/**
 * Sorteia `quantidade` perguntas, priorizando os temas com pior taxa de acerto
 * quando "Focar nas lacunas" está marcado (docs/TIME_06 §3.4).
 *
 * `piorPrimeiro` traz os `tema_id` em ordem crescente de taxa de acerto.
 */
export function sortearPerguntas(
  disponiveis: readonly (PerguntaTv & { tema_id: string })[],
  quantidade: number,
  piorPrimeiro: readonly string[] = [],
): PerguntaTv[] {
  if (quantidade <= 0 || disponiveis.length === 0) return [];

  const prioridade = new Map(piorPrimeiro.map((tema, i) => [tema, i]));
  const semPrioridade = piorPrimeiro.length;

  // Embaralha antes de ordenar, para não devolver sempre as mesmas dentro do
  // mesmo tema.
  const embaralhadas = [...disponiveis].sort(() => Math.random() - 0.5);

  const ordenadas = embaralhadas.sort(
    (a, b) =>
      (prioridade.get(a.tema_id) ?? semPrioridade) - (prioridade.get(b.tema_id) ?? semPrioridade),
  );

  return ordenadas.slice(0, quantidade);
}
