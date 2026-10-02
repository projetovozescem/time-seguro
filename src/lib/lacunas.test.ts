import { describe, expect, it } from "vitest";
import {
  FAIXAS,
  MINIMO_RESPOSTAS,
  faixaDaCelula,
  montarMatriz,
  percentual,
  prioridadeDeTreinamento,
  temasPorPiorDesempenho,
  type LinhaLacuna,
  contarPorFaixa,
} from "./lacunas";

describe("faixaDaCelula — as faixas de docs/TIME_09 §1.2", () => {
  it("80% ou mais domina", () => {
    expect(faixaDaCelula(20, 0.8)).toBe("domina");
    expect(faixaDaCelula(20, 1)).toBe("domina");
  });

  it("de 60 a 79% é atenção", () => {
    expect(faixaDaCelula(20, 0.6)).toBe("atencao");
    expect(faixaDaCelula(20, 0.79)).toBe("atencao");
  });

  it("abaixo de 60% é lacuna", () => {
    expect(faixaDaCelula(20, 0.59)).toBe("lacuna");
    expect(faixaDaCelula(20, 0)).toBe("lacuna");
  });

  /**
   * Este é o teste que mais importa: com pouca resposta, a taxa não quer dizer
   * nada. Um setor com 2 acertos em 2 tentativas não "domina" o tema.
   */
  it("contagem insuficiente vence a taxa", () => {
    expect(faixaDaCelula(2, 1)).toBe("insuficiente");
    expect(faixaDaCelula(9, 1)).toBe("insuficiente");
    expect(faixaDaCelula(9, 0)).toBe("insuficiente");
    expect(faixaDaCelula(0, 0)).toBe("insuficiente");
  });

  it("exatamente no mínimo já conta", () => {
    expect(MINIMO_RESPOSTAS).toBe(10);
    expect(faixaDaCelula(10, 0.9)).toBe("domina");
  });

  it("toda faixa tem rótulo, cor e leitura", () => {
    for (const f of Object.values(FAIXAS)) {
      expect(f.rotulo.length).toBeGreaterThan(0);
      expect(f.cor).toContain("bg-");
      expect(f.leitura.length).toBeGreaterThan(5);
    }
  });

  it("a cor da faixa insuficiente é listrada, não uma cor de desempenho", () => {
    expect(FAIXAS.insuficiente.cor).toContain("repeating-linear-gradient");
  });
});

describe("percentual", () => {
  it("arredonda para inteiro", () => {
    expect(percentual(0.856)).toBe(86);
    expect(percentual(0)).toBe(0);
    expect(percentual(1)).toBe(100);
  });
});

describe("montarMatriz", () => {
  const linhas: LinhaLacuna[] = [
    { setor_id: "s1", tema_id: "t1", tentativas: 20, acertos: 18, taxa_acerto: 0.9 },
    { setor_id: "s1", tema_id: "t2", tentativas: 15, acertos: 6, taxa_acerto: 0.4 },
    { setor_id: "s2", tema_id: "t1", tentativas: 4, acertos: 4, taxa_acerto: 1 },
  ];

  it("cria uma célula para cada combinação", () => {
    const m = montarMatriz(linhas, ["s1", "s2"], ["t1", "t2"]);
    expect(m.size).toBe(4);
  });

  it("combinação sem dado nenhum vira célula vazia e insuficiente", () => {
    const m = montarMatriz(linhas, ["s1", "s2"], ["t1", "t2"]);
    const vazia = m.get("s2|t2")!;
    expect(vazia.tentativas).toBe(0);
    expect(vazia.faixa).toBe("insuficiente");
  });

  it("classifica cada célula com dado", () => {
    const m = montarMatriz(linhas, ["s1", "s2"], ["t1", "t2"]);
    expect(m.get("s1|t1")!.faixa).toBe("domina");
    expect(m.get("s1|t2")!.faixa).toBe("lacuna");
    // 4 tentativas, 100%: insuficiente, não "domina".
    expect(m.get("s2|t1")!.faixa).toBe("insuficiente");
  });

  it("devolve mapa vazio sem setor ou sem tema", () => {
    expect(montarMatriz(linhas, [], ["t1"]).size).toBe(0);
    expect(montarMatriz(linhas, ["s1"], []).size).toBe(0);
  });

  it("aceita taxa vindo como string, que é como o Postgres manda numeric", () => {
    const m = montarMatriz(
      [{ setor_id: "s1", tema_id: "t1", tentativas: 20, acertos: 18, taxa_acerto: "0.9" as never }],
      ["s1"],
      ["t1"],
    );
    expect(m.get("s1|t1")!.faixa).toBe("domina");
  });
});

