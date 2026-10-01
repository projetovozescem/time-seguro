import { describe, expect, it } from "vitest";
import {
  VARIACAO_MINIMA,
  frasesDeDestaque,
  participacao,
  seta,
  taxaGeral,
  taxaPorTema,
  variacoes,
  type LinhaLacunaCampanha,
} from "./comparativo";
import { MINIMO_RESPOSTAS } from "./lacunas";

function linha(p: Partial<LinhaLacunaCampanha> = {}): LinhaLacunaCampanha {
  return {
    campanha_id: "c1",
    setor_id: "s1",
    tema_id: "t1",
    tentativas: 20,
    acertos: 10,
    ...p,
  };
}

describe("participacao", () => {
  it("é percentual do efetivo", () => {
    expect(participacao({ participantes: 15, ativos: 30 })).toBe(50);
  });

  it("sem efetivo não divide por zero", () => {
    expect(participacao({ participantes: 0, ativos: 0 })).toBe(0);
  });
});

describe("taxaGeral", () => {
  it("sem resposta é null, não zero", () => {
    expect(taxaGeral({ tentativas: 0, acertos: 0 })).toBeNull();
  });

  it("arredonda como o mapa de lacunas", () => {
    expect(taxaGeral({ tentativas: 3, acertos: 2 })).toBe(67);
  });
});

describe("taxaPorTema", () => {
  it("soma os setores dentro do tema", () => {
    const t = taxaPorTema([
      linha({ setor_id: "s1", tentativas: 10, acertos: 5 }),
      linha({ setor_id: "s2", tentativas: 10, acertos: 9 }),
    ]);
    expect(t.get("t1")).toEqual({ tentativas: 20, acertos: 14, taxa: 70 });
  });

  it("separa temas diferentes", () => {
    const t = taxaPorTema([
      linha({ tema_id: "t1", tentativas: 10, acertos: 10 }),
      linha({ tema_id: "t2", tentativas: 10, acertos: 0 }),
    ]);
    expect(t.get("t1")!.taxa).toBe(100);
    expect(t.get("t2")!.taxa).toBe(0);
  });
});

describe("variacoes", () => {
  it("calcula o delta em pontos percentuais", () => {
    const v = variacoes(
      [linha({ tentativas: 50, acertos: 27 })],
      [linha({ campanha_id: "c2", tentativas: 50, acertos: 39 })],
    );
    expect(v).toEqual([{ setor_id: "s1", tema_id: "t1", antes: 54, depois: 78, delta: 24 }]);
  });

  it("descarta célula com poucas respostas no ANTES", () => {
    const poucas = MINIMO_RESPOSTAS - 1;
    const v = variacoes(
      [linha({ tentativas: poucas, acertos: poucas })],
      [linha({ campanha_id: "c2", tentativas: 50, acertos: 25 })],
    );
    expect(v).toEqual([]);
  });

  it("descarta célula com poucas respostas no DEPOIS", () => {
    const poucas = MINIMO_RESPOSTAS - 1;
    const v = variacoes(
      [linha({ tentativas: 50, acertos: 25 })],
      [linha({ campanha_id: "c2", tentativas: poucas, acertos: 0 })],
    );
    expect(v).toEqual([]);
  });

  it("ignora célula que só existe em uma das campanhas", () => {
    const v = variacoes(
      [linha({ setor_id: "s1" })],
      [linha({ campanha_id: "c2", setor_id: "s2" })],
    );
    expect(v).toEqual([]);
  });

  it("vem ordenado da maior subida para a maior queda", () => {
    const v = variacoes(
      [
        linha({ tema_id: "t1", tentativas: 20, acertos: 10 }),
        linha({ tema_id: "t2", tentativas: 20, acertos: 18 }),
      ],
      [
        linha({ campanha_id: "c2", tema_id: "t1", tentativas: 20, acertos: 18 }),
        linha({ campanha_id: "c2", tema_id: "t2", tentativas: 20, acertos: 8 }),
      ],
    );
    expect(v.map((x) => x.tema_id)).toEqual(["t1", "t2"]);
    expect(v[0]!.delta).toBeGreaterThan(0);
    expect(v[1]!.delta).toBeLessThan(0);
  });
});

describe("frasesDeDestaque", () => {
  const setor = () => "Usinagem";
  const tema = () => "NR-12";

  it("escreve a subida e a queda", () => {
    const lista = [
      { setor_id: "s1", tema_id: "t1", antes: 54, depois: 78, delta: 24 },
      { setor_id: "s2", tema_id: "t2", antes: 80, depois: 60, delta: -20 },
    ];
    const frases = frasesDeDestaque(lista, setor, tema);
    expect(frases).toHaveLength(2);
    expect(frases[0]).toBe("A taxa de acerto em NR-12 no setor Usinagem subiu de 54% para 78%.");
    expect(frases[1]).toContain("caiu de 80% para 60%");
  });

  it("variação pequena não gera frase", () => {
    const lista = [
      { setor_id: "s1", tema_id: "t1", antes: 70, depois: 72, delta: VARIACAO_MINIMA - 3 },
    ];
    expect(frasesDeDestaque(lista, setor, tema)).toEqual([]);
  });

  it("uma única variação não é citada duas vezes", () => {
    const lista = [{ setor_id: "s1", tema_id: "t1", antes: 50, depois: 80, delta: 30 }];
    expect(frasesDeDestaque(lista, setor, tema)).toHaveLength(1);
  });

  it("sem variação nenhuma devolve lista vazia", () => {
    expect(frasesDeDestaque([], setor, tema)).toEqual([]);
  });
});

describe("seta", () => {
  it("empate dentro da margem não vira flecha", () => {
    expect(seta(0)).toBe("–");
    expect(seta(VARIACAO_MINIMA - 1)).toBe("–");
    expect(seta(-(VARIACAO_MINIMA - 1))).toBe("–");
  });

  it("acima da margem aponta para o lado certo", () => {
    expect(seta(VARIACAO_MINIMA)).toBe("▲");
    expect(seta(-VARIACAO_MINIMA)).toBe("▼");
  });
});
