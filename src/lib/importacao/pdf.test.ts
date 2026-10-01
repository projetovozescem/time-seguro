import { describe, expect, it } from "vitest";
import { detectarFontesDeDestaque, lerGabarito, lerMarcador, lerPdf, type LinhaPdf } from "./pdf";

/**
 * Portado de `docs/legado-maxgames/__tests__/pdfQuestions.test.js`, com os casos
 * do T.I.M.E. acrescentados no fim (tema padrão do lote e avisos).
 */

/** Monta linhas no formato que o extrator do pdf.js produz. */
function linhas(
  itens: readonly (string | (Partial<LinhaPdf> & { text: string }))[],
  page = 1,
): LinhaPdf[] {
  return itens.map((item, i) =>
    typeof item === "string"
      ? { page, y: 700 - i * 20, text: item, fonts: ["body"] }
      : {
          page: item.page ?? page,
          y: item.y ?? 700 - i * 20,
          text: item.text,
          fonts: item.fonts ?? ["body"],
        },
  );
}

describe("lerPdf — formatos de enunciado", () => {
  it('aceita "Questao N"', () => {
    const p = lerPdf(
      linhas([
        "Questao 1",
        "Qual o maior planeta?",
        "A) Terra",
        "B) Marte",
        "C) Jupiter",
        "D) Venus",
      ]),
      1,
    );
    expect(p).toHaveLength(1);
    expect(p[0]!.enunciado).toBe("Qual o maior planeta?");
    expect(p[0]!.alternativas).toHaveLength(4);
  });

  it('aceita numeração nua "1." e alternativas "A."', () => {
    const p = lerPdf(
      linhas([
        "1. Qual e a capital do Brasil?",
        "A. Buenos Aires",
        "B. Rio de Janeiro",
        "C. Brasilia",
        "D. Sao Paulo",
      ]),
      1,
    );
    expect(p).toHaveLength(1);
    expect(p[0]!.alternativas).toHaveLength(4);
  });

  it('aceita "Pergunta N", "(A)" e cinco alternativas', () => {
    const p = lerPdf(
      linhas([
        "Pergunta 1: Qual gas as plantas absorvem?",
        "(A) Oxigenio",
        "(B) Dioxido de carbono",
        "(C) Nitrogenio",
        "(D) Hidrogenio",
        "(E) Helio",
      ]),
      1,
    );
    expect(p[0]!.alternativas).toHaveLength(5);
  });

  it('não confunde uma frase iniciada por "E -" com a alternativa E', () => {
    const p = lerPdf(
      linhas([
        "Questao 1",
        "O que e seguranca do trabalho?",
        "A) Um conjunto de medidas preventivas",
        "B) Uma etapa opcional da producao",
        "E - isso vale para toda a industria brasileira",
      ]),
      1,
    );
    expect(p[0]!.alternativas).toHaveLength(2);
    expect(p[0]!.alternativas[1]).toContain("industria brasileira");
  });

  it("junta enunciado e alternativa quebrados em várias linhas", () => {
    const p = lerPdf(
      linhas([
        "Questao 1",
        "Uma maquina esta com a protecao danificada.",
        "O que deve ser feito?",
        "A) Continuar usando normalmente",
        "B) Parar a maquina e avisar o supervisor",
        "ate que o reparo seja concluido",
      ]),
      1,
    );
    expect(p[0]!.enunciado).toBe(
      "Uma maquina esta com a protecao danificada. O que deve ser feito?",
    );
    expect(p[0]!.alternativas[1]).toContain("reparo seja concluido");
  });

  it("a alternativa sai sem o prefixo da letra — a ordem já diz qual é", () => {
    const p = lerPdf(linhas(["Questao 1", "Pergunta?", "A) Sim", "B) Nao"]), 1);
    expect(p[0]!.alternativas).toEqual(["Sim", "Nao"]);
  });
});

