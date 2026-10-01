import { describe, expect, it } from "vitest";
import { lerTxt, escreverTxt, indiceDaCorreta } from "./txt";
import { lerCsv, detectarSeparador, quebrarLinha, MODELO_CSV } from "./csv";
import { normalizar } from "./tipos";

// Os casos abaixo são os sete que docs/TIME_07 §7 exige, na ordem do documento.

describe("TXT com Tema herdado entre perguntas (TIME_07 §3)", () => {
  const txt = `Tema: nr35
Pergunta: A partir de qual altura a NR-35 considera trabalho em altura?
A) Acima de 1,00 m
B) Acima de 1,50 m
C) Acima de 2,00 m do nível inferior, com risco de queda
D) Acima de 3,00 m
Correta: C
Explicação: A NR-35 considera acima de 2,00 m com risco de queda.
Dificuldade: 1

Pergunta: Quem autoriza o trabalho em altura?
A) Qualquer colega
B) O profissional capacitado e autorizado, com permissão de trabalho
Correta: B

Tema: epi
Pergunta: Quando o uso do EPI é obrigatório?
A) Só na auditoria
B) Sempre que a atividade exigir, conforme a análise de risco
Correta: B
`;

  it("herda o tema até aparecer outro Tema:", () => {
    const p = lerTxt(txt);
    expect(p.map((x) => x.tema)).toEqual(["nr35", "nr35", "epi"]);
  });

  it("lê enunciado, alternativas, correta, explicação e dificuldade", () => {
    const [primeira] = lerTxt(txt);
    expect(primeira!.enunciado).toBe(
      "A partir de qual altura a NR-35 considera trabalho em altura?",
    );
    expect(primeira!.alternativas).toHaveLength(4);
    expect(primeira!.correta).toBe(2); // C, 0-based
    expect(primeira!.explicacao).toContain("2,00 m");
    expect(primeira!.dificuldade).toBe(1);
    expect(primeira!.avisos).toEqual([]);
  });

  it("usa dificuldade 2 quando o arquivo não informa", () => {
    const p = lerTxt(txt);
    expect(p[1]!.dificuldade).toBe(2);
  });
});

describe("TXT com Resposta: e alternativas (A) (TIME_07 §3)", () => {
  const txt = `Tema: nr12
Pergunta: Para que serve a proteção fixa de uma máquina?
(A) Deixar a máquina mais bonita
(B) Impedir o acesso à zona de perigo durante o funcionamento
(C) Reduzir o consumo de energia
Resposta: B
`;

  it("aceita Resposta: como sinônimo de Correta:", () => {
    const [p] = lerTxt(txt);
    expect(p!.correta).toBe(1);
  });

  it("aceita alternativas no formato (A)", () => {
    const [p] = lerTxt(txt);
    expect(p!.alternativas[1]).toBe("Impedir o acesso à zona de perigo durante o funcionamento");
  });

  it("aceita também A. e A - ", () => {
    const [p] = lerTxt(`Pergunta: Qual destes é um EPI de proteção auditiva?
A. Protetor auricular
B - Capacete
Correta: 1
`);
    expect(p!.alternativas).toEqual(["Protetor auricular", "Capacete"]);
    expect(p!.correta).toBe(0);
  });
});

describe("CSV com ; e com , correta em letra e número (TIME_07 §4)", () => {
  const comPontoEVirgula = `tema;pergunta;a;b;c;d;e;correta;explicacao;dificuldade
nr10;O que significa desenergizar antes de intervir num circuito?;Desligar só o disjuntor;Seguir a sequência completa de desenergização;Usar luva;Avisar o colega;;B;A NR-10 define uma sequência completa.;2`;

  const comVirgula = `tema,pergunta,a,b,correta
epi,Quando o EPI deve ser substituído?,Nunca,Sempre que estiver danificado ou vencido,2`;

  it("lê separador ;", () => {
    const [p] = lerCsv(comPontoEVirgula);
    expect(p!.tema).toBe("nr10");
    expect(p!.alternativas).toHaveLength(4);
    expect(p!.correta).toBe(1);
    expect(p!.dificuldade).toBe(2);
  });

  it("lê separador , e correta em número", () => {
    const [p] = lerCsv(comVirgula);
    expect(p!.tema).toBe("epi");
    expect(p!.correta).toBe(1);
  });

  it("aceita cabeçalho em qualquer ordem e sem acento", () => {
    const [p] = lerCsv(`Pergunta;Correta;A;B;Tema;Explicacao
Qual a altura mínima da NR-35?;A;2,00 m;1,50 m;nr35;Texto da explicação`);
    expect(p!.tema).toBe("nr35");
    expect(p!.correta).toBe(0);
    expect(p!.explicacao).toBe("Texto da explicação");
  });

  it("respeita campo entre aspas com o separador dentro", () => {
    const [p] = lerCsv(`tema;pergunta;a;b;correta
nr35;Qual o limite da NR-35?;"Acima de 2,00 m, com risco de queda";Acima de 5 m;A`);
    expect(p!.alternativas[0]).toBe("Acima de 2,00 m, com risco de queda");
  });

  it("o modelo para download é importável", () => {
    const p = lerCsv(MODELO_CSV);
    expect(p).toHaveLength(1);
    expect(p[0]!.correta).toBe(2);
    expect(p[0]!.avisos).toEqual([]);
  });

  it("detectarSeparador ignora separador dentro de aspas", () => {
    expect(detectarSeparador('a;b;"x,y,z"')).toBe(";");
    expect(detectarSeparador("a,b,c")).toBe(",");
  });

  it("quebrarLinha trata aspas duplas escapadas", () => {
    expect(quebrarLinha('a;"diz ""oi""";c', ";")).toEqual(["a", 'diz "oi"', "c"]);
  });
});

