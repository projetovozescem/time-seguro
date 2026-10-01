import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LinhaLacuna } from "@/lib/lacunas";

export function useLacunas(campanhaId: string | null) {
  return useQuery({
    queryKey: ["lacunas", campanhaId],
    enabled: campanhaId !== null,
    queryFn: async (): Promise<LinhaLacuna[]> => {
      if (!campanhaId) return [];
      const { data, error } = await supabase
        .from("v_lacunas")
        .select("setor_id, tema_id, tentativas, acertos, taxa_acerto")
        .eq("campanha_id", campanhaId);
      if (error) throw error;
      return (data ?? []) as LinhaLacuna[];
    },
  });
}

export type DesempenhoPergunta = {
  pergunta_id: string;
  enunciado: string;
  tema_id: string;
  tentativas: number;
  acertos: number;
  taxa_acerto: number;
  alternativa_errada_mais_comum: number | null;
};

export function useDesempenhoPerguntas(campanhaId: string | null) {
  return useQuery({
    queryKey: ["desempenho-perguntas", campanhaId],
    enabled: campanhaId !== null,
    queryFn: async (): Promise<DesempenhoPergunta[]> => {
      if (!campanhaId) return [];
      const { data, error } = await supabase
        .from("v_desempenho_pergunta")
        .select(
          "pergunta_id, enunciado, tema_id, tentativas, acertos, taxa_acerto, alternativa_errada_mais_comum",
        )
        .eq("campanha_id", campanhaId)
        .order("taxa_acerto", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DesempenhoPergunta[];
    },
  });
}

/**
 * Números da visão geral (docs/TIME_09 §1.1). Contagens por `head: true`, que
 * traz só o total e não puxa as linhas.
 */
export function useVisaoGeral(campanhaId: string | null) {
  return useQuery({
    queryKey: ["analytics-visao-geral", campanhaId],
    enabled: campanhaId !== null,
    queryFn: async () => {
      if (!campanhaId) return null;

      const contarRespostas = async () => {
        const { count, error } = await supabase
          .from("respostas")
          .select("*", { count: "exact", head: true })
          .eq("campanha_id", campanhaId);
        if (error) throw error;
        return count ?? 0;
      };

      const contarRelatos = async (validado?: boolean) => {
        let q = supabase
          .from("relatos")
          .select("*", { count: "exact", head: true })
          .eq("campanha_id", campanhaId);
        if (validado !== undefined) q = q.eq("validado", validado);
        const { count, error } = await q;
        if (error) throw error;
        return count ?? 0;
      };

      /**
       * `progresso_licoes` não tem `campanha_id`: a ligação é pela lição. Conta
       * só as aprovadas, que é o número que o técnico quer ver.
       */
      const contarAprovadas = async () => {
        const { data: licoes, error } = await supabase
          .from("licoes")
          .select("id")
          .eq("campanha_id", campanhaId);
        if (error) throw error;
        const ids = (licoes ?? []).map((l) => l.id as string);
        if (ids.length === 0) return 0;

        const { count, error: erro } = await supabase
          .from("progresso_licoes")
          .select("*", { count: "exact", head: true })
          .in("licao_id", ids)
          .not("aprovado_em", "is", null);
        if (erro) throw erro;
        return count ?? 0;
      };

      const [respostas, relatos, relatosValidados, aprovadas] = await Promise.all([
        contarRespostas(),
        contarRelatos(),
        contarRelatos(true),
        contarAprovadas(),
      ]);

      // Taxa de acerto e participantes vêm das linhas, não de count.
      const { data: acertosData, error: erroAcertos } = await supabase
        .from("respostas")
        .select("acertou, colaborador_id")
        .eq("campanha_id", campanhaId);
      if (erroAcertos) throw erroAcertos;

      const linhas = acertosData ?? [];
      const certas = linhas.filter((l) => l.acertou).length;

      const { count: colaboradores } = await supabase
        .from("colaboradores")
        .select("*", { count: "exact", head: true })
        .eq("ativo", true);

      return {
        respostas,
        relatos,
        relatosValidados,
        licoesAprovadas: aprovadas,
        taxaAcerto: linhas.length > 0 ? certas / linhas.length : 0,
        participantes: new Set(linhas.map((l) => l.colaborador_id)).size,
        colaboradoresAtivos: colaboradores ?? 0,
      };
    },
  });
}

/** As 5 perguntas mais erradas de um setor e tema (gaveta do mapa de lacunas). */
export function usePerguntasMaisErradas(campanhaId: string | null, temaId: string | null) {
  return useQuery({
    queryKey: ["mais-erradas", campanhaId, temaId],
    enabled: campanhaId !== null && temaId !== null,
    queryFn: async (): Promise<DesempenhoPergunta[]> => {
      if (!campanhaId || !temaId) return [];
      const { data, error } = await supabase
        .from("v_desempenho_pergunta")
        .select(
          "pergunta_id, enunciado, tema_id, tentativas, acertos, taxa_acerto, alternativa_errada_mais_comum",
        )
        .eq("campanha_id", campanhaId)
        .eq("tema_id", temaId)
        .order("taxa_acerto", { ascending: true })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as DesempenhoPergunta[];
    },
  });
}