describe("lerPdf — resposta correta", () => {
  const base = [
    "Questao 1",
    "Qual o maior planeta?",
    "A) Terra",
    "B) Marte",
    "C) Jupiter",
    "D) Venus",
    "Questao 2",
    "Qual o menor planeta?",
    "A) Mercurio",
    "B) Marte",
    "C) Jupiter",
    "D) Saturno",
  ];

  it("sem gabarito e sem destaque, a resposta fica indefinida e avisa", () => {
    const p = lerPdf(linhas(base), 1);
    expect(p.every((q) => q.correta === null)).toBe(true);
    expect(p[0]!.avisos).toContain("resposta_nao_detectada");
  });

  it("lê o gabarito no fim do documento", () => {
    const p = lerPdf(linhas([...base, "Gabarito Oficial", "Q1: C   Q2: A"]), 1);
    expect(p[0]!.correta).toBe(2);
    expect(p[1]!.correta).toBe(0);
    expect(p[0]!.avisos).not.toContain("resposta_nao_detectada");
  });

  it('aceita gabarito no formato "1 - C"', () => {
    const p = lerPdf(linhas([...base, "Respostas", "1 - C", "2 - A"]), 1);
    expect(p[0]!.correta).toBe(2);
    expect(p[1]!.correta).toBe(0);
  });

  it('ignora "Q3: C" solto no corpo do texto', () => {
    const p = lerPdf(
      linhas([
        "Questao 3",
        "O que diz o anexo, conforme Q3: C do manual?",
        "A) Uma coisa",
        "B) Outra coisa",
        "C) Terceira",
        "D) Quarta",
      ]),
      1,
    );
    expect(p[0]!.correta).toBeNull();
  });

  it("o gabarito tem precedência sobre o destaque tipográfico", () => {
    const p = lerPdf(
      linhas([
        "Questao 1",
        "Qual o objetivo da NR-12?",
        { text: "A) Prevenir acidentes com maquinas", fonts: ["bold"] },
        "B) Definir a jornada",
        "C) Fixar o salario",
        "D) Exigir maquinas antigas",
        "Questao 2",
        "O que significa EPI?",
        { text: "A) Equipamento de Protecao Individual", fonts: ["bold"] },
        "B) Equipamento de Producao",
        "C) Especificacao de Padrao",
        "D) Estrutura Integrada",
        "Gabarito",
        "Q1: B  Q2: A",
      ]),
      1,
    );
    expect(p[0]!.correta).toBe(1);
    expect(p[1]!.correta).toBe(0);
  });

  it("detecta a alternativa em fonte destacada", () => {
    const p = lerPdf(
      linhas([
        "Questao 1",
        "Qual o objetivo da NR-12?",
        { text: "A) Prevenir acidentes com maquinas", fonts: ["bold"] },
        "B) Definir a jornada de trabalho",
        "C) Fixar o salario minimo",
        "D) Exigir maquinas antigas",
        "Questao 2",
        "O que significa EPI?",
        { text: "A) Equipamento de Protecao Individual", fonts: ["bold"] },
        "B) Equipamento de Producao Industrial",
        "C) Especificacao de Padrao Industrial",
        "D) Estrutura de Protecao Integrada",
      ]),
      1,
    );
    expect(p[0]!.correta).toBe(0);
    expect(p[1]!.correta).toBe(0);
  });

  it("reconhece o marcador **negrito** no texto", () => {
    const p = lerPdf(
      linhas([
        "Questao 1",
        "Qual gas as plantas absorvem?",
        "A) Oxigenio",
        "B) **Dioxido de carbono**",
        "C) Nitrogenio",
        "D) Helio",
      ]),
      1,
    );
    expect(p[0]!.correta).toBe(1);
    expect(p[0]!.alternativas[1]).not.toContain("*");
  });
});

describe("detectarFontesDeDestaque", () => {
  /**
   * A fonte MAIORITARIA e o corpo do texto; as minoritarias sao destaque. Se as
   * minoritarias juntas cobrem mais de 45% das alternativas, o sinal nao
   * significa nada e a funcao devolve null — melhor exigir revisao do que
   * marcar a resposta errada.
   */
  it("uma fonte minoritaria no meio das alternativas e destaque", () => {
    const itens = [
      { text: "A) Uma", fonts: ["body"] },
      { text: "B) Duas", fonts: ["bold"] },
      { text: "C) Tres", fonts: ["body"] },
      { text: "D) Quatro", fonts: ["body"] },
    ];
    expect(detectarFontesDeDestaque(linhas(itens))).toEqual(new Set(["bold"]));
  });

  it("duas fontes minoritarias cobrindo mais de 45% das alternativas nao valem", () => {
    const itens = [
      ...["A", "B", "C", "D"].map((l) => ({ text: `${l}) corpo`, fonts: ["body"] })),
      ...["A", "B", "C"].map((l) => ({ text: `${l}) negrito`, fonts: ["bold"] })),
      ...["A", "B", "C"].map((l) => ({ text: `${l}) italico`, fonts: ["italic"] })),
    ];
    expect(detectarFontesDeDestaque(linhas(itens))).toBeNull();
  });

  it("devolve null com poucas alternativas no documento", () => {
    expect(detectarFontesDeDestaque(linhas(["A) Uma", "B) Duas"]))).toBeNull();
  });
});

