/**
 * Relatório de Evidência de Treinamento (docs/TIME_09 §2).
 *
 * Serve a auditoria, gestão e CIPA. Duas regras que não se negociam:
 *
 * 1. O **aviso obrigatório** aparece no rodapé de toda página. O relatório não
 *    pode dar a entender que substitui treinamento de NR.
 * 2. A versão CIPA+A traz **só números agregados** do Canal de Respeito — nunca
 *    protocolo, categoria individual nem descrição (docs/TIME_09 §2 e
 *    docs/TIME_03 §6). Há teste garantindo isso.
 */

/** Rodapé de toda página do PDF (docs/TIME_09 §2.6), texto literal do documento. */
export const AVISO_OBRIGATORIO =
  "Este relatório registra ações complementares de capacitação e conscientização " +
  "realizadas na plataforma T.I.M.E. Seguro. Não substitui os treinamentos " +
  "obrigatórios previstos nas Normas Regulamentadoras, que devem seguir carga " +
  "horária, conteúdo programático e requisitos próprios de cada NR.";

export type SituacaoLicao = "aprovado" | "pendente";

export type LinhaEvidencia = {
  matricula: string;
  nome: string;
  setor: string;
  licao: string;
  concluido_em: string | null;
  nota: number | null;
  tentativas: number;
  situacao: SituacaoLicao;
};

export function situacaoDe(aprovadoEm: string | null): SituacaoLicao {
  return aprovadoEm ? "aprovado" : "pendente";
}

export const ROTULO_DA_SITUACAO: Record<SituacaoLicao, string> = {
  aprovado: "Aprovado",
  pendente: "Pendente",
};

export type Resumo = {
  colaboradores: number;
  concluintes: number;
  percentualConclusao: number;
  notaMedia: number | null;
  cargaTotalMinutos: number;
};

/**
 * Resumo do escopo (docs/TIME_09 §2.2).
 *
 * "Concluinte" é quem foi aprovado em TODAS as lições do escopo — aprovar uma de
 * cinco não conclui a trilha, e contar assim inflaria a evidência.
 */
export function resumir(
  linhas: readonly LinhaEvidencia[],
  cargaPorLicao: ReadonlyMap<string, number>,
): Resumo {
  const porPessoa = new Map<string, LinhaEvidencia[]>();
  for (const l of linhas) {
    const lista = porPessoa.get(l.matricula) ?? [];
    lista.push(l);
    porPessoa.set(l.matricula, lista);
  }

  const licoesDoEscopo = new Set(linhas.map((l) => l.licao));

  let concluintes = 0;
  for (const daPessoa of porPessoa.values()) {
    const aprovadas = new Set(
      daPessoa.filter((l) => l.situacao === "aprovado").map((l) => l.licao),
    );
    if (licoesDoEscopo.size > 0 && aprovadas.size === licoesDoEscopo.size) concluintes++;
  }

  const notas = linhas.map((l) => l.nota).filter((n): n is number => n !== null);

  let cargaTotalMinutos = 0;
  for (const licao of licoesDoEscopo) cargaTotalMinutos += cargaPorLicao.get(licao) ?? 0;

  return {
    colaboradores: porPessoa.size,
    concluintes,
    percentualConclusao: porPessoa.size > 0 ? Math.round((concluintes / porPessoa.size) * 100) : 0,
    notaMedia:
      notas.length > 0 ? Math.round(notas.reduce((s, n) => s + n, 0) / notas.length) : null,
    cargaTotalMinutos,
  };
}

/** "150" → "2h30". */
export function cargaEmHoras(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${resto}min`;
  if (resto === 0) return `${horas}h`;
  return `${horas}h${String(resto).padStart(2, "0")}`;
}

export type AgregadoDoCanal = {
  /** `AAAA-MM`. */
  mes: string;
  status: string;
  quantidade: number;
};

/**
 * Agrega o Canal de Respeito para o relatório CIPA+A: **só** mês, status e
 * contagem.
 *
 * A assinatura recebe apenas `recebida_em` e `status` de propósito. Se recebesse
 * a denúncia inteira, seria fácil alguém acrescentar a descrição ao PDF sem
 * perceber — aqui o dado sensível nem chega à função.
 */
export function agregarCanal(
  denuncias: readonly { recebida_em: string; status: string }[],
): AgregadoDoCanal[] {
  const contagem = new Map<string, number>();
  for (const d of denuncias) {
    const chave = `${d.recebida_em.slice(0, 7)}|${d.status}`;
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }

  return [...contagem.entries()]
    .map(([chave, quantidade]) => {
      const [mes, status] = chave.split("|");
      return { mes: mes!, status: status!, quantidade };
    })
    .sort((a, b) => a.mes.localeCompare(b.mes) || a.status.localeCompare(b.status));
}

/** Campos de assinatura do PDF (docs/TIME_09 §2.5). */
export const ASSINATURAS = ["Técnico de Segurança do Trabalho", "Representante da CIPA"] as const;
