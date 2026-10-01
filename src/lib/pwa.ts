/**
 * Registro do service worker. Só é chamado nas rotas do aluno (`/aluno/*`) —
 * o painel do professor não instala nada.
 */

const CHAVE_TURMA = "vozes_turma";

export function registrarServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  // Em desenvolvimento o SW só atrapalharia o hot reload.
  if (import.meta.env.DEV) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* sem service worker o app segue funcionando normalmente */
    });
  });
}

/** Guarda a turma para o app instalado saber para onde abrir (`start_url` = /aluno). */
export function lembrarTurma(turmaId: string): void {
  try {
    window.localStorage.setItem(CHAVE_TURMA, turmaId);
  } catch {
    /* armazenamento bloqueado — o aluno só precisa escanear o QR Code de novo */
  }
}

export function turmaLembrada(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CHAVE_TURMA);
  } catch {
    return null;
  }
}

/** Limpa a turma salva — usado pelo link "Trocar turma" na home do aluno. */
export function esquecerTurma(): void {
  try {
    window.localStorage.removeItem(CHAVE_TURMA);
  } catch {
    /* nada a limpar */
  }
}