describe("prioridadeDeTreinamento", () => {
  it("lista da pior para a melhor, ignorando o que domina e o insuficiente", () => {
    const m = montarMatriz(
      [
        { setor_id: "s1", tema_id: "t1", tentativas: 20, acertos: 18, taxa_acerto: 0.9 },
        { setor_id: "s1", tema_id: "t2", tentativas: 20, acertos: 8, taxa_acerto: 0.4 },
        { setor_id: "s1", tema_id: "t3", tentativas: 20, acertos: 13, taxa_acerto: 0.65 },
        { setor_id: "s1", tema_id: "t4", tentativas: 3, acertos: 0, taxa_acerto: 0 },
      ],
      ["s1"],
      ["t1", "t2", "t3", "t4"],
    );

    const p = prioridadeDeTreinamento(m);
    expect(p.map((c) => c.tema_id)).toEqual(["t2", "t3"]);
  });

  it("devolve vazio quando tudo está dominado", () => {
    const m = montarMatriz(
      [{ setor_id: "s1", tema_id: "t1", tentativas: 20, acertos: 20, taxa_acerto: 1 }],
      ["s1"],
      ["t1"],
    );
    expect(prioridadeDeTreinamento(m)).toEqual([]);
  });
});

describe("temasPorPiorDesempenho", () => {
  it("agrega os setores e ordena pelo pior tema", () => {
    const m = montarMatriz(
      [
        { setor_id: "s1", tema_id: "bom", tentativas: 10, acertos: 9, taxa_acerto: 0.9 },
        { setor_id: "s2", tema_id: "bom", tentativas: 10, acertos: 9, taxa_acerto: 0.9 },
        { setor_id: "s1", tema_id: "ruim", tentativas: 10, acertos: 3, taxa_acerto: 0.3 },
        { setor_id: "s2", tema_id: "ruim", tentativas: 10, acertos: 2, taxa_acerto: 0.2 },
      ],
      ["s1", "s2"],
      ["bom", "ruim"],
    );
    expect(temasPorPiorDesempenho(m)).toEqual(["ruim", "bom"]);
  });

  it("ignora tema sem tentativa nenhuma", () => {
    const m = montarMatriz(
      [{ setor_id: "s1", tema_id: "t1", tentativas: 10, acertos: 5, taxa_acerto: 0.5 }],
      ["s1"],
      ["t1", "sem-dado"],
    );
    expect(temasPorPiorDesempenho(m)).toEqual(["t1"]);
  });

  it("devolve vazio para matriz sem dado", () => {
    expect(temasPorPiorDesempenho(montarMatriz([], ["s1"], ["t1"]))).toEqual([]);
  });
});

describe("contarPorFaixa", () => {
  it("conta as células de cada faixa, inclusive as vazias (insuficiente)", () => {
    const matriz = montarMatriz(
      [
        { setor_id: "s1", tema_id: "t1", tentativas: 20, acertos: 18, taxa_acerto: 0.9 },
        { setor_id: "s1", tema_id: "t2", tentativas: 20, acertos: 14, taxa_acerto: 0.7 },
        { setor_id: "s2", tema_id: "t1", tentativas: 20, acertos: 6, taxa_acerto: 0.3 },
        { setor_id: "s2", tema_id: "t2", tentativas: 3, acertos: 3, taxa_acerto: 1 },
      ],
      ["s1", "s2", "s3"],
      ["t1", "t2"],
    );
    // s3 não respondeu nada: 2 células sem dado, somadas à de 3 respostas.
    expect(contarPorFaixa(matriz)).toEqual({ domina: 1, atencao: 1, lacuna: 1, insuficiente: 3 });
  });

  it("a soma fecha com o tamanho da matriz", () => {
    const matriz = montarMatriz([], ["s1", "s2"], ["t1", "t2", "t3"]);
    const c = contarPorFaixa(matriz);
    expect(c.domina + c.atencao + c.lacuna + c.insuficiente).toBe(matriz.size);
  });

  it("matriz vazia dá zero em tudo", () => {
    expect(contarPorFaixa(new Map())).toEqual({
      domina: 0,
      atencao: 0,
      lacuna: 0,
      insuficiente: 0,
    });
  });
});
