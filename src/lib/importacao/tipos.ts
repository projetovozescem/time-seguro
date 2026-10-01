/** Tipo interno do importador (docs/TIME_07 §2). */
export type PerguntaImportada = {
  enunciado: string;
  /** 2 a 5 alternativas, na ordem A–E. */
  alternativas: string[];
  /** 0-based. `null` quando o arquivo não disse qual é — exige revisão. */
  correta: number | null;
  /** Slug ou nome; vira `tema_id` na tela de revisão. */
  tema: string | null;
  explicacao?: string;
  dificuldade?: 1 | 2 | 3;
  avisos: Aviso[];
};

export type Aviso =
  | "resposta_nao_detectada"
  | "tema_ausente"
  | "tema_desconhecido"
  | "poucas_alternativas"
  | "muitas_alternativas"
  | "enunciado_curto"
  | "correta_fora_da_faixa"
  | "duplicada_no_arquivo"
  | "duplicada_no_banco";

export const LETRAS = ["A", "B", "C", "D", "E"] as const;

/** Dificuldade padrão quando o arquivo não informa (docs/TIME_07 §3). */
export const DIFICULDADE_PADRAO = 2;

/**
 * Forma canônica de um enunciado, para detectar duplicada: sem acento, sem
 * pontuação, minúsculo e com espaços colapsados. "Que é EPI?" e "que e epi"
 * passam a bater.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
