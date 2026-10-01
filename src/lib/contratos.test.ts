import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

/**
 * Guarda de contrato entre as telas e as RPCs.
 *
 * Por que existe: a primeira versão de `/app/inicio` assumiu que
 * `colaborador_resumo` devolvia `quiz_do_dia` e `posicao.geral`. O nome real é
 * `quiz_hoje` e `posicao_individual`. A tela compilava, o teste de fluxo passava
 * (só exercitava o quiz) e a home simplesmente não mostrava nada.
 *
 * Este teste lê o `jsonb_build_object` de cada RPC no SQL e confere que as
 * chaves de primeiro nível são exatamente as que as telas esperam.
 */

const SQL = readdirSync("supabase/migrations")
  .filter((n) => n.endsWith(".sql"))
  .map((n) => readFileSync(`supabase/migrations/${n}`, "utf8"))
  .join("\n");

/**
 * Corpo de uma função, do `create ... function nome` até o fechamento do `$$`.
 *
 * Não dá para procurar só por `end $$;`: função `language sql` fecha com `$$;`
 * sem `end`, e usar `end $$;` como limite invadia a função seguinte — foi assim
 * que este teste primeiro acusou `empresa_publica` de não devolver `codigo`.
 */
function corpoDaFuncao(nome: string): string {
  const inicio = SQL.indexOf(`function public.${nome}(`);
  expect(inicio, `função ${nome} não encontrada no SQL`).toBeGreaterThan(-1);

  // O primeiro `$$` abre o corpo; o próximo `$$` depois dele fecha.
  const abre = SQL.indexOf("$$", inicio);
  const fecha = SQL.indexOf("$$", abre + 2);
  expect(fecha, `não achei o fim do corpo de ${nome}`).toBeGreaterThan(-1);
  return SQL.slice(abre, fecha);
}

/**
 * Chaves do `jsonb_build_object` do RETURN de sucesso. Pega o último `return
 * jsonb_build_object(...)` do corpo, que é o caminho feliz — os anteriores são
 * as saídas por `motivo`.
 */
function chavesDoRetorno(nome: string): string[] {
  const corpo = corpoDaFuncao(nome);

  // Função plpgsql usa `return jsonb_build_object(...)`; função `language sql`
  // só tem o `select jsonb_build_object(...)`. O caminho felizes é o primeiro
  // `jsonb_build_object` nas de SQL e o último nas de plpgsql — nestas, os
  // anteriores são as saídas por `motivo`.
  const comReturn = corpo.lastIndexOf("return jsonb_build_object(");
  const inicio = comReturn > -1 ? comReturn : corpo.indexOf("jsonb_build_object(");
  expect(inicio, `${nome} não monta jsonb_build_object`).toBeGreaterThan(-1);

  const trecho = corpo.slice(inicio);
  // Chave de primeiro nível: `'nome',` logo após `(` ou `,` — ignorando o que
  // está dentro de objetos aninhados é impossível por regex, então o teste
  // confere que as esperadas ESTÃO presentes, não que a lista é idêntica.
  return [...trecho.matchAll(/'([a-z_]+)'\s*,/g)].map((m) => m[1]!);
}

describe("colaborador_resumo (usada por /app/inicio)", () => {
  const chaves = chavesDoRetorno("colaborador_resumo");

  it("tem as chaves de primeiro nível que a tela lê", () => {
    for (const esperada of [
      "ok",
      "nome",
      "setor",
      "pendencia",
      "campanha",
      "pontos",
      "streak",
      "posicao_individual",
      "posicao_setor",
      "quiz_hoje",
      "licoes",
      "relatos",
    ]) {
      expect(chaves, `falta a chave ${esperada}`).toContain(esperada);
    }
  });

  it("NÃO tem os nomes que a primeira versão da tela inventou", () => {
    expect(chaves).not.toContain("quiz_do_dia");
    expect(chaves).not.toContain("posicao");
  });

  it("os pilares de pontos vêm do `filter (where pilar = ...)`", () => {
    const corpo = corpoDaFuncao("colaborador_resumo");
    for (const pilar of ["conhecimento", "relatos", "engajamento"]) {
      expect(corpo).toContain(`where pilar = '${pilar}'`);
    }
    expect(corpo).toMatch(/as total/);
    expect(corpo).toMatch(/as hoje/);
  });

  it("campanha traz dias_restantes e ranking_visivel", () => {
    expect(chaves).toContain("dias_restantes");
    expect(chaves).toContain("ranking_visivel");
  });
});

