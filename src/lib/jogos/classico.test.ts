import { describe, expect, it } from "vitest";
import {
  PONTOS_POR_ACERTO,
  acertos,
  erros,
  estadoInicial,
  pontos,
  reducer,
  respostasParaSalvar,
  sortearPerguntas,
  type Estado,
  type PerguntaTv,
} from "./classico";

function pergunta(id: string, correta = 1): PerguntaTv {
  return {
    id,
    enunciado: `Enunciado ${id}`,
    alternativas: ["A", "B", "C", "D"],
    correta,
    explicacao: `Explicação ${id}`,
    tema: "nr35",
  };
}

/** Caminho completo de uma pergunta: tocar, revelar, avançar. */
function responder(estado: Estado, alternativa: number, agora = 1000): Estado {
  let e = reducer(estado, { tipo: "escolher", alternativa, agora });
  e = reducer(e, { tipo: "revelar" });
  return reducer(e, { tipo: "avancar" });
}

describe("estadoInicial", () => {
  it("começa na primeira pergunta", () => {
    const e = estadoInicial([pergunta("p1"), pergunta("p2")]);
    expect(e.indice).toBe(0);
    expect(e.fase).toBe("pergunta");
    expect(e.escolhida).toBeNull();
    expect(e.respostas).toEqual([]);
  });

  it("sem pergunta nenhuma já termina", () => {
    expect(estadoInicial([]).fase).toBe("fim");
  });
});

describe("fluxo de uma pergunta (docs/TIME_06 §4)", () => {
  const inicial = estadoInicial([pergunta("p1"), pergunta("p2")]);

  it("tocar vai para destacando e registra a resposta", () => {
    const e = reducer(inicial, { tipo: "escolher", alternativa: 1, agora: 2500 });
    expect(e.fase).toBe("destacando");
    expect(e.escolhida).toBe(1);
    expect(e.respostas).toHaveLength(1);
    expect(e.respostas[0]).toMatchObject({
      pergunta_id: "p1",
      alternativa: 1,
      acertou: true,
      ordem: 1,
    });
    expect(e.respostas[0]!.tempo_ms).toBe(2500);
  });

  it("depois vem revelado, e só então avança", () => {
    let e = reducer(inicial, { tipo: "escolher", alternativa: 1, agora: 1000 });
    e = reducer(e, { tipo: "revelar" });
    expect(e.fase).toBe("revelado");
    e = reducer(e, { tipo: "avancar" });
    expect(e.fase).toBe("pergunta");
    expect(e.indice).toBe(1);
    expect(e.escolhida).toBeNull();
  });

  it("marca errado quando a alternativa não é a correta", () => {
    const e = reducer(inicial, { tipo: "escolher", alternativa: 3, agora: 1000 });
    expect(e.respostas[0]!.acertou).toBe(false);
  });

  it("termina depois da última pergunta", () => {
    let e = responder(inicial, 1);
    e = responder(e, 1);
    expect(e.fase).toBe("fim");
    expect(e.respostas).toHaveLength(2);
  });
});

describe("o reducer ignora ação fora de fase", () => {
  const inicial = estadoInicial([pergunta("p1")]);

  it("tocar duas vezes não registra duas respostas", () => {
    let e = reducer(inicial, { tipo: "escolher", alternativa: 1, agora: 1000 });
    e = reducer(e, { tipo: "escolher", alternativa: 2, agora: 2000 });
    expect(e.respostas).toHaveLength(1);
    expect(e.escolhida).toBe(1);
  });

  it("avançar sem revelar não faz nada", () => {
    const e = reducer(inicial, { tipo: "avancar" });
    expect(e).toBe(inicial);
  });

  it("revelar sem ter tocado não faz nada", () => {
    const e = reducer(inicial, { tipo: "revelar" });
    expect(e).toBe(inicial);
  });

  it("alternativa fora da faixa é ignorada", () => {
    for (const alternativa of [-1, 4, 99]) {
      expect(reducer(inicial, { tipo: "escolher", alternativa, agora: 1 })).toBe(inicial);
    }
  });

  it("tempo negativo não vaza para a resposta", () => {
    // `agora` menor que `abertaEm` só acontece se o relógio voltar.
    const comAbertura = { ...inicial, abertaEm: 5000 };
    const e = reducer(comAbertura, { tipo: "escolher", alternativa: 0, agora: 1000 });
    expect(e.respostas[0]!.tempo_ms).toBe(0);
  });
});

