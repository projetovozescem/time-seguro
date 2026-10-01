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

/**
 * Aba Relatos (docs/TIME_09 §1.4). Traz as linhas em vez de contagens porque
 * todo número da aba sai de agregação cruzada (categoria × gravidade × setor ×
 * local) e `src/lib/analytics.ts` faz isso no cliente, testável.
 *
 * O tempo "validado → resolvido" sai de `relato_historico`: `relatos` guarda só
 * `validado_em`, e a data em que virou `resolvido` está no histórico.
 */
export function useRelatosAnalytics(campanhaId: string | null) {
  return useQuery({
    queryKey: ["analytics-relatos", campanhaId],
    enabled: campanhaId !== null,
    queryFn: async () => {
      if (!campanhaId) return null;

      const { data: relatos, error } = await supabase
        .from("relatos")
        .select("id, categoria, gravidade, status, setor_id, local_id, criado_em, validado_em")
        .eq("campanha_id", campanhaId);
      if (error) throw error;

      const ids = (relatos ?? []).map((r) => r.id as string);
      let resolvidoEm = new Map<string, string>();

      if (ids.length > 0) {
        const { data: historico, error: erro } = await supabase
          .from("relato_historico")
          .select("relato_id, status, criado_em")
          .in("relato_id", ids)
          .eq("status", "resolvido")
          .order("criado_em");
        if (erro) throw erro;
        // `order` crescente + `set` deixa a PRIMEIRA vez que virou resolvido,
        // que é o que interessa se o relato reabriu e fechou de novo.
        resolvidoEm = new Map();
        for (const h of historico ?? []) {
          if (!resolvidoEm.has(h.relato_id as string)) {
            resolvidoEm.set(h.relato_id as string, h.criado_em as string);
          }
        }
      }

      return { relatos: relatos ?? [], resolvidoEm };
    },
  });
}

/**
 * Aba Engajamento (docs/TIME_09 §1.5): sequências, check-ins e horário de uso.
 *
 * `atividade_diaria` dá o dia de cada colaborador (a sequência é calculada no
 * cliente, pela mesma regra do app) e `respostas.criado_em` dá a hora.
 */
export function useEngajamento(campanhaId: string | null) {
  return useQuery({
    queryKey: ["analytics-engajamento", campanhaId],
    enabled: campanhaId !== null,
    queryFn: async () => {
      if (!campanhaId) return null;

      const [atividade, respostas, eventos, checkins, ativos] = await Promise.all([
        supabase
          .from("atividade_diaria")
          .select("colaborador_id, dia")
          .eq("campanha_id", campanhaId),
        supabase.from("respostas").select("criado_em").eq("campanha_id", campanhaId),
        supabase
          .from("eventos")
          .select("id, titulo, tipo, inicio")
          .eq("campanha_id", campanhaId)
          .order("inicio"),
        supabase.from("checkins").select("evento_id"),
        supabase.from("colaboradores").select("id").eq("ativo", true),
      ]);

      for (const r of [atividade, respostas, eventos, checkins, ativos]) {
        if (r.error) throw r.error;
      }

      const diasPorColaborador = new Map<string, string[]>();
      for (const a of atividade.data ?? []) {
        const id = a.colaborador_id as string;
        diasPorColaborador.set(id, [...(diasPorColaborador.get(id) ?? []), a.dia as string]);
      }

      const checkinsPorEvento = new Map<string, number>();
      for (const c of checkins.data ?? []) {
        const id = c.evento_id as string;
        checkinsPorEvento.set(id, (checkinsPorEvento.get(id) ?? 0) + 1);
      }

      return {
        diasPorColaborador,
        ativos: (ativos.data ?? []).map((c) => c.id as string),
        instantes: (respostas.data ?? []).map((r) => r.criado_em as string),
        eventos: eventos.data ?? [],
        checkinsPorEvento,
      };
    },
  });
}

/**
 * Comparativo trimestral (docs/TIME_09 §3): os números de 2 a 4 campanhas.
 *
 * Ressalva registrada em `memory/duvidas.md`: `ativos` é o efetivo de HOJE, não
 * o do fim de cada campanha — o banco não guarda o histórico do quadro de
 * pessoal. A tela diz isso ao lado do percentual de participação.
 */
