import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LinhaIndividual = {
  colaborador_id: string;
  nome: string;
  matricula: string;
  setor_id: string | null;
  total: number;
  conhecimento: number;
  relatos: number;
  engajamento: number;
  ultimo_ponto_em: string | null;
};

export type LinhaSetor = {
  setor_id: string;
  nome: string;
  cor: string | null;
  colaboradores_ativos: number;
  pontos_individuais: number;
  pontos_quiz_tv: number;
  total: number;
};

export type Congelado = {
  tipo: string;
  colaborador_id: string | null;
  setor_id: string | null;
  posicao: number;
  pontos: number;
};

/**
 * Desempate do ranking individual (docs/TIME_08 §3): mais pontos em relatos →
 * mais em conhecimento → quem chegou primeiro ao total.
 *
 * A view devolve por total; o desempate fica aqui para a regra ser explícita e
 * testável.
 */
export function ordenarIndividual(linhas: readonly LinhaIndividual[]): LinhaIndividual[] {
  return [...linhas].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.relatos !== a.relatos) return b.relatos - a.relatos;
    if (b.conhecimento !== a.conhecimento) return b.conhecimento - a.conhecimento;
    // Quem chegou primeiro ao total fica na frente.
    const ta = a.ultimo_ponto_em ?? "9999";
    const tb = b.ultimo_ponto_em ?? "9999";
    return ta.localeCompare(tb);
  });
}

/** Posição com empate: quem tem o mesmo total divide a colocação. */
export function comPosicao<T extends { total: number }>(
  linhas: readonly T[],
): (T & { posicao: number })[] {
  let posicao = 0;
  let anterior: number | null = null;
  return linhas.map((linha, i) => {
    if (anterior === null || linha.total !== anterior) {
      posicao = i + 1;
      anterior = linha.total;
    }
    return { ...linha, posicao };
  });
}

export const MEDALHAS = ["🥇", "🥈", "🥉"] as const;

export function medalha(posicao: number): string | null {
  return MEDALHAS[posicao - 1] ?? null;
}

export function useRankingIndividual(campanhaId: string | null) {
  return useQuery({
    queryKey: ["ranking-individual", campanhaId],
    enabled: campanhaId !== null,
    queryFn: async (): Promise<LinhaIndividual[]> => {
      if (!campanhaId) return [];
      const { data, error } = await supabase
        .from("v_ranking_individual")
        .select(
          "colaborador_id, nome, matricula, setor_id, total, conhecimento, relatos, engajamento, ultimo_ponto_em",
        )
        .eq("campanha_id", campanhaId);
      if (error) throw error;
      return ordenarIndividual((data ?? []) as LinhaIndividual[]);
    },
  });
}

export function useRankingSetor(campanhaId: string | null) {
  return useQuery({
    queryKey: ["ranking-setor", campanhaId],
    enabled: campanhaId !== null,
    queryFn: async (): Promise<LinhaSetor[]> => {
      if (!campanhaId) return [];
      const { data, error } = await supabase
        .from("v_ranking_setor")
        .select(
          "setor_id, nome, cor, colaboradores_ativos, pontos_individuais, pontos_quiz_tv, total",
        )
        .eq("campanha_id", campanhaId)
        .order("total", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LinhaSetor[];
    },
  });
}

/**
 * Ranking congelado de uma campanha encerrada (docs/TIME_08 §6.2). Depois do
 * encerramento é esta tabela que vale, não a view: a view continuaria mudando se
 * algum ponto entrasse depois.
 */
export function useResultadosCongelados(campanhaId: string | null) {
  return useQuery({
    queryKey: ["campanha-resultados", campanhaId],
    enabled: campanhaId !== null,
    queryFn: async (): Promise<Congelado[]> => {
      if (!campanhaId) return [];
      const { data, error } = await supabase
        .from("campanha_resultados")
        .select("tipo, colaborador_id, setor_id, posicao, pontos")
        .eq("campanha_id", campanhaId)
        .order("posicao");
      if (error) throw error;
      return (data ?? []) as Congelado[];
    },
  });
}
