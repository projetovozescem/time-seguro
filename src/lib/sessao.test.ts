import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sessao } from "./sessao";

/** localStorage de mentira, para o teste rodar no ambiente `node` do vitest. */
function montarStorage(): Storage {
  const dados = new Map<string, string>();
  return {
    get length() {
      return dados.size;
    },
    clear: () => dados.clear(),
    getItem: (k: string) => dados.get(k) ?? null,
    key: (i: number) => [...dados.keys()][i] ?? null,
    removeItem: (k: string) => void dados.delete(k),
    setItem: (k: string, v: string) => void dados.set(k, v),
  };
}

function definirWindow(storage: Storage | (() => never)) {
  vi.stubGlobal("window", { localStorage: storage });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sessão do colaborador", () => {
  beforeEach(() => definirWindow(montarStorage()));

  it("começa sem token e sem empresa", () => {
    expect(sessao.token()).toBeNull();
    expect(sessao.empresa()).toBeNull();
  });

  it("guarda e devolve o token", () => {
    sessao.salvar("tok-123");
    expect(sessao.token()).toBe("tok-123");
  });

  it("sair apaga o token mas preserva a empresa lembrada", () => {
    sessao.salvar("tok-123");
    sessao.lembrarEmpresa("ACME");
    sessao.sair();
    expect(sessao.token()).toBeNull();
    expect(sessao.empresa()).toBe("ACME");
  });

  it("esquecer empresa apaga só a empresa", () => {
    sessao.salvar("tok-123");
    sessao.lembrarEmpresa("ACME");
    sessao.esquecerEmpresa();
    expect(sessao.empresa()).toBeNull();
    expect(sessao.token()).toBe("tok-123");
  });

  it("usa chaves distintas para token e empresa", () => {
    const storage = montarStorage();
    definirWindow(storage);
    sessao.salvar("tok-123");
    sessao.lembrarEmpresa("ACME");
    expect(storage.getItem("time_token")).toBe("tok-123");
    expect(storage.getItem("time_empresa")).toBe("ACME");
  });
});

describe("ambientes sem storage", () => {
  it("no servidor (sem window) devolve null em vez de quebrar", () => {
    vi.stubGlobal("window", undefined);
    expect(sessao.token()).toBeNull();
    expect(() => sessao.salvar("x")).not.toThrow();
    expect(() => sessao.sair()).not.toThrow();
  });

  it("com storage bloqueado (janela privada) devolve null em vez de quebrar", () => {
    const explodir = () => {
      throw new DOMException("bloqueado", "SecurityError");
    };
    vi.stubGlobal("window", {
      localStorage: { getItem: explodir, setItem: explodir, removeItem: explodir },
    });
    expect(sessao.token()).toBeNull();
    expect(() => sessao.salvar("x")).not.toThrow();
    expect(() => sessao.sair()).not.toThrow();
  });
});
