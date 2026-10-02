import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Solicitacao = {
  id: string;
  nome: string;
  matricula: string;
  email: string;
  setor_id: string | null;
  criado_em: string;
};

/** Pedidos de cadastro que ainda esperam decisão (docs: autocadastro, 0009). */
export function usePendentes() {
  return useQuery({
    queryKey: ["solicitacoes-pendentes"],
    queryFn: async (): Promise<Solicitacao[]> => {
      const { data, error } = await supabase
        .from("solicitacoes_cadastro")
        .select("id, nome, matricula, email, setor_id, criado_em")
        .eq("status", "pendente")
        .order("criado_em");
      if (error) throw error;
      return (data ?? []) as Solicitacao[];
    },
  });
}