describe("lerGabarito", () => {
  it("sem cabeçalho de gabarito devolve mapa vazio", () => {
    expect(lerGabarito(linhas(["1. Pergunta", "A) Sim", "B) Nao"])).size).toBe(0);
  });

  it("lê várias entradas na mesma linha", () => {
    const mapa = lerGabarito(linhas(["Gabarito", "1: A  2: B  3: C"]));
    expect([...mapa.entries()]).toEqual([
      [1, "A"],
      [2, "B"],
      [3, "C"],
    ]);
  });
});

describe("lerMarcador", () => {
  it("tira o marcador e mantém o texto", () => {
    expect(lerMarcador("**Resposta certa**")).toEqual({ marcada: true, texto: "Resposta certa" });
    expect(lerMarcador("Resposta certa (correta)")).toEqual({
      marcada: true,
      texto: "Resposta certa",
    });
    expect(lerMarcador("✔ Resposta")).toEqual({ marcada: true, texto: "Resposta" });
  });

  it("texto sem marcador passa intacto", () => {
    expect(lerMarcador("Resposta comum")).toEqual({ marcada: false, texto: "Resposta comum" });
  });
});

describe("lerPdf — cabeçalhos e rodapés", () => {
  it("remove linhas repetidas nas margens de todas as páginas", () => {
    const entrada: LinhaPdf[] = [];
    for (let page = 1; page <= 3; page++) {
      entrada.push({ page, y: 780, text: "QUIS NR-12 Seguranca do Trabalho", fonts: ["body"] });
      entrada.push({ page, y: 700, text: `Questao ${page}`, fonts: ["body"] });
      entrada.push({ page, y: 680, text: `Pergunta numero ${page}?`, fonts: ["body"] });
      entrada.push({ page, y: 660, text: "A) Primeira opcao", fonts: ["body"] });
      entrada.push({ page, y: 640, text: "B) Segunda opcao", fonts: ["body"] });
      entrada.push({ page, y: 30, text: `${page} / 3`, fonts: ["body"] });
    }
    const p = lerPdf(entrada, 3);
    expect(p).toHaveLength(3);
    for (const q of p) {
      expect(q.enunciado).not.toContain("QUIS NR-12");
      expect(q.alternativas.join(" ")).not.toContain("/ 3");
    }
  });

  it("com uma página só, não descarta nada por repetição", () => {
    const p = lerPdf(
      linhas([
        { text: "Manual de Seguranca", y: 790 },
        { text: "Questao 1", y: 700 },
        { text: "Pergunta valida?", y: 680 },
        { text: "A) Sim", y: 660 },
        { text: "B) Nao", y: 640 },
      ]),
      1,
    );
    expect(p).toHaveLength(1);
  });
});

describe("lerPdf — contrato de saída", () => {
  it("descarta pergunta com menos de duas alternativas", () => {
    const p = lerPdf(
      linhas(["Questao 1", "Pergunta sem alternativas suficientes?", "A) Unica opcao"]),
      1,
    );
    expect(p).toHaveLength(0);
  });

  it("descarta pergunta sem enunciado", () => {
    const p = lerPdf(linhas(["Questao 1", "A) Sim", "B) Nao"]), 1);
    expect(p).toHaveLength(0);
  });

  it("o número da questão não vai para a saída — serve só para casar o gabarito", () => {
    const p = lerPdf(linhas(["Questao 7", "Alguma pergunta valida?", "A) Sim", "B) Nao"]), 1);
    expect(Object.keys(p[0]!).sort()).toEqual([
      "alternativas",
      "avisos",
      "correta",
      "dificuldade",
      "enunciado",
      "tema",
    ]);
  });

  it("o tema padrão do lote vale para todas e tira o aviso de tema ausente", () => {
    const p = lerPdf(linhas(["Questao 1", "Pergunta valida?", "A) Sim", "B) Nao"]), 1, "nr12");
    expect(p[0]!.tema).toBe("nr12");
    expect(p[0]!.avisos).not.toContain("tema_ausente");
  });

  it("sem tema padrão, avisa tema ausente", () => {
    const p = lerPdf(linhas(["Questao 1", "Pergunta valida?", "A) Sim", "B) Nao"]), 1);
    expect(p[0]!.tema).toBeNull();
    expect(p[0]!.avisos).toContain("tema_ausente");
  });

  it("documento vazio devolve lista vazia", () => {
    expect(lerPdf([], 0)).toEqual([]);
  });
});
