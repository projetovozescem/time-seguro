import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Dados do Início do painel (docs/TIME_04 §3). Traz as linhas e deixa a conta
 * para `src/lib/inicio.ts`, que é testado sem navegador. Sem campanha ativa,
 * só o que não depende dela.
 */
export function useDadosDoInicio(campanhaId: string | null) {
  return useQuery({
    queryKey: ["inicio", campanhaId],
    queryFn: async () => {
      const desde = new Date(Date.now() - 31 * 86_400_000).toISOString().slice(0, 10);

      const [colabs, atividade, relatos, evento] = await Promise.all([
        supabase
          .from("colaboradores")
          .select("id, ativo, anonimizado, pin_provisorio, bloqueado_ate"),
        campanhaId
          ? supabase
              .from("atividade_diaria")
              .select("colaborador_id, dia")
              .eq("campanha_id", campanhaId)
              .gte("dia", desde)
          : Promise.resolve({ data: [], error: null }),
        supabase.from("relatos").select("status, validado, gravidade, criado_em"),
        supabase
          .from("eventos")
          .select("id, titulo, tipo, inicio")
          .eq("status", "agendado")
          .gte("inicio", new Date().toISOString())
          .order("inicio")
          .limit(1),
      ]);

      for (const r of [colabs, atividade, relatos, evento]) if (r.error) throw r.error;

      return {
        colaboradores: (colabs.data ?? []) as {
          id: string;
          ativo: boolean;
          anonimizado: boolean;
          pin_provisorio: boolean;
          bloqueado_ate: string | null;
        }[],
        atividade: (atividade.data ?? []) as { colaborador_id: string; dia: string }[],
        relatos: (relatos.data ?? []) as {
          status: string;
          validado: boolean;
          gravidade: string | null;
          criado_em: string;
        }[],
        proximoEvento: evento.data?.[0] ?? null,
      };
    },
  });
}
