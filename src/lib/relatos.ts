/**
 * Relatos de risco (docs/TIME_01 §8, docs/TIME_04 §9, docs/TIME_05 §7).
 *
 * Categorias, status e gravidades batem com os CHECK do banco — há teste
 * comparando com as migrations.
 */

export type Categoria = "condicao_insegura" | "ato_inseguro" | "quase_acidente" | "melhoria";
export type StatusRelato =
  "aberto" | "em_analise" | "em_correcao" | "resolvido" | "rejeitado" | "duplicado";
export type Gravidade = "baixa" | "media" | "alta";
export type Decisao = "validar" | "rejeitar" | "duplicado";

export type DefinicaoCategoria = {
  categoria: Categoria;
  rotulo: string;
  emoji: string;
  /** Explicação curta, na linguagem de quem está no chão de fábrica. */
  ajuda: string;
};

/** Os quatro cartões grandes da tela de relatar (docs/TIME_05 §7). */
export const CATEGORIAS: readonly DefinicaoCategoria[] = [
  {
    categoria: "condicao_insegura",
    rotulo: "Condição insegura",
    emoji: "⚠️",
    ajuda: "Algo no local oferece risco: piso, máquina, fiação, falta de proteção.",
  },
  {
    categoria: "ato_inseguro",
    rotulo: "Ato inseguro",
    emoji: "🚶",
    ajuda: "Alguém fazendo de um jeito que pode machucar.",
  },
  {
    categoria: "quase_acidente",
    rotulo: "Quase-acidente",
    emoji: "😰",
    ajuda: "Quase aconteceu, mas ninguém se machucou nem quebrou nada.",
  },
  {
    categoria: "melhoria",
    rotulo: "Sugestão de melhoria",
    emoji: "💡",
    ajuda: "Uma ideia para deixar o trabalho mais seguro.",
  },
] as const;

export function definicaoDaCategoria(categoria: string): DefinicaoCategoria | null {
  return CATEGORIAS.find((c) => c.categoria === categoria) ?? null;
}

/** Nome da categoria para a tela; nunca devolve o código cru. */
export function rotuloDaCategoria(categoria: string): string {
  return definicaoDaCategoria(categoria)?.rotulo ?? "Relato";
}

/** Status em linguagem simples (docs/TIME_05 §7 "Meus relatos"). */
export const STATUS: Record<StatusRelato, { rotulo: string; cor: string }> = {
  aberto: { rotulo: "Enviado", cor: "bg-muted text-texto-suave" },
  em_analise: { rotulo: "Em análise", cor: "bg-marinho/10 text-marinho" },
  em_correcao: { rotulo: "Em correção", cor: "bg-laranja/15 text-laranja" },
  resolvido: { rotulo: "Resolvido ✅", cor: "bg-verde/15 text-verde" },
  rejeitado: { rotulo: "Não validado", cor: "bg-vermelho/10 text-vermelho" },
  duplicado: { rotulo: "Já relatado", cor: "bg-muted text-texto-suave" },
};

export function rotuloDoStatus(status: string): string {
  return STATUS[status as StatusRelato]?.rotulo ?? status;
}

export function corDoStatus(status: string): string {
  return STATUS[status as StatusRelato]?.cor ?? "bg-muted text-texto-suave";
}

export const GRAVIDADES: readonly { gravidade: Gravidade; rotulo: string; cor: string }[] = [
  { gravidade: "baixa", rotulo: "Baixa", cor: "bg-muted text-texto" },
  { gravidade: "media", rotulo: "Média", cor: "bg-laranja/15 text-laranja" },
  { gravidade: "alta", rotulo: "Alta", cor: "bg-vermelho/15 text-vermelho" },
] as const;

/** Colunas do kanban do painel (docs/TIME_04 §9), na ordem do fluxo. */
export const COLUNAS_KANBAN: readonly { status: StatusRelato; titulo: string }[] = [
  { status: "aberto", titulo: "Novos" },
  { status: "em_analise", titulo: "Em análise" },
  { status: "em_correcao", titulo: "Em correção" },
  { status: "resolvido", titulo: "Resolvidos" },
] as const;

/** Mínimo de caracteres da descrição — o banco devolve `descricao_curta`. */
export const MINIMO_DESCRICAO = 10;

export function descricaoValida(texto: string): boolean {
  return texto.trim().length >= MINIMO_DESCRICAO;
}

/**
 * Status que o técnico pode escolher no andamento, depois de validar
 * (`tecnico_atualizar_relato` aceita só estes três).
 */
export const STATUS_DE_ANDAMENTO: readonly StatusRelato[] = [
  "em_analise",
  "em_correcao",
  "resolvido",
] as const;

/**
 * Reduz a imagem antes de enviar (docs/TIME_03 §5: JPEG, lado maior 1280px,
 * qualidade 0,7). Economiza dado do colaborador e espaço no bucket.
 *
 * Devolve o arquivo original se o navegador não tiver canvas — melhor enviar
 * grande que não enviar.
 */
export async function comprimirImagem(
  arquivo: File,
  ladoMaior = 1280,
  qualidade = 0.7,
): Promise<Blob> {
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") {
    return arquivo;
  }

  try {
    const bitmap = await createImageBitmap(arquivo);
    const escala = Math.min(1, ladoMaior / Math.max(bitmap.width, bitmap.height));
    const largura = Math.round(bitmap.width * escala);
    const altura = Math.round(bitmap.height * escala);

    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) return arquivo;
    ctx.drawImage(bitmap, 0, 0, largura, altura);

    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", qualidade));
    return blob ?? arquivo;
  } catch {
    return arquivo;
  }
}
