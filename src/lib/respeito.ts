/**
 * Canal de Respeito (Lei 14.457/2022) — docs/TIME_01 §7 e docs/TIME_03 §6.
 *
 * REGRAS QUE NÃO SE NEGOCIAM, e que estão cobertas por teste:
 * 1. A página é pública e **nunca** envia `p_token`. Use `rpcPublica`, nunca
 *    `rpcApp` — é o que garante que o sistema não liga a denúncia a ninguém.
 * 2. Nada aqui grava em `localStorage`, chama analytics ou registra acesso.
 * 3. Denúncia **nunca** pontua. Educação sobre assédio pontua; denúncia não.
 * 4. O banco guarda só a DATA (sem hora), sem colaborador, sem IP, sem aparelho.
 */

export type CategoriaDenuncia = "moral" | "sexual" | "discriminacao" | "outro";
export type StatusDenuncia = "recebida" | "em_apuracao" | "concluida" | "arquivada";

export const CATEGORIAS_DENUNCIA: readonly {
  categoria: CategoriaDenuncia;
  rotulo: string;
  ajuda: string;
}[] = [
  {
    categoria: "moral",
    rotulo: "Assédio moral",
    ajuda: "Humilhação, constrangimento ou isolamento que se repetem.",
  },
  {
    categoria: "sexual",
    rotulo: "Assédio sexual",
    ajuda: "Insistência, comentários ou toques de cunho sexual sem consentimento.",
  },
  {
    categoria: "discriminacao",
    rotulo: "Discriminação",
    ajuda: "Tratamento diferente por raça, gênero, religião, idade, deficiência ou origem.",
  },
  {
    categoria: "outro",
    rotulo: "Outra situação",
    ajuda: "Qualquer outra violência ou desrespeito no trabalho.",
  },
] as const;

export const STATUS_DENUNCIA: Record<StatusDenuncia, { rotulo: string; cor: string }> = {
  recebida: { rotulo: "Recebida", cor: "bg-muted text-texto-suave" },
  em_apuracao: { rotulo: "Em apuração", cor: "bg-respeito/15 text-respeito" },
  concluida: { rotulo: "Concluída", cor: "bg-verde/15 text-verde" },
  arquivada: { rotulo: "Arquivada", cor: "bg-muted text-texto-suave" },
};

export function rotuloDoStatusDenuncia(status: string): string {
  return STATUS_DENUNCIA[status as StatusDenuncia]?.rotulo ?? status;
}

export function corDoStatusDenuncia(status: string): string {
  return STATUS_DENUNCIA[status as StatusDenuncia]?.cor ?? "bg-muted text-texto-suave";
}

export function rotuloDaCategoriaDenuncia(categoria: string): string {
  return CATEGORIAS_DENUNCIA.find((c) => c.categoria === categoria)?.rotulo ?? "Outra situação";
}

/** Status que o comitê pode escolher (`comite_responder_denuncia`). */
export const STATUS_DO_COMITE: readonly StatusDenuncia[] = [
  "recebida",
  "em_apuracao",
  "concluida",
  "arquivada",
] as const;

/** Mínimo da descrição: o banco devolve `descricao_curta` abaixo disso. */
export const MINIMO_DESCRICAO_DENUNCIA = 20;

export function descricaoDenunciaValida(texto: string): boolean {
  return texto.trim().length >= MINIMO_DESCRICAO_DENUNCIA;
}

/**
 * Canais oficiais que a página precisa mostrar (docs/TIME_01 §10): o Canal de
 * Respeito não substitui nenhum deles.
 */
export const CANAIS_OFICIAIS = [
  { numero: "180", nome: "Central de Atendimento à Mulher" },
  { numero: "100", nome: "Direitos Humanos" },
  { numero: "190", nome: "Emergência (Polícia)" },
] as const;

/** Texto de transparência obrigatório na página (docs/TIME_03 §6). */
export const AVISO_ANONIMATO =
  "Não pedimos seu nome. O sistema não registra quem você é. Se você mesmo " +
  "escrever seu nome ou detalhes que identifiquem você, o comitê poderá saber.";

/**
 * Nota técnica honesta (docs/TIME_03 §6): a hospedagem pode manter logs de
 * acesso, como qualquer site. O sistema não grava nem cruza esses dados.
 */
export const NOTA_TECNICA =
  "A hospedagem pode manter registros técnicos de acesso, como em qualquer site. " +
  "O T.I.M.E. Seguro não grava nem cruza esses dados com a sua denúncia.";
