import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import {
  dominiosDaConfig,
  emailNoDominio,
  emailValido,
  mensagemDeAcesso,
  normalizarDominios,
} from "./cadastro";

describe("emailValido", () => {
  it("aceita e-mail comum", () => {
    expect(emailValido("maria.silva@empresa.com.br")).toBe(true);
  });

  it("recusa o que não tem @, ponto no domínio ou tem espaço", () => {
    for (const ruim of [
      "",
      "maria",
      "maria@empresa",
      "@empresa.com",
      "ma ria@empresa.com",
      "a@b@c.com",
    ]) {
      expect(emailValido(ruim)).toBe(false);
    }
  });

  it("ignora espaço nas pontas", () => {
    expect(emailValido("  maria@empresa.com  ")).toBe(true);
  });

  it("recusa e-mail absurdamente longo, como o servidor", () => {
    expect(emailValido("a".repeat(200) + "@empresa.com")).toBe(false);
  });
});

describe("normalizarDominios", () => {
  it("separa por vírgula, espaço, ponto e vírgula e linha nova", () => {
    const r = normalizarDominios("a.com.br, b.com;c.org\nd.net e.io");
    expect(r.dominios).toEqual(["a.com.br", "b.com", "c.org", "d.net", "e.io"]);
    expect(r.invalidos).toEqual([]);
  });

  it("aceita @ na frente e maiúsculas", () => {
    expect(normalizarDominios("@Empresa.COM.br").dominios).toEqual(["empresa.com.br"]);
  });

  it("não repete domínio", () => {
    expect(normalizarDominios("a.com, A.com, @a.com").dominios).toEqual(["a.com"]);
  });

  it("devolve à parte o que não é domínio, sem gravar lixo", () => {
    const r = normalizarDominios("empresa.com, https://x.com, sem-ponto, a b");
    expect(r.dominios).toEqual(["empresa.com"]);
    expect(r.invalidos).toEqual(["https://x.com", "sem-ponto", "a", "b"]);
  });

  it("texto vazio não gera nada", () => {
    expect(normalizarDominios("  \n ")).toEqual({ dominios: [], invalidos: [] });
  });
});

describe("emailNoDominio", () => {
  it("sem domínio configurado, qualquer e-mail passa", () => {
    expect(emailNoDominio("a@qualquer.com", [])).toBe(true);
  });

  it("com domínio, só o domínio exato passa", () => {
    const d = ["empresa.com.br"];
    expect(emailNoDominio("a@empresa.com.br", d)).toBe(true);
    expect(emailNoDominio("A@EMPRESA.COM.BR", d)).toBe(true);
    expect(emailNoDominio("a@outra.com.br", d)).toBe(false);
  });

  it("subdomínio e domínio parecido NÃO passam", () => {
    const d = ["empresa.com.br"];
    expect(emailNoDominio("a@x.empresa.com.br", d)).toBe(false);
    expect(emailNoDominio("a@empresa.com.br.evil.com", d)).toBe(false);
    expect(emailNoDominio("a@meuempresa.com.br", d)).toBe(false);
  });
});

describe("dominiosDaConfig", () => {
  it("lê a lista de strings", () => {
    expect(dominiosDaConfig({ dominios_email: ["a.com", "b.com"] })).toEqual(["a.com", "b.com"]);
  });

  it("não quebra com config vazia, nula ou de outro formato", () => {
    expect(dominiosDaConfig(null)).toEqual([]);
    expect(dominiosDaConfig({})).toEqual([]);
    expect(dominiosDaConfig({ dominios_email: "a.com" })).toEqual([]);
    expect(dominiosDaConfig({ dominios_email: [1, null, "ok.com", " "] })).toEqual(["ok.com"]);
  });
});

describe("cliente e servidor falam a mesma língua", () => {
  const sql = readdirSync("supabase/migrations")
    .filter((n) => n.endsWith(".sql"))
    .map((n) => readFileSync(`supabase/migrations/${n}`, "utf8"))
    .join("\n");

  it("a chave do config é a que a RPC lê", () => {
    expect(sql).toContain("e.config -> 'dominios_email'");
  });

  it("os motivos que a tela de cadastro trata existem no SQL", () => {
    for (const motivo of [
      "nome_invalido",
      "matricula_invalida",
      "email_invalido",
      "email_fora_do_dominio",
      "muitas_solicitacoes",
      "empresa_nao_encontrada",
    ]) {
      expect(sql).toContain(`'${motivo}'`);
    }
  });
});

describe("mensagemDeAcesso", () => {
  const msg = mensagemDeAcesso({
    nome: "  Maria da Silva ",
    matricula: "1234",
    pin: "482910",
    empresaCodigo: "piloto",
    origem: "https://time.exemplo.com.br",
  });

  it("chama a pessoa pelo primeiro nome", () => {
    expect(msg.startsWith("Olá, Maria!")).toBe(true);
  });

  it("traz o link com o código da empresa, a matrícula e o PIN", () => {
    expect(msg).toContain("https://time.exemplo.com.br/app/entrar?empresa=piloto");
    expect(msg).toContain("Matrícula: 1234");
    expect(msg).toContain("PIN: 482910");
  });

  it("avisa que o PIN é só da pessoa e não muda", () => {
    expect(msg).toMatch(/só seu e não muda/);
  });

  it("nome em branco não quebra", () => {
    expect(() =>
      mensagemDeAcesso({ nome: "", matricula: "1", pin: "111222", empresaCodigo: "x", origem: "" }),
    ).not.toThrow();
  });
});
