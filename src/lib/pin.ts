/**
 * Campo de PIN do app (docs/TIME_03 §3). O PIN é fixo e vem do gestor: o
 * colaborador só o digita para entrar, então a única regra do cliente é
 * aceitar dígitos. Quem valida de verdade é o servidor.
 */

/** Mantém só dígitos e corta em 6 — usado no `onChange` dos campos de PIN. */
export function limparPin(bruto: string): string {
  return bruto.replace(/\D/g, "").slice(0, 6);
}
