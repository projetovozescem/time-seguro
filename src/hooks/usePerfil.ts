import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Papéis do painel, do mais ao menos poderoso (docs/TIME_01 §3). */
export const PAPEIS = ["admin", "tecnico", "cipa"] as const;
export type Papel = (typeof PAPEIS)[number];

export type Perfil = {
  nome: string;
  papel: Papel;
  /** Flag combinável: único grupo que lê o Canal de Respeito. */
  comite_assedio: boolean;
  empresa: { id: string; nome: string; codigo: string };
};

/** Hierarquia: quem pode `tecnico` também pode `cipa`. */
const FORCA: Record<Papel, number> = { cipa: 0, tecnico: 1, admin: 2 };

/**
 * Se o papel atende ao mínimo exigido pela tela (docs/TIME_04 §1).
 * É só experiência de uso — a barreira real é o RLS e as RPCs.
 */
export function podeAcessar(papel: Papel | undefined, minimo: Papel): boolean {
  if (!papel) return false;
  return FORCA[papel] >= FORCA[minimo];
}

/**
 * Perfil do técnico logado. Sem linha em `perfis_tecnicos`, devolve `null`:
 * o usuário existe no Auth mas não foi vinculado a nenhuma empresa, e o painel
 * mostra a tela de aviso (docs/TIME_03 §2).
 */
export function usePerfil() {
  return useQuery({
    queryKey: ["perfil"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Perfil | null> => {
      // O RLS de `perfis_tecnicos` libera TODOS os perfis da empresa (o admin
      // precisa listar a equipe em Configuracoes), nao so o proprio. Sem filtrar
      // pelo usuario, `maybeSingle()` falha assim que a empresa tem 2 perfis e o
      // menu inteiro some.
      const { data: sessao } = await supabase.auth.getSession();
      const userId = sessao.session?.user.id;
      if (!userId) return null;

      const { data, error } = await supabase
        .from("perfis_tecnicos")
        .select("nome, papel, comite_assedio, empresas ( id, nome, codigo )")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      // O filtro acima garante a linha do proprio usuario; o join traz a empresa dele.
      const empresa = data.empresas as unknown as Perfil["empresa"] | null;
      if (!empresa) return null;

      return {
        nome: data.nome,
        papel: data.papel as Papel,
        comite_assedio: data.comite_assedio,
        empresa,
      };
    },
  });
}

/** Campanha ativa da empresa, para o chip do topo (docs/TIME_04 §2). */
export function useCampanhaAtiva() {
  return useQuery({
    queryKey: ["campanha-ativa"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campanhas")
        .select("id, nome, inicio, fim, premiacao, ranking_visivel")
        .eq("status", "ativa")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// `diasRestantes` vive em lib/datas.ts: data pura nao passa por `new Date(iso)`.
export { diasRestantes } from "@/lib/datas";
