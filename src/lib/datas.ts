/**
 * Datas do T.I.M.E., sempre em pt-BR.
 *
 * Regra que justifica este arquivo: data vinda do Postgres como `date` é
 * `AAAA-MM-DD` sem fuso. Passar isso por `new Date(iso)` faz o JavaScript ler
 * como UTC e, no Brasil, devolver o dia anterior. Por isso as funções de data
 * pura quebram a string em pedaços, sem nunca construir um `Date`.
 */

/** `2026-10-01` → `01/10/2026`. Aceita timestamp e usa só a parte da data. */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  if (!ano || !mes || !dia) return "—";
  return `${dia}/${mes}/${ano}`;
}

/** `2026-10-01T14:30:00Z` → `01/10/2026 11:30` (no fuso de quem está olhando). */
export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Só a hora de um timestamp: `11:30`. Usado na lista de presença. */
export function formatarHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Hoje no fuso local, como `AAAA-MM-DD` — serve de valor para `<input type="date">`. */
export function hojeISO(): string {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/**
 * "Dia operacional": o dia do sistema vira às **05h**, não à meia-noite, porque
 * o turno da noite atravessa a virada (docs/TIME_00 §6). O banco tem a função
 * `dia_operacional()`; esta é a versão do cliente, para a tela não discordar.
 */
export function diaOperacionalISO(agora = new Date()): string {
  const deslocado = new Date(agora);
  deslocado.setHours(deslocado.getHours() - 5);
  const ano = deslocado.getFullYear();
  const mes = String(deslocado.getMonth() + 1).padStart(2, "0");
  const dia = String(deslocado.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/** Dias de `de` até `ate`, contando só a data. Negativo quando `ate` já passou. */
export function diasEntre(de: string, ate: string): number | null {
  const parse = (iso: string) => {
    const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
    if (!ano || !mes || !dia) return null;
    return new Date(ano, mes - 1, dia).getTime();
  };
  const a = parse(de);
  const b = parse(ate);
  if (a === null || b === null) return null;
  return Math.round((b - a) / 86_400_000);
}

/** Dias que faltam para uma data, nunca negativo. */
export function diasRestantes(ate: string | null | undefined): number | null {
  if (!ate) return null;
  const dias = diasEntre(hojeISO(), ate);
  return dias === null ? null : Math.max(dias, 0);
}

/** Se `hoje` está dentro do período, com as duas pontas incluídas. */
export function dentroDoPeriodo(inicio: string, fim: string, hoje = hojeISO()): boolean {
  const d = hoje.slice(0, 10);
  return d >= inicio.slice(0, 10) && d <= fim.slice(0, 10);
}
