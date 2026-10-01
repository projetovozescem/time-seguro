import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import {
  AVISO_ANONIMATO,
  CANAIS_OFICIAIS,
  CATEGORIAS_DENUNCIA,
  MINIMO_DESCRICAO_DENUNCIA,
  NOTA_TECNICA,
  STATUS_DENUNCIA,
  STATUS_DO_COMITE,
  descricaoDenunciaValida,
  rotuloDaCategoriaDenuncia,
  rotuloDoStatusDenuncia,
} from "./respeito";

const SQL = readdirSync("supabase/migrations")
  .filter((n) => n.endsWith(".sql"))
  .map((n) => readFileSync(`supabase/migrations/${n}`, "utf8"))
  .join("\n");

const FONTE_PAGINA = readFileSync("src/routes/respeito.$codigo.tsx", "utf8");

/**
 * Código da página SEM comentários.
 *
 * Precisa ser sem: os comentários do arquivo explicam justamente o que a tela
 * não faz ("não usa rpcApp", "não grava localStorage"), e a primeira versão
 * destes testes reprovou por causa da própria documentação. O teste é sobre o
 * código executado, não sobre a prosa.
 */
const PAGINA_PUBLICA = FONTE_PAGINA.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * Estes são os testes mais importantes do projeto depois dos de RLS: eles travam
 * no código as garantias de anonimato do Canal de Respeito (docs/TIME_03 §6).
 * Um `rpcApp` no lugar de `rpcPublica` ligaria a denúncia a uma pessoa.
 */
describe("a página pública não pode identificar quem denuncia", () => {
  it("NÃO usa rpcApp — só rpcPublica, que nunca envia p_token", () => {
    expect(PAGINA_PUBLICA).not.toMatch(/\brpcApp\b/);
    expect(PAGINA_PUBLICA).toMatch(/\brpcPublica\b/);
  });

  it("não menciona p_token em lugar nenhum", () => {
    expect(PAGINA_PUBLICA).not.toContain("p_token");
  });

  it("não lê nem grava armazenamento do navegador", () => {
    expect(PAGINA_PUBLICA).not.toContain("localStorage");
    expect(PAGINA_PUBLICA).not.toContain("sessionStorage");
    expect(PAGINA_PUBLICA).not.toMatch(/\bsessao\b/);
  });

  it("não usa o layout do app, que carrega a sessão", () => {
    expect(PAGINA_PUBLICA).not.toContain("AlunoLayout");
    expect(PAGINA_PUBLICA).not.toContain("NavegacaoApp");
  });

  it("não registra acesso nem analytics", () => {
    expect(PAGINA_PUBLICA).not.toContain("registrar_acesso");
    expect(PAGINA_PUBLICA).not.toMatch(/analytics|gtag|dataLayer/i);
  });

  it("mostra o aviso de anonimato e a nota técnica honesta", () => {
    expect(FONTE_PAGINA).toContain("AVISO_ANONIMATO");
    expect(FONTE_PAGINA).toContain("NOTA_TECNICA");
    expect(AVISO_ANONIMATO).toContain("não registra quem você é");
    expect(NOTA_TECNICA).toContain("registros técnicos de acesso");
  });

  it("mostra os três canais oficiais (docs/TIME_01 §10)", () => {
    expect(CANAIS_OFICIAIS.map((c) => c.numero)).toEqual(["180", "100", "190"]);
    expect(FONTE_PAGINA).toContain("CANAIS_OFICIAIS");
  });

  it("avisa que o protocolo e a senha aparecem uma única vez", () => {
    expect(FONTE_PAGINA).toContain("Anote. Sem eles não é possível acompanhar");
  });
});

