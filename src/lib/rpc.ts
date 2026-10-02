import { supabase } from "@/integrations/supabase/client";
import { sessao } from "@/lib/sessao";
import { ehPendencia, PENDENCIAS } from "@/lib/mensagens";
import type { Database } from "@/lib/database.types";

/** Nomes de RPC que realmente existem no banco, vindos dos tipos gerados. */
type NomeRpc = keyof Database["public"]["Functions"];

/** RPCs do app do colaborador: todas recebem `p_token` (menos o login, que e publico). */
type RpcDoApp = Exclude<Extract<NomeRpc, `colaborador_${string}`>, "colaborador_login">;

/**
 * RPCs chamáveis sem token (docs/TIME_02 §3). Lista explícita, não derivada:
 * é o que impede uma chamada do Canal de Respeito de ir por `rpcApp` e levar
 * o token por descuido (docs/TIME_03 §6).
 */
type RpcPublica =
  | "empresa_publica"
  // Antes de existir sessao nao ha token para mandar: o login e o autocadastro
  // sao publicos. (O login ia por `rpcApp`, que acrescenta `p_token`, e a
  // funcao nao tem esse parametro: ele nunca funcionou pela interface.)
  | "colaborador_login"
  | "publico_setores_da_empresa"
  | "publico_solicitar_cadastro"
  | "registrar_denuncia_assedio"
  | "consultar_denuncia"
  | "responder_denuncia_denunciante"
  | "verificar_certificado";

/**
 * Chamada única para as RPCs do app do colaborador (docs/TIME_03 §3).
 *
 * O app NUNCA lê tabela: toda leitura e escrita passa por uma função
 * `colaborador_*`, e o token da sessão vai sempre como `p_token`.
 *
 * Dois desvios automáticos:
 * - exceção `sessao_invalida` → limpa o token e volta ao login;
 * - resposta `{ ok: false, motivo: 'aceitar_lgpd' }` → manda para
 *   a tela do termo, porque sem resolvê-la nada mais funciona.
 */
export async function rpcApp<T>(fn: RpcDoApp, args: Record<string, unknown> = {}): Promise<T> {
  const token = sessao.token();

  const { data, error } = await supabase.rpc(fn, { p_token: token, ...args } as never);

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
function extrairPendencia(data: unknown): "aceitar_lgpd" | null {
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
export async function rpcPublica<T>(
  fn: RpcPublica,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args as never);
  if (error) throw error;
  return data as T;
}
