/**
 * Regras do autocadastro (migration 0009), do lado do cliente.
 *
 * É só cortesia para a pessoa ver o erro antes de enviar: quem decide de
 * verdade é `publico_solicitar_cadastro`, que repete cada uma destas checagens.
 */

/** Mesma expressão da coluna `solicitacoes_cadastro.email` (sem espaço, com @ e ponto). */
const RE_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Domínio simples: `empresa.com.br`. Sem esquema, sem caminho, sem @. */
const RE_DOMINIO = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export function emailValido(email: string): boolean {
  const e = email.trim();
  return e.length <= 200 && RE_EMAIL.test(e);
}

/**
 * Lê a lista de domínios digitada pelo admin (vírgula, espaço ou linha nova).
 * Aceita `@empresa.com.br` e `Empresa.com.br`; devolve em minúsculas, sem
 * repetição, e à parte o que não parece domínio — para a tela avisar em vez de
 * gravar lixo.
 */
export function normalizarDominios(texto: string): { dominios: string[]; invalidos: string[] } {
  const dominios: string[] = [];
  const invalidos: string[] = [];
  for (const bruto of texto.split(/[\s,;]+/)) {
    const d = bruto.trim().replace(/^@/, "").toLowerCase();
    if (!d) continue;
    if (!RE_DOMINIO.test(d)) {
      invalidos.push(bruto.trim());
    } else if (!dominios.includes(d)) {
      dominios.push(d);
    }
  }
  return { dominios, invalidos };
}

/** Sem domínio configurado, qualquer e-mail válido passa (o admin ainda não restringiu). */
export function emailNoDominio(email: string, dominios: readonly string[]): boolean {
  if (dominios.length === 0) return true;
  const dominio = email.trim().toLowerCase().split("@")[1] ?? "";
  return dominios.some((d) => d.toLowerCase() === dominio);
}

/** Lê `empresas.config.dominios_email`, que é JSON livre: nunca confia no formato. */
export function dominiosDaConfig(config: unknown): string[] {
  if (!config || typeof config !== "object") return [];
  const lista = (config as { dominios_email?: unknown }).dominios_email;
  if (!Array.isArray(lista)) return [];
  return lista.filter((d): d is string => typeof d === "string" && d.trim() !== "");
}

/** Mensagem pronta para colar no WhatsApp ou no e-mail, com tudo para o 1º acesso. */
export function mensagemDeAcesso(opts: {
  nome: string;
  matricula: string;
  pin: string;
  empresaCodigo: string;
  origem: string;
}): string {
  const primeiro = opts.nome.trim().split(/\s+/)[0] ?? opts.nome;
  return [
    `Olá, ${primeiro}! Seu acesso ao T.I.M.E. Seguro está liberado.`,
    "",
    `1. Abra: ${opts.origem}/app/entrar?empresa=${opts.empresaCodigo}`,
    `2. Matrícula: ${opts.matricula}`,
    `3. PIN: ${opts.pin}`,
    "",
    "Esse PIN é só seu e não muda. Não passe para ninguém.",
    "Dica: no celular, toque em “Instalar” para deixar o app na tela inicial.",
  ].join("\n");
}
