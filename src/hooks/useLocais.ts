import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Locais da empresa (docs/TIME_04 §7). O RLS limita à própria empresa; a
 * consulta não filtra por `ativo` porque relato antigo pode apontar para local
 * desativado, e o nome dele ainda precisa aparecer no analytics.
 */
export function useLocais() {
  return useQuery({
    queryKey: ["locais"],
    queryFn: async (): Promise<{ id: string; nome: string; setor_id: string }[]> => {
      const { data, error } = await supabase
        .from("locais")
        .select("id, nome, setor_id")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string; setor_id: string }[];
    },
  });
}
