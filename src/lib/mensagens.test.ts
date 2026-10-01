import { describe, expect, it } from "vitest";
import { MENSAGENS, MENSAGEM_PADRAO, PENDENCIAS, ehPendencia, mensagem } from "./mensagens";

/** Os 19 `motivo` da tabela de docs/TIME_05 §9, na ordem do documento. */
const MOTIVOS_DO_TIME_05 = [
  "credenciais_invalidas",
  "bloqueado",
  "pin_atual_incorreto",
  "pin_fraco",
  "sem_campanha",
  "pergunta_invalida",
  "ja_respondida",
  "licao_invalida",
  "conteudo_nao_concluido",
  "limite_tentativas",
  "evento_invalido",
  "fora_do_horario",
  "outro_setor",
  "codigo_expirado",
  "ja_fez_checkin",
  "descricao_curta",
  "limite_diario",
  "local_invalido",
  "ranking_oculto",
];

describe("cobertura da tabela de docs/TIME_05 §9", () => {
  it("traduz todos os 19 motivos do documento", () => {
    const faltando = MOTIVOS_DO_TIME_05.filter((m) => !(m in MENSAGENS));
    expect(faltando).toEqual([]);
  });

  it("inclui também os erros de exceção de docs/TIME_02 §3", () => {
    expect(MENSAGENS["sessao_invalida"]).toBeTruthy();
    expect(MENSAGENS["acesso_negado"]).toBe("Você não tem permissão para esta ação.");
  });
});

describe("mensagem()", () => {
  it("devolve o texto exato do documento", () => {
    expect(mensagem("credenciais_invalidas")).toBe("Matrícula ou PIN incorretos.");
    expect(mensagem("ja_fez_checkin")).toBe("Presença já confirmada! ✅");
  });

  it("nunca devolve o código cru para a tela", () => {
    for (const motivo of Object.keys(MENSAGENS)) {
      expect(mensagem(motivo)).not.toBe(motivo);
      expect(mensagem(motivo).length).toBeGreaterThan(0);
    }
  });

  it("cai no padrão para motivo desconhecido, nulo ou vazio", () => {
    expect(mensagem("motivo_que_nao_existe")).toBe(MENSAGEM_PADRAO);
    expect(mensagem(null)).toBe(MENSAGEM_PADRAO);
    expect(mensagem(undefined)).toBe(MENSAGEM_PADRAO);
    expect(mensagem("")).toBe(MENSAGEM_PADRAO);
  });

  it("não expõe nome de chave do banco nem termo em inglês nas mensagens", () => {
    for (const texto of Object.values(MENSAGENS)) {
      expect(texto).not.toMatch(/_/); // nada de snake_case vazando
      expect(texto).not.toMatch(/\b(error|invalid|failed|token|login)\b/i);
    }
  });
});

describe("pendências de login (docs/TIME_03 §3)", () => {
  it("reconhece só as duas pendências que desviam de tela", () => {
    expect(ehPendencia("trocar_pin")).toBe(true);
    expect(ehPendencia("aceitar_lgpd")).toBe(true);
    expect(ehPendencia("credenciais_invalidas")).toBe(false);
    expect(ehPendencia(null)).toBe(false);
  });

  it("mapeia cada pendência para a rota do documento", () => {
    expect(PENDENCIAS.trocar_pin).toBe("/app/novo-pin");
    expect(PENDENCIAS.aceitar_lgpd).toBe("/app/termo");
  });
});

describe("cobertura dos motivos que o banco realmente devolve", () => {
  /**
   * Levantado de supabase/migrations/ com
   * `grep -ohE "'motivo', *'[a-z_]+'" supabase/migrations/*.sql`.
   * Se uma migration nova introduzir um motivo, este teste reprova até o texto
   * existir — é o que impede o código cru de aparecer na tela.
   */
  const MOTIVOS_DO_BANCO = [
    "alternativa_invalida",
    "bloqueado",
    "campanha_invalida",
    "campanha_sem_temas",
    "categoria_invalida",
    "certificado_nao_encontrado",
    "codigo_expirado",
    "conteudo_nao_concluido",
    "credenciais_invalidas",
    "decisao_invalida",
    "denuncia_encerrada",
    "denuncia_invalida",
    "descricao_curta",
    "empresa_nao_encontrada",
    "evento_invalido",
    "evento_ja_tem_sessao",
    "fora_do_horario",
    "gravidade_obrigatoria",
    "ja_decidido",
    "ja_existe_campanha_ativa",
    "ja_fez_checkin",
    "ja_respondida",
    "licao_invalida",
    "limite_diario",
    "limite_tentativas",
    "local_invalido",
    "modo_invalido",
    "outro_setor",
    "pergunta_invalida",
    "pin_atual_incorreto",
    "pin_fraco",
    "protocolo_ou_senha_invalidos",
    "ranking_oculto",
    "relato_invalido",
    "sem_avaliacao",
    "sem_campanha",
    "status_invalido",
    "valide_primeiro",
  ];

  it("traduz todos os 38 motivos das migrations", () => {
    expect(MOTIVOS_DO_BANCO).toHaveLength(38);
    const faltando = MOTIVOS_DO_BANCO.filter((m) => !(m in MENSAGENS));
    expect(faltando).toEqual([]);
  });

  it("traduz as 3 exceções que as RPCs levantam", () => {
    for (const e of ["acesso_negado", "sessao_invalida", "upload_nao_permitido"]) {
      expect(MENSAGENS[e]).toBeTruthy();
    }
  });
});