export function useComparativo(campanhaIds: readonly string[]) {
  return useQuery({
    queryKey: ["comparativo", [...campanhaIds].sort().join(",")],
    enabled: campanhaIds.length >= 2,
    queryFn: async () => {
      const { count: ativos } = await supabase
        .from("colaboradores")
        .select("*", { count: "exact", head: true })
        .eq("ativo", true);

      const porCampanha = await Promise.all(
        campanhaIds.map(async (campanhaId) => {
          const [lacunas, respostas, relatos, resultados, rankingVivo] = await Promise.all([
            supabase
              .from("v_lacunas")
              .select("campanha_id, setor_id, tema_id, tentativas, acertos")
              .eq("campanha_id", campanhaId),
            supabase
              .from("respostas")
              .select("acertou, colaborador_id")
              .eq("campanha_id", campanhaId),
            supabase
              .from("relatos")
              .select("id, status, validado, validado_em")
              .eq("campanha_id", campanhaId),
            supabase
              .from("campanha_resultados")
              .select("setor_id, posicao, pontos")
              .eq("campanha_id", campanhaId)
              .eq("tipo", "setor")
              .order("posicao"),
            supabase
              .from("v_ranking_setor")
              .select("setor_id, total")
              .eq("campanha_id", campanhaId)
              .order("total", { ascending: false }),
          ]);

          for (const r of [lacunas, respostas, relatos, resultados, rankingVivo]) {
            if (r.error) throw r.error;
          }

          const linhasResposta = respostas.data ?? [];
          const linhasRelato = relatos.data ?? [];

          // Tempo até resolver: a data vem do histórico, não de `relatos`.
          const ids = linhasRelato.map((r) => r.id as string);
          let horas: number[] = [];
          if (ids.length > 0) {
            const { data: historico, error } = await supabase
              .from("relato_historico")
              .select("relato_id, criado_em")
              .in("relato_id", ids)
              .eq("status", "resolvido")
              .order("criado_em");
            if (error) throw error;
            const primeiro = new Map<string, string>();
            for (const h of historico ?? []) {
              if (!primeiro.has(h.relato_id as string)) {
                primeiro.set(h.relato_id as string, h.criado_em as string);
              }
            }
            horas = linhasRelato
              .map((r) => {
                const fim = primeiro.get(r.id as string);
                const inicio = r.validado_em as string | null;
                if (!fim || !inicio) return null;
                return (new Date(fim).getTime() - new Date(inicio).getTime()) / 3_600_000;
              })
              .filter((h): h is number => h !== null && Number.isFinite(h) && h >= 0);
          }

          // Campanha encerrada tem o ranking congelado; a ativa usa a view.
          const ranking =
            (resultados.data ?? []).length > 0
              ? (resultados.data ?? []).map((r) => ({
                  setor_id: r.setor_id as string | null,
                  pontos: r.pontos as number,
                }))
              : (rankingVivo.data ?? []).map((r) => ({
                  setor_id: r.setor_id as string | null,
                  pontos: (r.total ?? 0) as number,
                }));

          return {
            campanhaId,
            lacunas: (lacunas.data ?? []).map((l) => ({
              campanha_id: l.campanha_id as string,
              setor_id: l.setor_id as string,
              tema_id: l.tema_id as string,
              tentativas: l.tentativas as number,
              acertos: l.acertos as number,
            })),
            participantes: new Set(linhasResposta.map((r) => r.colaborador_id)).size,
            ativos: ativos ?? 0,
            tentativas: linhasResposta.length,
            acertos: linhasResposta.filter((r) => r.acertou).length,
            relatosRecebidos: linhasRelato.length,
            relatosValidados: linhasRelato.filter((r) => r.validado).length,
            relatosResolvidos: linhasRelato.filter((r) => r.status === "resolvido").length,
            horasAteResolver:
              horas.length > 0 ? horas.reduce((s, h) => s + h, 0) / horas.length : null,
            ranking,
          };
        }),
      );

      return porCampanha;
    },
  });
}
