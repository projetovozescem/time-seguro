import { describe, expect, it } from "vitest";
import {
  BLOQUEANTES,
  TEXTO_DO_AVISO,
  ehBloqueante,
  emBlocos,
  paraSalvar,
  prepararRevisao,
  resolverTema,
  resumir,
  temPendencia,
  type TemaConhecido,
} from "./validacao";
import type { PerguntaImportada } from "./tipos";

const TEMAS: TemaConhecido[] = [
  { id: "t-nr35", slug: "nr35", nome: "NR-35 · Trabalho em altura" },
  { id: "t-epi", slug: "epi", nome: "EPI · Equipamento de proteção" },
  { id: "t-assedio", slug: "assedio", nome: "Respeito e prevenção ao assédio" },
];

/** `semExplicacao` omite a chave, em vez de passar undefined: o projeto usa
 * exactOptionalPropertyTypes. */
function pergunta(
  parcial: Partial<PerguntaImportada> = {},
  semExplicacao = false,
): PerguntaImportada {
  return {
    enunciado: "A partir de qual altura vale a NR-35?",
    alternativas: ["Acima de 1 m", "Acima de 2 m com risco de queda"],
    correta: 1,
    tema: "nr35",
    explicacao: "Acima de 2,00 m do nível inferior.",
    dificuldade: 1,
    avisos: [],
    ...parcial,
  };
}

function semExplicacao(parcial: Partial<PerguntaImportada> = {}): PerguntaImportada {
  const p = pergunta(parcial);
  delete p.explicacao;
  return p;
}

describe("resolverTema", () => {
  it("acha por slug", () => {
    expect(resolverTema("nr35", TEMAS)?.id).toBe("t-nr35");
  });

  it("acha por nome, ignorando acento e caixa", () => {
    expect(resolverTema("EPI · Equipamento de Protecao", TEMAS)?.id).toBe("t-epi");
  });

  it("acha por começo do nome", () => {
    expect(resolverTema("NR-35", TEMAS)?.id).toBe("t-nr35");
  });

  it("devolve null para tema desconhecido ou vazio", () => {
    expect(resolverTema("nr99", TEMAS)).toBeNull();
    expect(resolverTema(null, TEMAS)).toBeNull();
  });
});

describe("avisos bloqueantes (docs/TIME_07 §6)", () => {
  it("bloqueia o que o documento marca com 🔴", () => {
    for (const a of ["resposta_nao_detectada", "poucas_alternativas", "tema_ausente"] as const) {
      expect(ehBloqueante(a)).toBe(true);
    }
  });

  it("não bloqueia os de atenção 🟡", () => {
    for (const a of ["duplicada_no_banco", "enunciado_curto", "muitas_alternativas"] as const) {
      expect(ehBloqueante(a)).toBe(false);
    }
  });

  it("todo aviso tem texto para a tela", () => {
    const semTexto = Object.keys(TEXTO_DO_AVISO).filter((k) => !TEXTO_DO_AVISO[k as never]);
    expect(semTexto).toEqual([]);
    for (const a of BLOQUEANTES) expect(TEXTO_DO_AVISO[a]).toBeTruthy();
  });

  it("temPendencia só olha os bloqueantes", () => {
    expect(temPendencia(pergunta({ avisos: ["duplicada_no_banco"] }))).toBe(false);
    expect(temPendencia(pergunta({ avisos: ["tema_ausente"] }))).toBe(true);
  });
});

describe("prepararRevisao", () => {
  it("resolve o tema_id a partir do tema lido", () => {
    const [item] = prepararRevisao([pergunta()], TEMAS);
    expect(item!.tema_id).toBe("t-nr35");
    expect(item!.avisos).toEqual([]);
  });

  it("marca tema_desconhecido quando o arquivo traz tema que não existe", () => {
    const [item] = prepararRevisao([pergunta({ tema: "nr99" })], TEMAS);
    expect(item!.tema_id).toBeNull();
    expect(item!.avisos).toContain("tema_desconhecido");
    expect(temPendencia(item!)).toBe(true);
  });

  it("mantém só a primeira das duplicadas do lote", () => {
    const itens = prepararRevisao(
      [
        pergunta({ explicacao: "primeira" }),
        pergunta({ enunciado: "A PARTIR de qual altura vale a NR-35?!", explicacao: "segunda" }),
        pergunta({ enunciado: "Outra pergunta completamente diferente aqui" }),
      ],
      TEMAS,
    );
    expect(itens).toHaveLength(2);
    expect(itens[0]!.explicacao).toBe("primeira");
  });

  it("desmarca o que já existe no banco, sem descartar", () => {
    const itens = prepararRevisao([pergunta()], TEMAS, ["a partir de qual altura vale a nr 35"]);
    expect(itens).toHaveLength(1);
    expect(itens[0]!.selecionada).toBe(false);
    expect(itens[0]!.avisos).toContain("duplicada_no_banco");
  });

  it("deixa marcada a pergunta com pendência, para o técnico corrigir", () => {
    const [item] = prepararRevisao(
      [pergunta({ correta: null, avisos: ["resposta_nao_detectada"] })],
      TEMAS,
    );
    expect(item!.selecionada).toBe(true);
    expect(temPendencia(item!)).toBe(true);
  });

  it("dá chave distinta para cada item", () => {
    const itens = prepararRevisao(
      [pergunta(), pergunta({ enunciado: "Quando usar o cinto de segurança na altura?" })],
      TEMAS,
    );
    expect(new Set(itens.map((i) => i.chave)).size).toBe(2);
  });
});

