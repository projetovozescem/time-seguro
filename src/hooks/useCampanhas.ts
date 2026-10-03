import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Config, Status } from "@/lib/campanha";

export type Campanha = {
  id: string;
  empresa_id: string;
  nome: string;
  descricao: string | null;
  inicio: string;
  fim: string;
  status: Status;
  premiacao: string | null;
  ranking_visivel: boolean;
  perguntas_por_dia: number;
  config: Config | null;
  encerrada_em: string | null;
};

export type Licao = {
  id: string;
  campanha_id: string;
  tema_id: string;
  titulo: string;
  conteudo_md: string | null;
  video_url: string | null;
  carga_minutos: number;
  nota_minima: number;
  obrigatoria: boolean;
  publicada: boolean;
  ordem: number;
};

export function useCampanhas() {
  return useQuery({
    queryKey: ["campanhas"],
    queryFn: async (): Promise<Campanha[]> => {
      const { data, error } = await supabase
        .from("campanhas")
        .select(
          "id, empresa_id, nome, descricao, inicio, fim, status, premiacao, ranking_visivel, perguntas_por_dia, config, encerrada_em",
        )
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Campanha[];
    },
  });
}

export function useCampanha(id: string) {
  return useQuery({
    queryKey: ["campanha", id],
    queryFn: async (): Promise<Campanha | null> => {
      const { data, error } = await supabase
        .from("campanhas")
        .select(
          "id, empresa_id, nome, descricao, inicio, fim, status, premiacao, ranking_visivel, perguntas_por_dia, config, encerrada_em",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Campanha | null;
    },
  });
}

/** Temas vinculados a uma campanha — é o pool do quiz diário. */
/** Cor do primeiro tema de cada campanha (borda do card). */
export function useCoresDasCampanhas() {
  return useQuery({
    queryKey: ["campanha-cores"],
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase
        .from("campanha_temas")
        .select("campanha_id, temas ( cor )");
      if (error) throw error;
      const cores = new Map<string, string>();
      for (const l of data ?? []) {
        const cor = (l.temas as { cor: string } | null)?.cor;
        if (cor && !cores.has(l.campanha_id)) cores.set(l.campanha_id, cor);
      }
      return cores;
    },
  });
}

export function useTemasDaCampanha(campanhaId: string) {
  return useQuery({
    queryKey: ["campanha-temas", campanhaId],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("campanha_temas")
        .select("tema_id")
        .eq("campanha_id", campanhaId);
      if (error) throw error;
      return (data ?? []).map((t) => t.tema_id as string);
    },
  });
}

export function useLicoes(campanhaId: string) {
  return useQuery({
    queryKey: ["licoes", campanhaId],
    queryFn: async (): Promise<Licao[]> => {
      const { data, error } = await supabase
        .from("licoes")
        .select(
          "id, campanha_id, tema_id, titulo, conteudo_md, video_url, carga_minutos, nota_minima, obrigatoria, publicada, ordem",
        )
        .eq("campanha_id", campanhaId)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as Licao[];
    },
  });
}

/** Perguntas escolhidas para a avaliação de uma lição. */
export function usePerguntasDaLicao(licaoId: string | null) {
  return useQuery({
    queryKey: ["licao-perguntas", licaoId],
    enabled: licaoId !== null,
    queryFn: async (): Promise<string[]> => {
      if (!licaoId) return [];
      const { data, error } = await supabase
        .from("licao_perguntas")
        .select("pergunta_id")
        .eq("licao_id", licaoId);
      if (error) throw error;
      return (data ?? []).map((p) => p.pergunta_id as string);
    },
  });
}

/** Números da aba "Visão geral" (docs/TIME_04 §4). */
export function useNumerosDaCampanha(campanhaId: string) {
  return useQuery({
    queryKey: ["campanha-numeros", campanhaId],
    queryFn: async () => {
      const contar = async (tabela: "respostas" | "relatos") => {
        const { count, error } = await supabase
          .from(tabela)
          .select("*", { count: "exact", head: true })
          .eq("campanha_id", campanhaId);
        if (error) throw error;
        return count ?? 0;
      };

      // `checkins` não tem campanha_id: a ligação é pelo evento.
      const contarCheckins = async () => {
        const { data: eventos, error } = await supabase
          .from("eventos")
          .select("id")
          .eq("campanha_id", campanhaId);
        if (error) throw error;
        const ids = (eventos ?? []).map((e) => e.id as string);
        if (ids.length === 0) return 0;

        const { count, error: erro } = await supabase
          .from("checkins")
          .select("*", { count: "exact", head: true })
          .in("evento_id", ids);
        if (erro) throw erro;
        return count ?? 0;
      };

      const [respostas, relatos, checkins] = await Promise.all([
        contar("respostas"),
        contar("relatos"),
        contarCheckins(),
      ]);

      const { data: pontos, error: erroPontos } = await supabase
        .from("pontos_lancamentos")
        .select("pontos, colaborador_id")
        .eq("campanha_id", campanhaId);
      if (erroPontos) throw erroPontos;

      return {
        respostas,
        relatos,
        checkins,
        pontos: (pontos ?? []).reduce((soma, p) => soma + (p.pontos ?? 0), 0),
        participantes: new Set((pontos ?? []).map((p) => p.colaborador_id)).size,
      };
    },
  });
}
