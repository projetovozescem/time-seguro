import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Tema = {
  id: string;
  slug: string;
  nome: string;
  icone: string;
  empresa_id: string | null;
};

export type Pergunta = {
  id: string;
  empresa_id: string | null;
  tema_id: string;
  enunciado: string;
  alternativas: string[];
  correta: number;
  explicacao: string | null;
  dificuldade: number;
  status: "ativa" | "inativa";
  origem: "manual" | "importacao" | "seed";
};

export type Desempenho = { tentativas: number; acertos: number; taxa_acerto: number };

/**
 * Temas visíveis: os globais (`empresa_id` nulo) e os da própria empresa.
 * O RLS já faz esse corte; a ordenação põe os da empresa primeiro.
 */
export function useTemas() {
  return useQuery({
    queryKey: ["temas"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Tema[]> => {
      const { data, error } = await supabase
        .from("temas")
        .select("id, slug, nome, icone, empresa_id")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePerguntas() {
  return useQuery({
    queryKey: ["perguntas"],
    queryFn: async (): Promise<Pergunta[]> => {
      const { data, error } = await supabase
        .from("perguntas")
        .select(
          "id, empresa_id, tema_id, enunciado, alternativas, correta, explicacao, dificuldade, status, origem",
        )
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Pergunta[];
    },
  });
}

/**
 * Taxa de acerto por pergunta (docs/TIME_04 §5), vinda de
 * `v_desempenho_pergunta`. A view soma por campanha, então aqui as campanhas
 * são agregadas: o técnico quer saber se a pergunta é difícil, não em qual ciclo.
 */
export function useDesempenho() {
  return useQuery({
    queryKey: ["desempenho-pergunta"],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<Map<string, Desempenho>> => {
      const { data, error } = await supabase
        .from("v_desempenho_pergunta")
        .select("pergunta_id, tentativas, acertos");
      if (error) throw error;

      const porPergunta = new Map<string, Desempenho>();
      for (const linha of data ?? []) {
        const id = linha.pergunta_id as string;
        const atual = porPergunta.get(id) ?? { tentativas: 0, acertos: 0, taxa_acerto: 0 };
        atual.tentativas += linha.tentativas ?? 0;
        atual.acertos += linha.acertos ?? 0;
        atual.taxa_acerto = atual.tentativas > 0 ? atual.acertos / atual.tentativas : 0;
        porPergunta.set(id, atual);
      }
      return porPergunta;
    },
  });
}

/** Enunciados já no banco, em forma canônica, para o importador detectar duplicada. */
export function useEnunciadosExistentes() {
  return useQuery({
    queryKey: ["enunciados-existentes"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from("perguntas").select("enunciado");
      if (error) throw error;
      return (data ?? []).map((p) => p.enunciado);
    },
  });
}
