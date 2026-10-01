import { diaOperacionalISO, diasEntre } from "./datas";

/**
 * Agregações das abas Relatos e Engajamento do analytics (docs/TIME_09 §1.4 e §1.5).
 *
 * Tudo aqui é função pura sobre as linhas que o painel já lê por RLS. Nada de
 * cálculo dentro do componente: é o que permite testar o número sem navegador.
 */

/** Contagem por chave, da maior para a menor. Chave vazia virá como `rotuloVazio`. */
export function contarPor<T>(
  itens: readonly T[],
  chave: (item: T) => string | null | undefined,
  rotuloVazio = "Sem informação",
): { rotulo: string; quantidade: number }[] {
  const contas = new Map<string, number>();
  for (const item of itens) {
    const k = chave(item) ?? rotuloVazio;
    contas.set(k === "" ? rotuloVazio : k, (contas.get(k === "" ? rotuloVazio : k) ?? 0) + 1);
  }
  return [...contas.entries()]
    .map(([rotulo, quantidade]) => ({ rotulo, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

/**
 * Média de horas entre dois instantes, ignorando os pares incompletos.
 *
 * Devolve `null` quando nenhum par está completo — e `null` não é zero: zero
 * significaria "resolvido na hora", o que é bem diferente de "ainda não há
 * nenhum resolvido".
 */
export function mediaDeHoras(
  pares: readonly { de: string | null; ate: string | null }[],
): number | null {
  const horas = pares
    .filter((p): p is { de: string; ate: string } => !!p.de && !!p.ate)
    .map((p) => (new Date(p.ate).getTime() - new Date(p.de).getTime()) / 3_600_000)
    .filter((h) => Number.isFinite(h) && h >= 0);
  if (horas.length === 0) return null;
  return horas.reduce((soma, h) => soma + h, 0) / horas.length;
}

/** "18 h" ou "2 d 6 h" — o técnico lê prazo em dia, não em hora de três dígitos. */
export function formatarDuracao(horas: number | null): string {
  if (horas === null) return "—";
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas < 48) return `${Math.round(horas)} h`;
  const dias = Math.floor(horas / 24);
  const resto = Math.round(horas % 24);
  return resto === 0 ? `${dias} d` : `${dias} d ${resto} h`;
}

export type Relato = {
  categoria: string;
  gravidade: string | null;
  status: string;
  setor_id: string | null;
  local_id: string | null;
  criado_em: string;
  validado_em: string | null;
};

/** Status que contam como relato encerrado com solução (docs/TIME_01 §5). */
export const STATUS_RESOLVIDO = "resolvido";

export function percentualResolvidos(relatos: readonly Relato[]): number {
  if (relatos.length === 0) return 0;
  const resolvidos = relatos.filter((r) => r.status === STATUS_RESOLVIDO).length;
  return Math.round((resolvidos / relatos.length) * 100);
}

/**
 * Mapa de calor por local: quais pontos da fábrica concentram risco.
 *
 * Ordena por quantidade e, no empate, pelo que tem relato grave — entre dois
 * locais com 3 relatos cada, o que tem uma gravidade alta vem primeiro.
 */
export function calorPorLocal(
  relatos: readonly Relato[],
  nomeDoLocal: (id: string) => string,
): { local: string; total: number; graves: number }[] {
  const porLocal = new Map<string, { total: number; graves: number }>();
  for (const r of relatos) {
    if (!r.local_id) continue;
    const atual = porLocal.get(r.local_id) ?? { total: 0, graves: 0 };
    atual.total += 1;
    if (r.gravidade === "alta") atual.graves += 1;
    porLocal.set(r.local_id, atual);
  }
  return [...porLocal.entries()]
    .map(([id, v]) => ({ local: nomeDoLocal(id), ...v }))
    .sort(
      (a, b) => b.total - a.total || b.graves - a.graves || a.local.localeCompare(b.local, "pt-BR"),
    );
}

/**
 * Sequência de dias seguidos de atividade, terminando hoje ou ontem.
 *
 * Conta no dia operacional (vira às 05h, docs/TIME_00 §6). Quem fez ontem e
 * ainda não fez hoje mantém a sequência: ela só zera depois de perder um dia
 * inteiro — a mesma regra que o app mostra ao colaborador.
 */
export function sequenciaAtual(dias: readonly string[], hoje = diaOperacionalISO()): number {
  const vistos = new Set(dias.map((d) => d.slice(0, 10)));
  if (vistos.size === 0) return 0;

  const maisRecente = [...vistos].sort().at(-1)!;
  const atraso = diasEntre(maisRecente, hoje);
  if (atraso === null || atraso > 1) return 0;

  let sequencia = 0;
  let cursor = maisRecente;
  while (vistos.has(cursor)) {
    sequencia += 1;
    cursor = somarDias(cursor, -1);
  }
  return sequencia;
}

/** Soma dias a uma data pura, sem passar por `new Date(iso)` (docs/TIME_00 §6). */
function somarDias(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  const d = new Date(ano!, mes! - 1, dia! + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const FAIXAS_DE_SEQUENCIA = [
  { rotulo: "sem sequência", de: 0, ate: 0 },
  { rotulo: "1 a 6 dias", de: 1, ate: 6 },
  { rotulo: "7 a 14 dias", de: 7, ate: 14 },
  { rotulo: "15 dias ou mais", de: 15, ate: Infinity },
] as const;

/**
 * Distribuição das sequências (docs/TIME_09 §1.5).
 *
 * `ativos` entra para que quem nunca abriu o app caia em "sem sequência" em vez
 * de desaparecer da conta: a distribuição é sobre o efetivo, não sobre quem já
 * respondeu.
 */
export function distribuicaoDeSequencias(
  diasPorColaborador: ReadonlyMap<string, readonly string[]>,
  ativos: readonly string[],
  hoje = diaOperacionalISO(),
): { rotulo: string; quantidade: number }[] {
  const contas = FAIXAS_DE_SEQUENCIA.map((f) => ({ rotulo: f.rotulo, quantidade: 0 }));
  for (const id of ativos) {
    const sequencia = sequenciaAtual(diasPorColaborador.get(id) ?? [], hoje);
    const indice = FAIXAS_DE_SEQUENCIA.findIndex((f) => sequencia >= f.de && sequencia <= f.ate);
    contas[indice === -1 ? 0 : indice]!.quantidade += 1;
  }
  return contas;
}

/**
 * Uso por hora do dia, nas 24 posições (docs/TIME_09 §1.5): serve para escolher
 * o horário do DDS. Usa a hora local do navegador do técnico, que é a hora da
 * fábrica — `criado_em` é `timestamptz`, então a conversão é correta.
 */
export function usoPorHora(instantes: readonly string[]): { hora: number; quantidade: number }[] {
  const horas = Array.from({ length: 24 }, (_, hora) => ({ hora, quantidade: 0 }));
  for (const iso of instantes) {
    const h = new Date(iso).getHours();
    if (Number.isInteger(h)) horas[h]!.quantidade += 1;
  }
  return horas;
}

/** A hora com mais uso, para a frase de recomendação. `null` se não há dado. */
export function horaDePico(instantes: readonly string[]): number | null {
  const horas = usoPorHora(instantes);
  const maior = Math.max(...horas.map((h) => h.quantidade));
  if (maior === 0) return null;
  return horas.find((h) => h.quantidade === maior)!.hora;
}
