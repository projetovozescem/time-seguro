import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StatusEvento, TipoEvento } from "@/lib/eventos";

export type Evento = {
  id: string;
  campanha_id: string | null;
  tipo: TipoEvento;
  titulo: string;
  descricao: string | null;
  setor_id: string | null;
  inicio: string;
  fim: string;
  pontos: number;
  status: StatusEvento;
};

export type Setor = { id: string; nome: string };

export function useSetores() {
  return useQuery({
    queryKey: ["setores"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Setor[]> => {
      const { data, error } = await supabase.from("setores").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useEventos() {
  return useQuery({
    queryKey: ["eventos"],
    queryFn: async (): Promise<Evento[]> => {
      const { data, error } = await supabase
        .from("eventos")
        .select("id, campanha_id, tipo, titulo, descricao, setor_id, inicio, fim, pontos, status")
        .order("inicio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Evento[];
    },
  });
}

export type Presenca = {
  criado_em: string;
  colaboradores: { nome: string; matricula: string; setores: { nome: string } | null } | null;
};

/**
 * Lista de presença de um evento (docs/TIME_04 §8). O RLS só devolve os
 * check-ins da própria empresa.
 */
export function usePresenca(eventoId: string | null) {
  return useQuery({
    queryKey: ["presenca", eventoId],
    enabled: eventoId !== null,
    queryFn: async (): Promise<Presenca[]> => {
      if (!eventoId) return [];
      const { data, error } = await supabase
        .from("checkins")
        .select("criado_em, colaboradores ( nome, matricula, setores ( nome ) )")
        .eq("evento_id", eventoId)
        .order("criado_em");
      if (error) throw error;
      return (data ?? []) as unknown as Presenca[];
    },
  });
}