describe("pontuação (docs/TIME_06 §4: acertos × 10)", () => {
  it("conta acertos, erros e pontos", () => {
    let e = estadoInicial([pergunta("p1"), pergunta("p2"), pergunta("p3")]);
    e = responder(e, 1); // acerto
    e = responder(e, 0); // erro
    e = responder(e, 1); // acerto

    expect(acertos(e)).toBe(2);
    expect(erros(e)).toBe(1);
    expect(pontos(e)).toBe(2 * PONTOS_POR_ACERTO);
    expect(PONTOS_POR_ACERTO).toBe(10);
  });

  it("partida sem acerto vale zero", () => {
    let e = estadoInicial([pergunta("p1")]);
    e = responder(e, 0);
    expect(pontos(e)).toBe(0);
  });
});

describe("respostasParaSalvar", () => {
  it("monta o formato que tecnico_salvar_quiz_tv espera", () => {
    let e = estadoInicial([pergunta("p1"), pergunta("p2")]);
    e = responder(e, 1, 3000);
    e = responder(e, 2, 4000);

    const linhas = respostasParaSalvar(e, "setor-1");
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toEqual({
      setor_id: "setor-1",
      pergunta_id: "p1",
      alternativa: 1,
      tempo_ms: 3000,
      ordem: 1,
    });
    expect(linhas[1]!.ordem).toBe(2);
  });

  it("aceita partida sem setor (opção Todos)", () => {
    let e = estadoInicial([pergunta("p1")]);
    e = responder(e, 1);
    expect(respostasParaSalvar(e, null)[0]!.setor_id).toBeNull();
  });
});

describe("sortearPerguntas", () => {
  const banco = [
    { ...pergunta("a"), tema_id: "t-bom" },
    { ...pergunta("b"), tema_id: "t-bom" },
    { ...pergunta("c"), tema_id: "t-ruim" },
    { ...pergunta("d"), tema_id: "t-ruim" },
    { ...pergunta("e"), tema_id: "t-medio" },
  ];

  it("devolve a quantidade pedida", () => {
    expect(sortearPerguntas(banco, 3)).toHaveLength(3);
  });

  it("não devolve mais do que existe", () => {
    expect(sortearPerguntas(banco, 99)).toHaveLength(banco.length);
  });

  it("devolve vazio para quantidade zero ou banco vazio", () => {
    expect(sortearPerguntas(banco, 0)).toEqual([]);
    expect(sortearPerguntas([], 5)).toEqual([]);
  });

  it("prioriza os temas com pior taxa de acerto quando pedido", () => {
    // `t-ruim` primeiro: as duas primeiras têm de ser dele.
    const escolhidas = sortearPerguntas(banco, 2, ["t-ruim", "t-medio", "t-bom"]);
    expect(escolhidas.map((p) => p.id).sort()).toEqual(["c", "d"]);
  });

  it("sem prioridade, não quebra nem repete", () => {
    const escolhidas = sortearPerguntas(banco, 4);
    expect(new Set(escolhidas.map((p) => p.id)).size).toBe(4);
  });

  it("tema fora da lista de prioridade vai para o fim", () => {
    const escolhidas = sortearPerguntas(banco, 3, ["t-ruim"]);
    // As duas de t-ruim entram; a terceira é de qualquer outro tema.
    expect(escolhidas.filter((p) => p.id === "c" || p.id === "d")).toHaveLength(2);
  });
});