describe("resumir", () => {
  it("conta e libera o salvar quando nada selecionado tem pendência", () => {
    const itens = prepararRevisao(
      [pergunta(), pergunta({ enunciado: "Outra bem diferente aqui" })],
      TEMAS,
    );
    const r = resumir(itens);
    expect(r.total).toBe(2);
    expect(r.selecionadas).toBe(2);
    expect(r.comPendencia).toBe(0);
    expect(r.podeSalvar).toBe(true);
  });

  it("trava o salvar quando há pendência selecionada", () => {
    const itens = prepararRevisao([pergunta({ tema: null, avisos: ["tema_ausente"] })], TEMAS);
    expect(resumir(itens).podeSalvar).toBe(false);
  });

  it("libera o salvar se a pendência for desmarcada", () => {
    const itens = prepararRevisao(
      [
        pergunta(),
        pergunta({ enunciado: "Sem tema nenhum aqui nesta", tema: null, avisos: ["tema_ausente"] }),
      ],
      TEMAS,
    );
    expect(resumir(itens).podeSalvar).toBe(false);
    itens[1]!.selecionada = false;
    expect(resumir(itens).podeSalvar).toBe(true);
  });

  it("não libera o salvar com nada selecionado", () => {
    const itens = prepararRevisao([pergunta()], TEMAS);
    itens[0]!.selecionada = false;
    expect(resumir(itens).podeSalvar).toBe(false);
  });

  it("conta quantas selecionadas estão sem explicação", () => {
    const itens = prepararRevisao(
      [semExplicacao(), pergunta({ enunciado: "Outra diferente aqui agora" })],
      TEMAS,
    );
    expect(resumir(itens).semExplicacao).toBe(1);
  });
});

describe("paraSalvar", () => {
  it("monta a linha do banco com origem importacao", () => {
    const itens = prepararRevisao([pergunta()], TEMAS);
    const [linha] = paraSalvar(itens, "e-1");
    expect(linha).toEqual({
      empresa_id: "e-1",
      tema_id: "t-nr35",
      enunciado: "A partir de qual altura vale a NR-35?",
      alternativas: ["Acima de 1 m", "Acima de 2 m com risco de queda"],
      correta: 1,
      explicacao: "Acima de 2,00 m do nível inferior.",
      dificuldade: 1,
      origem: "importacao",
    });
  });

  it("não salva desmarcada nem com pendência — última barreira antes do insert", () => {
    const itens = prepararRevisao(
      [
        pergunta(),
        pergunta({ enunciado: "Desmarcada mas valida aqui agora" }),
        pergunta({ enunciado: "Com pendencia de tema aqui", tema: null, avisos: ["tema_ausente"] }),
      ],
      TEMAS,
    );
    itens[1]!.selecionada = false;
    expect(paraSalvar(itens, "e-1")).toHaveLength(1);
  });

  it("explicação vazia vira null, não string vazia", () => {
    const itens = prepararRevisao([pergunta({ explicacao: "   " })], TEMAS);
    expect(paraSalvar(itens, "e-1")[0]!.explicacao).toBeNull();
  });
});

describe("emBlocos", () => {
  it("quebra de 100 em 100 por padrão", () => {
    const blocos = emBlocos(Array.from({ length: 250 }, (_, i) => i));
    expect(blocos.map((b) => b.length)).toEqual([100, 100, 50]);
  });

  it("devolve lista vazia para entrada vazia", () => {
    expect(emBlocos([])).toEqual([]);
  });

  it("recusa tamanho de bloco inválido", () => {
    expect(() => emBlocos([1, 2], 0)).toThrow();
  });
});
