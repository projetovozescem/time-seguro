import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Categoria, Gravidade, StatusRelato } from "@/lib/relatos";

export type RelatoPainel = {
  id: string;
  categoria: Categoria;
  descricao: string;
  status: StatusRelato;
  gravidade: Gravidade | null;
  validado: boolean;
  foto_path: string | null;
  criado_em: string;
  possivel_duplicado_de: string | null;
  duplicado_de: string | null;
  colaboradores: { nome: string; matricula: string } | null;
  setores: { nome: string } | null;
  locais: { nome: string } | null;
};

export type HistoricoPainel = {
  id: string;
  status: string;
  comentario: string | null;
  visivel_colaborador: boolean;
  criado_em: string;
};

export function useRelatos() {
  return useQuery({
    queryKey: ["relatos"],
    queryFn: async (): Promise<RelatoPainel[]> => {
      const { data, error } = await supabase
        .from("relatos")
        .select(
          `id, categoria, descricao, status, gravidade, validado, foto_path, criado_em,
           possivel_duplicado_de, duplicado_de,
           colaboradores ( nome, matricula ), setores ( nome ), locais ( nome )`,
        )
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RelatoPainel[];
    },
  });
}

export function useHistoricoDoRelato(relatoId: string | null) {
  return useQuery({
    queryKey: ["relato-historico", relatoId],
    enabled: relatoId !== null,
    queryFn: async (): Promise<HistoricoPainel[]> => {
      if (!relatoId) return [];
      const { data, error } = await supabase
        .from("relato_historico")
        .select("id, status, comentario, visivel_colaborador, criado_em")
        .eq("relato_id", relatoId)
        .order("criado_em");
      if (error) throw error;
      return (data ?? []) as HistoricoPainel[];
    },
  });
}

/**
 * URL assinada da foto, válida por 5 minutos (docs/TIME_02 §4). O bucket é
 * privado: sem assinatura o painel não vê a imagem.
 */
export function useFotoDoRelato(caminho: string | null) {
  return useQuery({
    queryKey: ["relato-foto", caminho],
    enabled: Boolean(caminho),
    staleTime: 4 * 60 * 1000,
    queryFn: async (): Promise<string | null> => {
      if (!caminho) return null;
      const { data, error } = await supabase.storage
        .from("relatos-fotos")
        .createSignedUrl(caminho, 300);
      if (error) return null;
      return data.signedUrl;
    },
  });
}
