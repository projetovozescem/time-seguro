import { describe, expect, it } from "vitest";
import {
  PENALIDADE_ERRO,
  PONTOS_POR_ORDEM,
  SEGUNDOS_POR_PERGUNTA,
  equipesParaSalvar,
  estadoInicialDuelo,
  placar,
  pontosDaVez,
  reducerDuelo,
  respostasDueloParaSalvar,
  segundosRestantes,
  type EstadoDuelo,
} from "./duelo";
import type { PerguntaTv } from "./classico";

const PERGUNTAS: PerguntaTv[] = [
  {
    id: "p1",
    enunciado: "Quando travar a máquina?",
    alternativas: ["Nunca", "Antes de limpar", "Depois", "Tanto faz"],
    correta: 1,
    explicacao: "Bloqueio e etiquetagem antes de qualquer manutenção.",
    tema: "NR-12",
  },
  {
    id: "p2",
    enunciado: "Para que serve o óculos de proteção?",
    alternativas: ["Enxergar melhor", "Proteger os olhos"],
    correta: 1,
    explicacao: null,
    tema: "EPI",
  },
];

const EQUIPES = [
  { setorId: "s1", nome: "Usinagem", cor: "#0b3c5d" },
  { setorId: "s2", nome: "Expedição", cor: "#ffc400" },
  { setorId: "s3", nome: "Manutenção", cor: "#2e7d32" },
];

function inicial(): EstadoDuelo {
  return estadoInicialDuelo(PERGUNTAS, EQUIPES, 0);
}

function responder(e: EstadoDuelo, setorId: string, alternativa: number, agora = 1000) {
  return reducerDuelo(e, { tipo: "responder", setorId, alternativa, agora });
}

describe("estadoInicialDuelo", () => {
  it("começa na primeira pergunta com todos zerados", () => {
    const e = inicial();
    expect(e.fase).toBe("pergunta");
    expect(e.indice).toBe(0);
    expect(e.pontos).toEqual({ s1: 0, s2: 0, s3: 0 });
  });

  it("sem pergunta ou sem equipe já nasce no fim", () => {
    expect(estadoInicialDuelo([], EQUIPES).fase).toBe("fim");
    expect(estadoInicialDuelo(PERGUNTAS, []).fase).toBe("fim");
  });
});

describe("pontuação pela ordem de acerto", () => {
  it("1º acerto leva 10, 2º leva 5, 3º leva 2", () => {
    expect(PONTOS_POR_ORDEM[0]).toBe(10);
    let e = inicial();
    e = responder(e, "s1", 1);
    e = responder(e, "s2", 1);
    e = responder(e, "s3", 1);
    expect(e.pontos).toEqual({ s1: 10, s2: 5, s3: 2 });
  });

  it("a partir da 5ª equipe a acertar, acertar não pontua", () => {
    expect(pontosDaVez(["a", "b", "c", "d"])).toBe(0);
  });

  it("errar custa 2", () => {
    let e = inicial();
    e = responder(e, "s1", 1);
    e = responder(e, "s2", 0);
    expect(e.pontos["s2"]).toBe(0);
    expect(e.erros["s2"]).toBe(1);
    expect(PENALIDADE_ERRO).toBe(2);
  });

  it("o total do setor nunca fica negativo", () => {
    let e = inicial();
    e = responder(e, "s1", 0); // erro na primeira
    expect(e.pontos["s1"]).toBe(0);
    e = reducerDuelo(e, { tipo: "revelar" });
    e = reducerDuelo(e, { tipo: "avancar" });
    e = responder(e, "s1", 0); // erro na segunda
    expect(e.pontos["s1"]).toBe(0);
  });

  it("quem errou e depois acerta não recupera o ponto perdido duas vezes", () => {
    let e = inicial();
    e = responder(e, "s1", 1); // +10
    e = reducerDuelo(e, { tipo: "revelar" });
    e = reducerDuelo(e, { tipo: "avancar" });
    e = responder(e, "s1", 0); // -2
    expect(e.pontos["s1"]).toBe(8);
  });
});

describe("um buzzer por equipe por pergunta", () => {
  it("o segundo toque da mesma equipe é ignorado", () => {
    let e = inicial();
    e = responder(e, "s1", 0);
    const pontosDepoisDoErro = e.pontos["s1"];
    e = responder(e, "s1", 1);
    expect(e.pontos["s1"]).toBe(pontosDepoisDoErro);
    expect(e.respostas).toHaveLength(1);
  });

  it("setor que não está no jogo não responde", () => {
    const e = responder(inicial(), "intruso", 1);
    expect(e.respostas).toHaveLength(0);
  });

  it("alternativa fora da faixa é ignorada", () => {
    expect(responder(inicial(), "s1", 9).respostas).toHaveLength(0);
    expect(responder(inicial(), "s1", -1).respostas).toHaveLength(0);
  });
});