describe("5 alternativas, A-E (TIME_07 §7)", () => {
  it("lê as cinco e aceita E como correta", () => {
    const [p] = lerTxt(`Tema: geral
Pergunta: Qual destes NÃO é atribuição da CIPA+A?
A) Identificar riscos
B) Divulgar ações de prevenção
C) Participar da SIPAT
D) Prevenir e combater o assédio
E) Definir o salário dos colaboradores
Correta: E
`);
    expect(p!.alternativas).toHaveLength(5);
    expect(p!.correta).toBe(4);
    expect(p!.avisos).toEqual([]);
  });
});

describe("pergunta sem correta (TIME_07 §7)", () => {
  it("avisa resposta_nao_detectada", () => {
    const [p] = lerTxt(`Tema: geral
Pergunta: Quantos integrantes tem a CIPA de uma empresa?
A) Depende do grau de risco e do número de empregados
B) Sempre cinco
`);
    expect(p!.correta).toBeNull();
    expect(p!.avisos).toContain("resposta_nao_detectada");
  });

  it("distingue correta fora da faixa de correta ausente", () => {
    const [p] = lerTxt(`Tema: geral
Pergunta: Qual destes é um quase-acidente de verdade?
A) Tropeçar sem cair
B) Cair e fraturar o braço
Correta: D
`);
    expect(p!.correta).toBeNull();
    expect(p!.avisos).toContain("correta_fora_da_faixa");
    expect(p!.avisos).not.toContain("resposta_nao_detectada");
  });

  it("avisa tema_ausente quando não há Tema:", () => {
    const [p] = lerTxt(`Pergunta: O capacete é obrigatório em qual situação?
A) Risco de queda de objetos ou impacto na cabeça
B) Nunca
Correta: A
`);
    expect(p!.tema).toBeNull();
    expect(p!.avisos).toContain("tema_ausente");
  });
});

describe("normalização para detectar duplicadas (TIME_07 §7)", () => {
  it("ignora acento, caixa e pontuação", () => {
    expect(normalizar("O que é EPI?")).toBe(normalizar("o que e epi"));
    expect(normalizar("Trabalho  em   ALTURA!!!")).toBe("trabalho em altura");
  });

  it("não funde enunciados diferentes", () => {
    expect(normalizar("O que é EPI?")).not.toBe(normalizar("O que é EPC?"));
  });
});

describe("ida e volta: exportar TXT e importar de novo (TIME_07 §7)", () => {
  const original = `Tema: nr35
Pergunta: A partir de qual altura a NR-35 considera trabalho em altura?
A) Acima de 1,00 m
B) Acima de 2,00 m do nível inferior, com risco de queda
Correta: B
Explicação: Acima de 2,00 m com risco de queda.
Dificuldade: 1

Pergunta: Quem pode trabalhar em altura?
A) Qualquer pessoa
B) Profissional capacitado e autorizado
Correta: B
Dificuldade: 2

Tema: epi
Pergunta: O EPI substitui a proteção coletiva?
A) Sim, sempre
B) Não, a proteção coletiva vem primeiro
Correta: B
Dificuldade: 2
`;

  it("preserva as perguntas na volta", () => {
    const ida = lerTxt(original);
    const volta = lerTxt(escreverTxt(ida));
    expect(volta).toEqual(ida);
  });

  it("preserva a herança de tema ao reescrever", () => {
    const ida = lerTxt(original);
    const volta = lerTxt(escreverTxt(ida));
    expect(volta.map((p) => p.tema)).toEqual(["nr35", "nr35", "epi"]);
  });
});

describe("indiceDaCorreta", () => {
  it("aceita letra, (letra) e número", () => {
    expect(indiceDaCorreta("A", 4)).toBe(0);
    expect(indiceDaCorreta("(c)", 4)).toBe(2);
    expect(indiceDaCorreta("3", 4)).toBe(2);
  });

  it("recusa fora da faixa e lixo", () => {
    expect(indiceDaCorreta("E", 4)).toBeNull();
    expect(indiceDaCorreta("9", 4)).toBeNull();
    expect(indiceDaCorreta("sei lá", 4)).toBeNull();
    expect(indiceDaCorreta("", 4)).toBeNull();
    expect(indiceDaCorreta(null, 4)).toBeNull();
  });
});

describe("o banco de perguntas do docs/TIME_12 importa inteiro", () => {
  it("lê as 36 perguntas sem aviso nenhum", async () => {
    const { readFileSync } = await import("node:fs");
    const doc = readFileSync("docs/TIME_12_BANCO_DE_PERGUNTAS.md", "utf8");
    // O banco vem num único bloco ``` no documento.
    const bloco = /```\n([\s\S]*?)\n```/.exec(doc)?.[1];
    expect(bloco, "bloco de perguntas não encontrado no TIME_12").toBeTruthy();

    const perguntas = lerTxt(bloco!);
    expect(perguntas).toHaveLength(36);

    const comAviso = perguntas.filter((p) => p.avisos.length > 0);
    expect(comAviso.map((p) => `${p.enunciado.slice(0, 40)}: ${p.avisos.join()}`)).toEqual([]);

    // 6 temas × 6 perguntas (docs/TIME_12 cabeçalho)
    const porTema = new Map<string, number>();
    for (const p of perguntas) porTema.set(p.tema!, (porTema.get(p.tema!) ?? 0) + 1);
    expect([...porTema.values()]).toEqual([6, 6, 6, 6, 6, 6]);
  });
});
