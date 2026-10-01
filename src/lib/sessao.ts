/**
 * Sessão do colaborador (docs/TIME_03 §3).
 *
 * O colaborador NÃO é usuário do Supabase Auth: a sessão é um token opaco
 * devolvido por `colaborador_login` e guardado em `localStorage`, enviado como
 * `p_token` em toda RPC. Dura 30 dias; `colaborador_logout` revoga no servidor.
 */
const CHAVE = "time_token";
const CHAVE_EMPRESA = "time_empresa";

/** Leitura tolerante: em janela privada ou com storage bloqueado, devolve null. */
function ler(chave: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function escrever(chave: string, valor: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(chave, valor);
  } catch {
    /* storage bloqueado — a sessão vale só para esta navegação */
  }
}

function apagar(chave: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(chave);
  } catch {
    /* ignora */
  }
}

export const sessao = {
  token: () => ler(CHAVE),
  salvar: (t: string) => escrever(CHAVE, t),
  sair: () => apagar(CHAVE),
  /** Código da empresa, lembrado para o colaborador não redigitar a cada acesso. */
  empresa: () => ler(CHAVE_EMPRESA),
  lembrarEmpresa: (c: string) => escrever(CHAVE_EMPRESA, c),
  esquecerEmpresa: () => apagar(CHAVE_EMPRESA),
};
