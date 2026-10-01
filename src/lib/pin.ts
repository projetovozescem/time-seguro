/**
 * Regras do PIN do colaborador (docs/TIME_03 §3).
 *
 * A validação no cliente é só cortesia: o servidor recusa PIN fraco de novo em
 * `colaborador_trocar_pin`, devolvendo `pin_fraco`. Nunca confiar nesta função
 * como barreira de segurança.
 */

/** Um PIN válido tem exatamente 6 dígitos. */
export function pinBemFormado(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

/**
 * PIN fraco: fora do formato, todos os dígitos iguais (111111) ou em sequência
 * crescente ou decrescente (123456, 654321).
 */
export function pinFraco(pin: string): boolean {
  if (!pinBemFormado(pin)) return true;
  if (/^(\d)\1{5}$/.test(pin)) return true;

  const digitos = [...pin].map(Number);
  const crescente = digitos.every((d, i) => i === 0 || d === digitos[i - 1]! + 1);
  const decrescente = digitos.every((d, i) => i === 0 || d === digitos[i - 1]! - 1);
  return crescente || decrescente;
}

/** Mantém só dígitos e corta em 6 — usado no `onChange` dos campos de PIN. */
export function limparPin(bruto: string): string {
  return bruto.replace(/\D/g, "").slice(0, 6);
}
