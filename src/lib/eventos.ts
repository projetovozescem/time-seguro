/**
 * Eventos de DDS, SIPAT e treinamento (docs/TIME_04 §8).
 *
 * O `EventoForm` do V.O.Z.E.S. não foi reaproveitado: ele é um formulário de
 * data única sobre os tipos da campanha escolar. Aqui o evento tem início e fim
 * com hora, setor, pontos de check-in e campanha. O que se aproveitou foi a
 * ideia da tela, não o código.
 */

export type TipoEvento = "dds" | "sipat" | "treinamento" | "outro";
export type StatusEvento = "agendado" | "realizado" | "cancelado";

export type DefinicaoTipo = {
  tipo: TipoEvento;
  rotulo: string;
  emoji: string;
  /** Classe de cor do chip (docs/TIME_04 §8: azul, laranja, verde, cinza). */
  cor: string;
  /** Pontos padrão do check-in. */
  pontos: number;
};

export const TIPOS_EVENTO: readonly DefinicaoTipo[] = [
  { tipo: "dds", rotulo: "DDS", emoji: "🗣️", cor: "bg-marinho/10 text-marinho", pontos: 5 },
  { tipo: "sipat", rotulo: "SIPAT", emoji: "🎪", cor: "bg-laranja/15 text-laranja", pontos: 15 },
  {
    tipo: "treinamento",
    rotulo: "Treinamento",
    emoji: "🎓",
    cor: "bg-verde/15 text-verde",
    pontos: 15,
  },
  { tipo: "outro", rotulo: "Outro", emoji: "📌", cor: "bg-muted text-texto-suave", pontos: 0 },
] as const;

export function definicaoDoTipo(tipo: string): DefinicaoTipo {
  return TIPOS_EVENTO.find((t) => t.tipo === tipo) ?? TIPOS_EVENTO[3]!;
}

/** Pontos padrão de um tipo (docs/TIME_04 §8: DDS 5, SIPAT 15, Treinamento 15). */
export function pontosPadrao(tipo: string): number {
  return definicaoDoTipo(tipo).pontos;
}

export type EventoForm = {
  titulo: string;
  tipo: TipoEvento;
  inicio: string;
  fim: string;
  setor_id: string | null;
  pontos: number;
  campanha_id: string | null;
  descricao: string;
};

/**
 * Regras do formulário. O banco também recusa fim <= início e pontos fora de
 * 0–100; aqui é para a mensagem ser legível em vez de erro do Postgres.
 */
export function validarEvento(f: EventoForm): string[] {
  const erros: string[] = [];
  if (f.titulo.trim().length < 3) erros.push("Dê um título ao evento.");
  if (!f.inicio) erros.push("Informe quando começa.");
  if (!f.fim) erros.push("Informe quando termina.");
  if (f.inicio && f.fim && f.fim <= f.inicio) {
    erros.push("O fim precisa ser depois do início.");
  }
  if (!Number.isInteger(f.pontos) || f.pontos < 0 || f.pontos > 100) {
    erros.push("Pontos do check-in: use um número de 0 a 100.");
  }
  return erros;
}

/**
 * Monta um CSV no padrão que o docs/TIME_09 exige: separador `;` e BOM, para o
 * Excel brasileiro abrir sem embaralhar colunas nem quebrar acento.
 */
/**
 * Byte order mark que o Excel brasileiro espera. Montado por codigo de
 * caractere de proposito: BOM literal no fonte e invisivel para quem edita
 * depois, e o eslint reprova por no-irregular-whitespace.
 */
const BOM = String.fromCharCode(0xfeff);

export function montarCsv(
  cabecalho: readonly string[],
  linhas: readonly (readonly unknown[])[],
): string {
  const celula = (v: unknown): string => {
    const texto = v === null || v === undefined ? "" : String(v);
    // Campo com separador, aspas ou quebra de linha vai entre aspas.
    return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };

  const corpo = [cabecalho, ...linhas].map((linha) => linha.map(celula).join(";")).join("\r\n");
  return BOM + corpo + "\r\n";
}

/** Dispara o download de um CSV já montado. */
export function baixarCsv(nomeDoArquivo: string, conteudo: string): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeDoArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

/** `2026-10-01T14:30:00Z` → `2026-10-01T11:30`, o formato do input datetime-local. */
export function paraInputDataHora(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Agrupa eventos por dia (chave `AAAA-MM-DD`), preservando a ordem recebida. */
export function agruparPorDia<T extends { inicio: string }>(
  eventos: readonly T[],
): Map<string, T[]> {
  const porDia = new Map<string, T[]>();
  for (const e of eventos) {
    const dia = e.inicio.slice(0, 10);
    const lista = porDia.get(dia) ?? [];
    lista.push(e);
    porDia.set(dia, lista);
  }
  return porDia;
}