describe("fim da pergunta", () => {
  it("quando todas responderam, revela sozinho", () => {
    let e = inicial();
    e = responder(e, "s1", 1);
    expect(e.fase).toBe("pergunta");
    e = responder(e, "s2", 0);
    expect(e.fase).toBe("pergunta");
    e = responder(e, "s3", 0);
    expect(e.fase).toBe("revelado");
  });

  it("tempo esgotado revela sem pontuar ninguém", () => {
    const e = reducerDuelo(inicial(), { tipo: "tempoEsgotou" });
    expect(e.fase).toBe("revelado");
    expect(e.tempoEsgotado).toBe(true);
    expect(e.pontos).toEqual({ s1: 0, s2: 0, s3: 0 });
  });

  it("depois de revelar, buzzer não vale mais", () => {
    let e = reducerDuelo(inicial(), { tipo: "revelar" });
    e = responder(e, "s1", 1);
    expect(e.respostas).toHaveLength(0);
  });

  it("avançar limpa quem respondeu e o tempo esgotado", () => {
    let e = responder(inicial(), "s1", 1);
    e = reducerDuelo(e, { tipo: "tempoEsgotou" });
    e = reducerDuelo(e, { tipo: "avancar" });
    expect(e.indice).toBe(1);
    expect(e.jaResponderam).toEqual([]);
    expect(e.acertaramNaOrdem).toEqual([]);
    expect(e.tempoEsgotado).toBe(false);
    expect(e.fase).toBe("pergunta");
  });

  it("avançar na última pergunta termina a partida", () => {
    let e = inicial();
    for (const _ of PERGUNTAS) {
      e = reducerDuelo(e, { tipo: "revelar" });
      e = reducerDuelo(e, { tipo: "avancar" });
    }
    expect(e.fase).toBe("fim");
  });

  it("avançar sem revelar não faz nada", () => {
    const e = reducerDuelo(inicial(), { tipo: "avancar" });
    expect(e.indice).toBe(0);
    expect(e.fase).toBe("pergunta");
  });
});

describe("segundosRestantes", () => {
  it("começa nos 30 segundos", () => {
    expect(segundosRestantes(inicial(), 0)).toBe(SEGUNDOS_POR_PERGUNTA);
  });

  it("desce com o tempo e nunca passa de zero", () => {
    expect(segundosRestantes(inicial(), 10_000)).toBe(20);
    expect(segundosRestantes(inicial(), 60_000)).toBe(0);
  });
});

describe("placar", () => {
  it("ordena por pontos e resolve o empate pelo nome", () => {
    let e = inicial();
    e = responder(e, "s3", 1); // +10 Manutenção
    e = responder(e, "s1", 1); // +5 Usinagem
    const p = placar(e);
    expect(p.map((l) => l.equipe.setorId)).toEqual(["s3", "s1", "s2"]);
    expect(p[0]!.posicao).toBe(1);
  });

  it("empate divide o lugar", () => {
    const p = placar(inicial());
    expect(p.map((l) => l.posicao)).toEqual([1, 1, 1]);
  });
});

describe("corpo do salvamento", () => {
  it("manda uma linha por equipe, inclusive quem não pontuou", () => {
    const e = responder(inicial(), "s1", 1);
    expect(equipesParaSalvar(e)).toEqual([
      { setor_id: "s1", pontos: 10 },
      { setor_id: "s2", pontos: 0 },
      { setor_id: "s3", pontos: 0 },
    ]);
  });

  it("cada resposta leva o setor que apertou o buzzer", () => {
    let e = responder(inicial(), "s1", 1, 4000);
    e = responder(e, "s2", 0, 9000);
    const linhas = respostasDueloParaSalvar(e);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toEqual({
      setor_id: "s1",
      pergunta_id: "p1",
      alternativa: 1,
      tempo_ms: 4000,
      ordem: 1,
    });
    expect(linhas[1]!.setor_id).toBe("s2");
  });

  it("o tempo nunca vai negativo", () => {
    const e = responder(estadoInicialDuelo(PERGUNTAS, EQUIPES, 5000), "s1", 1, 1000);
    expect(respostasDueloParaSalvar(e)[0]!.tempo_ms).toBe(0);
  });
});
