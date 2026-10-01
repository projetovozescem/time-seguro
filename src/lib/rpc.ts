import { supabase } from "@/integrations/supabase/client";
import { sessao } from "@/lib/sessao";
import { ehPendencia, PENDENCIAS } from "@/lib/mensagens";

/**
 * PENDENTE: enquanto `src/lib/database.types.ts` não for gerado contra o projeto
 * de desenvolvimento (`npx supabase gen types typescript --linked`, docs/TIME_02
 * §1.5), o cliente ainda carrega o `Database` do V.O.Z.E.S. e não conhece os
 * nomes das RPCs `colaborador_*`. Este alias isola o ponto exato a remover:
 * quando os tipos forem gerados, troque `chamar` por `supabase.rpc` e o
 * TypeScript volta a validar nome e argumentos de cada função.
 */
const chamar = supabase.rpc as unknown as (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message?: string } | null }>;

/**
 * Chamada única para as RPCs do app do colaborador (docs/TIME_03 §3).
 *
 * O app NUNCA lê tabela: toda leitura e escrita passa por uma função
 * `colaborador_*`, e o token da sessão vai sempre como `p_token`.
 *
 * Dois desvios automáticos:
 * - exceção `sessao_invalida` → limpa o token e volta ao login;
 * - resposta `{ ok: false, motivo: 'trocar_pin' | 'aceitar_lgpd' }` → manda para
 *   a tela da pendência, porque sem resolvê-la nada mais funciona.
 */
export async function rpcApp<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const token = sessao.token();

  const { data, error } = await chamar(fn, { p_token: token, ...args });

  if (error) {
    if (error.message?.includes("sessao_invalida")) {
      sessao.sair();
      irPara("/app/entrar?expirou=1");
    }
    throw error;
  }

  const motivo = extrairPendencia(data);
  if (motivo) irPara(PENDENCIAS[motivo]);

  return data as T;
}

/** Pendência de login embutida numa resposta `{ ok: false, motivo }`. */
function extrairPendencia(data: unknown): "trocar_pin" | "aceitar_lgpd" | null {
  if (!data || typeof data !== "object") return null;
  const resposta = data as { ok?: boolean; motivo?: unknown };
  if (resposta.ok !== false) return null;
  const motivo = resposta.motivo;
  return typeof motivo === "string" && ehPendencia(motivo) ? motivo : null;
}

function irPara(destino: string): void {
  if (typeof window === "undefined") return;
  window.location.href = destino;
}

/**
 * RPCs públicas: Canal de Respeito, verificação de certificado e dados da
 * empresa na tela de login (docs/TIME_02 §3).
 *
 * Nunca envia `p_token` — é o que garante o anonimato do Canal de Respeito
 * (docs/TIME_03 §6). Não trocar por `rpcApp`.
 */
export async function rpcPublica<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await chamar(fn, args);
  if (error) throw error;
  return data as T;
}
