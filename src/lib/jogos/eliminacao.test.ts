import { describe, expect, it } from "vitest";
import {
  AJUDAS,
  MAXIMO_DA_RODADA,
  PERGUNTAS_POR_RODADA,
  VALORES,
  alternativasParaApagar,
  equipeDaVez,
  equipesEliminacaoParaSalvar,
  estadoInicialEliminacao,
  perguntaAtual,
  placarEliminacao,
  reducerEliminacao,
  respostasEliminacaoParaSalvar,
  valorAtual,
  type EstadoEliminacao,
} from "./eliminacao";
import type { PerguntaTv } from "./classico";

function pergunta(id: string, correta = 0): PerguntaTv {
  return {
    id,
    enunciado: `Pergunta ${id}`,
    alternativas: ["A", "B", "C", "D"],
    correta,
    explicacao: "Porque sim.",
    tema: "NR-12",
  };
}

const EQUIPES = [
  { setorId: "s1", nome: "Usinagem", cor: "#0b3c5d" },
  { setorId: "s2", nome: "Expedição", cor: "#ffc400" },
];

/** 5 perguntas por equipe, todas com a alternativa 0 correta. */
function rodadas(): PerguntaTv[][] {
  return EQUIPES.map((e) =>
    Array.from({ length: PERGUNTAS_POR_RODADA }, (_, i) => pergunta(`${e.setorId}-q${i}`)),
  );
}

function inicial(): EstadoEliminacao {
  return estadoInicialEliminacao(rodadas(), EQUIPES, 0);
}

const acertar = (e: EstadoEliminacao) =>
  reducerEliminacao(e, { tipo: "responder", alternativa: 0, agora: 1000 });
const errar = (e: EstadoEliminacao) =>
  reducerEliminacao(e, { tipo: "responder", alternativa: 1, agora: 1000 });
const avancar = (e: EstadoEliminacao) => reducerEliminacao(e, { tipo: "avancar" });

describe("valores da rodada", () => {
  it("são 2, 5, 10, 20 e 40, somando 77", () => {
    expect([...VALORES]).toEqual([2, 5, 10, 20, 40]);
    expect(MAXIMO_DA_RODADA).toBe(77);
  });
});

describe("estado inicial", () => {
  it("começa na primeira equipe com as três ajudas", () => {
    const e = inicial();
    expect(equipeDaVez(e)!.setorId).toBe("s1");
    expect(e.ajudasRestantes).toEqual([...AJUDAS]);
    expect(valorAtual(e)).toBe(2);
    expect(perguntaAtual(e)!.id).toBe("s1-q0");
  });

  it("sem equipe ou sem pergunta nasce no fim", () => {
    expect(estadoInicialEliminacao(rodadas(), []).fase).toBe("fim");
    expect(estadoInicialEliminacao([[]], EQUIPES).fase).toBe("fim");
  });
});

describe("acumulado", () => {
  it("cresce com o valor de cada pergunta acertada", () => {
    let e = inicial();
    e = avancar(acertar(e));
    expect(e.acumulado).toBe(2);
    e = avancar(acertar(e));
    expect(e.acumulado).toBe(7);
    e = avancar(acertar(e));
    expect(e.acumulado).toBe(17);
  });

  it("acertar as cinco fecha a rodada no máximo", () => {
    let e = inicial();
    for (let i = 0; i < PERGUNTAS_POR_RODADA; i++) e = avancar(acertar(e));
    expect(e.fase).toBe("fimDoTurno");
    expect(e.acumulado).toBe(MAXIMO_DA_RODADA);
  });

  it("errar zera o acumulado e encerra o turno", () => {
    let e = inicial();
    e = avancar(acertar(e));
    e = avancar(acertar(e));
    expect(e.acumulado).toBe(7);
    e = errar(e);
    expect(e.acumulado).toBe(0);
    expect(e.errou).toBe(true);
    e = avancar(e);
    expect(e.fase).toBe("fimDoTurno");
  });

  it("o acumulado da rodada só vira ponto no fim do turno", () => {
    let e = inicial();
    e = avancar(acertar(e));
    expect(e.pontos["s1"]).toBe(0);
    for (let i = 1; i < PERGUNTAS_POR_RODADA; i++) e = avancar(acertar(e));
    e = avancar(e); // fecha o turno
    expect(e.pontos["s1"]).toBe(MAXIMO_DA_RODADA);
  });

  it("quem erra na primeira fecha o turno com zero", () => {
    let e = avancar(errar(inicial()));
    e = avancar(e);
    expect(e.pontos["s1"]).toBe(0);
    expect(equipeDaVez(e)!.setorId).toBe("s2");
  });
});