describe("colaborador_perguntas_do_dia (usada por /app/quiz)", () => {
  const corpo = corpoDaFuncao("colaborador_perguntas_do_dia");
  const chaves = chavesDoRetorno("colaborador_perguntas_do_dia");

  it("devolve perguntas e pontos_por_acerto", () => {
    for (const esperada of ["ok", "dia", "perguntas", "pontos_por_acerto"]) {
      expect(chaves).toContain(esperada);
    }
  });

  it("cada pergunta traz os campos que a tela usa", () => {
    for (const campo of [
      "enunciado",
      "alternativas",
      "tema",
      "tema_icone",
      "respondida",
      "acertou",
      "alternativa_escolhida",
    ]) {
      expect(corpo).toContain(`'${campo}'`);
    }
  });

  it("o gabarito é condicional — só para pergunta já respondida", () => {
    // `'correta', case when r.id is not null then q.correta end`
    expect(corpo).toMatch(/'correta',\s*case\s+when\s+r\.id\s+is\s+not\s+null/);
    expect(corpo).toMatch(/'explicacao',\s*case\s+when\s+r\.id\s+is\s+not\s+null/);
  });
});

describe("colaborador_responder_pergunta (usada por /app/quiz)", () => {
  const chaves = chavesDoRetorno("colaborador_responder_pergunta");

  it("devolve acerto, gabarito, pontos e selos", () => {
    for (const esperada of [
      "ok",
      "acertou",
      "correta",
      "explicacao",
      "pontos",
      "atividade",
      "novos_selos",
    ]) {
      expect(chaves).toContain(esperada);
    }
  });
});

describe("colaborador_trilha (usada por /app/trilha)", () => {
  const corpo = corpoDaFuncao("colaborador_trilha");

  it("cada lição traz o que a lista mostra", () => {
    for (const campo of [
      "titulo",
      "tema",
      "tema_icone",
      "carga_minutos",
      "obrigatoria",
      "nota_minima",
      "conteudo_concluido",
      "melhor_nota",
      "aprovado",
    ]) {
      expect(corpo).toContain(`'${campo}'`);
    }
  });

  it("só lista lição publicada", () => {
    expect(corpo).toMatch(/l\.publicada/);
  });
});

describe("colaborador_licao (usada por /app/trilha/$licaoId)", () => {
  const corpo = corpoDaFuncao("colaborador_licao");
  const chaves = chavesDoRetorno("colaborador_licao");

  it("devolve licao, progresso e avaliacao", () => {
    for (const esperada of ["ok", "licao", "progresso", "avaliacao"]) {
      expect(chaves).toContain(esperada);
    }
  });

  it("a lição traz conteudo_md e video_url", () => {
    expect(corpo).toContain("'conteudo_md'");
    expect(corpo).toContain("'video_url'");
  });

  it("o progresso traz tentativas_hoje, para a tela travar na terceira", () => {
    expect(chaves).toContain("tentativas_hoje");
    expect(chaves).toContain("conteudo_concluido");
  });

  it("a avaliação NÃO traz gabarito, e só vem depois de concluir o conteúdo", () => {
    // O jsonb_agg das perguntas da avaliação só tem id, enunciado e alternativas.
    expect(corpo).toMatch(
      /jsonb_build_object\('id',\s*p\.id,\s*'enunciado',\s*p\.enunciado,\s*'alternativas',\s*p\.alternativas\)/,
    );
    expect(corpo).toMatch(/if pl\.conteudo_concluido_em is not null then/);
  });
});

describe("colaborador_enviar_avaliacao (usada por /app/trilha/$licaoId)", () => {
  const corpo = corpoDaFuncao("colaborador_enviar_avaliacao");
  const chaves = chavesDoRetorno("colaborador_enviar_avaliacao");

  it("devolve nota, aprovado, pontos e gabarito", () => {
    for (const esperada of ["ok", "nota", "aprovado", "pontos", "gabarito", "novos_selos"]) {
      expect(chaves).toContain(esperada);
    }
  });

  it("espera as respostas como array de {pergunta_id, alternativa}", () => {
    expect(corpo).toMatch(/e ->> 'alternativa'/);
    expect(corpo).toMatch(/e ->> 'pergunta_id'/);
    expect(corpo).toMatch(/jsonb_array_elements\(coalesce\(p_respostas/);
  });

  it("o gabarito volta com escolhida, acertou e explicacao", () => {
    for (const campo of ["escolhida", "acertou", "explicacao"]) {
      expect(corpo).toContain(`'${campo}'`);
    }
  });
});

describe("empresa_publica (usada por /app/entrar)", () => {
  const chaves = chavesDoRetorno("empresa_publica");

  it("devolve nome, codigo e logo", () => {
    for (const esperada of ["ok", "nome", "codigo", "logo_url"]) {
      expect(chaves).toContain(esperada);
    }
  });
});

describe("colaborador_login (usada por /app/entrar)", () => {
  const chaves = chavesDoRetorno("colaborador_login");

  it("devolve token e pendencia", () => {
    expect(chaves).toContain("token");
    expect(chaves).toContain("pendencia");
  });
});