describe("o banco não guarda o que identificaria a pessoa", () => {
  it("denuncias_assedio não tem colaborador_id, ip nem dispositivo", () => {
    const inicio = SQL.indexOf("create table public.denuncias_assedio");
    expect(inicio).toBeGreaterThan(-1);
    const corpo = SQL.slice(inicio, SQL.indexOf(");", inicio));

    for (const proibida of ["colaborador_id", "ip", "dispositivo_id", "user_agent"]) {
      expect(corpo).not.toMatch(new RegExp(`\\b${proibida}\\b`));
    }
  });

  it("recebida_em é date, não timestamp — sem hora", () => {
    const inicio = SQL.indexOf("create table public.denuncias_assedio");
    const corpo = SQL.slice(inicio, SQL.indexOf(");", inicio));
    expect(corpo).toMatch(/recebida_em\s+date/);
    expect(corpo).not.toMatch(/recebida_em\s+timestamp/);
  });

  it("a senha da denúncia é guardada como hash", () => {
    const inicio = SQL.indexOf("create table public.denuncias_assedio");
    const corpo = SQL.slice(inicio, SQL.indexOf(");", inicio));
    expect(corpo).toContain("senha_hash");
  });

  it("denúncia NUNCA pontua: nenhum _lancar_pontos na RPC de registro", () => {
    const inicio = SQL.indexOf("function public.registrar_denuncia_assedio(");
    const corpo = SQL.slice(inicio, SQL.indexOf("end $$;", inicio));
    expect(corpo).not.toContain("_lancar_pontos");
  });

  it("nem na resposta do denunciante, nem na do comitê", () => {
    for (const fn of ["responder_denuncia_denunciante(", "comite_responder_denuncia("]) {
      const inicio = SQL.indexOf(`function public.${fn}`);
      const corpo = SQL.slice(inicio, SQL.indexOf("end $$;", inicio));
      expect(corpo, `${fn} não pode lançar pontos`).not.toContain("_lancar_pontos");
    }
  });

  it("só quem tem comite_assedio lê as denúncias", () => {
    expect(SQL).toMatch(/create policy denuncias_comite[\s\S]{0,200}sou_comite_assedio\(\)/);
    expect(SQL).toMatch(/create policy mensagens_comite[\s\S]{0,200}sou_comite_assedio\(\)/);
  });
});

describe("categorias e status batem com o schema", () => {
  it("as quatro categorias são as do CHECK", () => {
    const inicio = SQL.indexOf("create table public.denuncias_assedio");
    const corpo = SQL.slice(inicio, SQL.indexOf(");", inicio));
    const achado = /categoria\s+text[^,]*?check\s*\(\s*categoria\s+in\s*\(([^)]+)\)/.exec(corpo);
    expect(achado).toBeTruthy();
    const noBanco = [...achado![1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);
    expect([...CATEGORIAS_DENUNCIA.map((c) => c.categoria)].sort()).toEqual([...noBanco].sort());
  });

  it("todo status do schema tem rótulo", () => {
    const inicio = SQL.indexOf("create table public.denuncias_assedio");
    const corpo = SQL.slice(inicio, SQL.indexOf(");", inicio));
    const achado = /status\s+text[^,]*?check\s*\(\s*status\s+in\s*\(([^)]+)\)/.exec(corpo);
    expect(achado).toBeTruthy();
    const noBanco = [...achado![1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);
    for (const s of noBanco) expect(STATUS_DENUNCIA[s as never]).toBeTruthy();
    expect([...STATUS_DO_COMITE].sort()).toEqual([...noBanco].sort());
  });

  it("nenhum rótulo expõe snake_case", () => {
    for (const { rotulo } of Object.values(STATUS_DENUNCIA)) {
      expect(rotulo).not.toMatch(/_/);
    }
    expect(rotuloDoStatusDenuncia("em_apuracao")).toBe("Em apuração");
    expect(rotuloDaCategoriaDenuncia("discriminacao")).toBe("Discriminação");
  });

  it("categoria desconhecida cai em Outra situação", () => {
    expect(rotuloDaCategoriaDenuncia("inventada")).toBe("Outra situação");
  });
});

describe("descricaoDenunciaValida", () => {
  it("usa o mínimo de 20 que o banco exige", () => {
    expect(MINIMO_DESCRICAO_DENUNCIA).toBe(20);
    const inicio = SQL.indexOf("function public.registrar_denuncia_assedio(");
    const corpo = SQL.slice(inicio, SQL.indexOf("end $$;", inicio));
    expect(corpo).toMatch(/char_length\(coalesce\(trim\(p_descricao\), ''\)\)\s*<\s*20/);
  });

  it("recusa curta e aceita a partir de 20", () => {
    expect(descricaoDenunciaValida("curto")).toBe(false);
    expect(descricaoDenunciaValida("x".repeat(19))).toBe(false);
    expect(descricaoDenunciaValida("x".repeat(20))).toBe(true);
  });
});