describe("rotação de turno", () => {
  it("passa para a próxima equipe com as ajudas renovadas", () => {
    let e = reducerEliminacao(inicial(), { tipo: "usarAjuda", ajuda: "pular" });
    expect(e.ajudasRestantes).not.toContain("pular");
    e = avancar(errar(e));
    e = avancar(e);
    expect(equipeDaVez(e)!.setorId).toBe("s2");
    expect(e.ajudasRestantes).toEqual([...AJUDAS]);
    expect(e.indice).toBe(0);
    expect(e.acumulado).toBe(0);
    expect(perguntaAtual(e)!.id).toBe("s2-q0");
  });

  it("depois da última equipe, a partida termina", () => {
    let e = inicial();
    for (const _ of EQUIPES) {
      e = avancar(errar(e));
      e = avancar(e);
    }
    expect(e.fase).toBe("fim");
  });
});

describe("ajudas", () => {
  it("50/50 apaga duas alternativas erradas, nunca a certa", () => {
    const e = reducerEliminacao(inicial(), { tipo: "usarAjuda", ajuda: "meio" });
    expect(e.apagadas).toHaveLength(2);
    expect(e.apagadas).not.toContain(perguntaAtual(e)!.correta);
  });

  it("alternativa apagada não aceita resposta", () => {
    let e = reducerEliminacao(inicial(), { tipo: "usarAjuda", ajuda: "meio", sorteio: [1, 2] });
    expect(e.apagadas).toEqual([1, 2]);
    e = reducerEliminacao(e, { tipo: "responder", alternativa: 1, agora: 1000 });
    expect(e.respostas).toHaveLength(0);
    expect(e.fase).toBe("pergunta");
  });

  it("cada ajuda vale uma vez por turno", () => {
    let e = reducerEliminacao(inicial(), { tipo: "usarAjuda", ajuda: "consultar" });
    expect(e.consultando).toBe(true);
    e = reducerEliminacao(e, { tipo: "fimDaConsulta" });
    e = reducerEliminacao(e, { tipo: "usarAjuda", ajuda: "consultar" });
    expect(e.consultando).toBe(false);
  });

  it("pular mantém o acumulado e não conta acerto nem erro", () => {
    let e = avancar(acertar(inicial()));
    expect(e.acumulado).toBe(2);
    e = reducerEliminacao(e, { tipo: "usarAjuda", ajuda: "pular" });
    expect(e.acumulado).toBe(2);
    expect(e.indice).toBe(2);
    expect(e.acertos["s1"]).toBe(1);
    expect(e.erros["s1"]).toBe(0);
    expect(e.respostas).toHaveLength(1);
  });

  it("pular na última pergunta encerra o turno com o que já tinha", () => {
    let e = inicial();
    for (let i = 0; i < PERGUNTAS_POR_RODADA - 1; i++) e = avancar(acertar(e));
    expect(e.indice).toBe(PERGUNTAS_POR_RODADA - 1);
    e = reducerEliminacao(e, { tipo: "usarAjuda", ajuda: "pular" });
    expect(e.fase).toBe("fimDoTurno");
    expect(e.acumulado).toBe(MAXIMO_DA_RODADA - 40);
  });

  it("ajuda não vale depois de revelar", () => {
    const e = reducerEliminacao(acertar(inicial()), { tipo: "usarAjuda", ajuda: "meio" });
    expect(e.apagadas).toEqual([]);
    expect(e.ajudasRestantes).toEqual([...AJUDAS]);
  });

  it("o 50/50 é limpo na pergunta seguinte", () => {
    let e = reducerEliminacao(inicial(), { tipo: "usarAjuda", ajuda: "meio" });
    e = avancar(acertar(e));
    expect(e.apagadas).toEqual([]);
  });
});

describe("alternativasParaApagar", () => {
  it("em pergunta de duas alternativas, apaga só a errada", () => {
    const p: PerguntaTv = { ...pergunta("x", 0), alternativas: ["A", "B"] };
    expect(alternativasParaApagar(p)).toEqual([1]);
  });
});

describe("placar e salvamento", () => {
  it("ordena do maior para o menor", () => {
    let e = inicial();
    e = avancar(errar(e)); // s1 fecha com 0
    e = avancar(e);
    for (let i = 0; i < PERGUNTAS_POR_RODADA; i++) e = avancar(acertar(e)); // s2 fecha cheio
    e = avancar(e);
    const p = placarEliminacao(e);
    expect(p[0]!.equipe.setorId).toBe("s2");
    expect(p[0]!.pontos).toBe(MAXIMO_DA_RODADA);
    expect(p[1]!.pontos).toBe(0);
  });

  it("manda uma linha por equipe", () => {
    expect(equipesEliminacaoParaSalvar(inicial())).toEqual([
      { setor_id: "s1", pontos: 0 },
      { setor_id: "s2", pontos: 0 },
    ]);
  });

  it("a ordem das respostas é global, não por rodada", () => {
    let e = inicial();
    e = avancar(errar(e));
    e = avancar(e);
    e = acertar(e);
    const linhas = respostasEliminacaoParaSalvar(e);
    expect(linhas.map((l) => l.ordem)).toEqual([1, 2]);
    expect(linhas.map((l) => l.setor_id)).toEqual(["s1", "s2"]);
  });
});
