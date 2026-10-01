/**
 * Tradução das origens de ponto para o extrato do app (docs/TIME_08 §7).
 *
 * As chaves foram levantadas dos `_lancar_pontos(..., 'origem', ...)` das
 * migrations, não só do documento: `src/lib/pontuacao.test.ts` confere que
 * nenhuma origem do SQL ficou sem texto.
 */

export type Pilar = "conhecimento" | "relatos" | "engajamento";

export const TEXTO_DA_ORIGEM: Record<string, string> = {
  quiz_diario: "Acerto no quiz do dia",
  licao_conteudo: "Estudou uma lição",
  licao_aprovada: "Aprovado na avaliação",
  licao_nota_maxima: "Nota máxima na avaliação",
  relato_validado: "Relato validado pela SST",
  relato_resolvido: "Seu relato foi resolvido",
  presenca_diaria: "Presença do dia",
  streak_7: "Sequência de 7 dias",
  streak_15: "Sequência de 15 dias",
  streak_30: "Sequência de 30 dias",
  checkin: "Presença em DDS/SIPAT",
};

/** Emoji do pilar, para a linha do extrato ter leitura rápida. */
export const EMOJI_DO_PILAR: Record<Pilar, string> = {
  conhecimento: "🧠",
  relatos: "📢",
  engajamento: "🔥",
};

export const ROTULO_DO_PILAR: Record<Pilar, string> = {
  conhecimento: "Conhecimento",
  relatos: "Relatos",
  engajamento: "Engajamento",
};

/**
 * Texto de uma origem. Nunca devolve o código cru: uma origem nova numa
 * migration futura aparece como "Pontos ganhos" em vez de `streak_60`, e o teste
 * reprova até o texto existir.
 */
export function textoDaOrigem(origem: string | null | undefined): string {
  if (!origem) return "Pontos ganhos";
  return TEXTO_DA_ORIGEM[origem] ?? "Pontos ganhos";
}

export type LinhaExtrato = {
  pilar: Pilar;
  origem: string;
  pontos: number;
  em: string;
};

/** Soma por pilar, para o resumo do perfil. */
export function somarPorPilar(extrato: readonly LinhaExtrato[]): Record<Pilar, number> {
  const soma: Record<Pilar, number> = { conhecimento: 0, relatos: 0, engajamento: 0 };
  for (const linha of extrato) {
    if (linha.pilar in soma) soma[linha.pilar] += linha.pontos;
  }
  return soma;
}

/**
 * Agrupa o extrato por dia, do mais recente para o mais antigo. O colaborador
 * quer saber "o que ganhei hoje", não uma lista corrida de 300 linhas.
 */
export function agruparExtratoPorDia(
  extrato: readonly LinhaExtrato[],
): { dia: string; total: number; linhas: LinhaExtrato[] }[] {
  const porDia = new Map<string, LinhaExtrato[]>();
  for (const linha of extrato) {
    const dia = linha.em.slice(0, 10);
    const lista = porDia.get(dia) ?? [];
    lista.push(linha);
    porDia.set(dia, lista);
  }

  return [...porDia.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dia, linhas]) => ({
      dia,
      total: linhas.reduce((s, l) => s + l.pontos, 0),
      linhas,
    }));
}

export type Selo = {
  slug: string;
  nome: string;
  descricao: string;
  icone: string;
  conquistado: boolean;
  em: string | null;
};

/** Conquistados primeiro, na ordem em que vieram; o resto depois, em cinza. */
export function ordenarSelos(selos: readonly Selo[]): Selo[] {
  return [...selos].sort((a, b) => {
    if (a.conquistado !== b.conquistado) return a.conquistado ? -1 : 1;
    return 0;
  });
}
