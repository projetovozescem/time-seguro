import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Mail, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mensagem } from "@/lib/mensagens";
import { usePendentes, type Solicitacao } from "@/hooks/usePendentes";
import { formatarData } from "@/lib/datas";
import type { Setor } from "@/hooks/useEventos";

/** Um card por pedido: o gestor confere os dados, corrige o setor e decide. */
function CardPendente({
  s,
  setores,
  aoAprovar,
}: {
  s: Solicitacao;
  setores: Setor[];
  aoAprovar?: ((colaboradorId: string, nome: string, matricula: string) => void) | undefined;
}) {
  const queryClient = useQueryClient();
  const [setorId, setSetorId] = useState(s.setor_id ?? "");
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function decidir(aprovar: boolean) {
    setEnviando(true);
    const { data, error } = await supabase.rpc("tecnico_decidir_solicitacao", {
      p_id: s.id,
      p_aprovar: aprovar,
      // Parâmetros opcionais entram só quando existem (exactOptionalPropertyTypes).
      ...(aprovar && setorId ? { p_setor: setorId } : {}),
      ...(!aprovar && motivo.trim() ? { p_motivo: motivo.trim() } : {}),
    });
    setEnviando(false);

    const r = data as unknown as { ok?: boolean; motivo?: string; colaborador_id?: string } | null;
    if (error || !r?.ok) {
      toast.error(r?.motivo ? mensagem(r.motivo) : "Não foi possível registrar a decisão.");
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["solicitacoes-pendentes"] });
    if (aprovar) {
      await queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
      await queryClient.invalidateQueries({ queryKey: ["setores"] });
      toast.success(`${s.nome} aprovado(a).`);
      if (r.colaborador_id && aoAprovar) aoAprovar(r.colaborador_id, s.nome, s.matricula);
    } else {
      toast.success("Pedido recusado.");
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
      <div>
        <p className="font-display text-base font-bold text-texto">{s.nome}</p>
        <p className="text-sm text-texto-suave">
          Matrícula <span className="font-mono font-semibold text-texto">{s.matricula}</span>
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-texto-suave">
          <Mail className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{s.email}</span>
        </p>
        <p className="mt-0.5 text-xs text-texto-suave">Pediu em {formatarData(s.criado_em)}</p>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-texto-suave">
        Setor (você pode corrigir)
        <select
          value={setorId}
          onChange={(e) => setSetorId(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-texto"
        >
          <option value="">Sem setor</option>
          {setores.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
      </label>

      {recusando ? (
        <div className="flex flex-col gap-2">
          <Input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo (opcional)"
            aria-label="Motivo da recusa"
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setRecusando(false)} disabled={enviando}>
              Voltar
            </Button>
            <Button
              onClick={() => void decidir(false)}
              disabled={enviando}
              className="bg-vermelho text-white hover:bg-vermelho/90"
            >
              {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Confirmar recusa
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button onClick={() => void decidir(true)} disabled={enviando} className="flex-1">
            {enviando ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Check className="size-4" aria-hidden />
            )}
            Aprovar
          </Button>
          <Button variant="outline" onClick={() => setRecusando(true)} disabled={enviando}>
            <X className="size-4" aria-hidden />
            Recusar
          </Button>
        </div>
      )}
    </li>
  );
}

/**
 * Aba "Pendentes" de Colaboradores. Admin, técnico e CIPA aprovam ou recusam;
 * só quem pode ver o PIN (admin e técnico) recebe `aoAprovar`, que abre o PIN
 * logo depois da aprovação para o gestor já poder enviá-lo.
 */
export function PendentesDeCadastro({
  setores,
  aoAprovar,
}: {
  setores: Setor[];
  aoAprovar?: (colaboradorId: string, nome: string, matricula: string) => void;
}) {
  const { data: pendentes = [], isLoading } = usePendentes();

  if (isLoading) return <p className="text-sm text-texto-suave">Carregando…</p>;

  if (pendentes.length === 0) {
    return (
      <p className="rounded-2xl border border-borda bg-superficie p-6 text-center text-sm text-texto-suave">
        Nenhum pedido de cadastro esperando. Quando alguém se cadastrar pelo app, aparece aqui.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {pendentes.map((s) => (
        <CardPendente key={s.id} s={s} setores={setores} aoAprovar={aoAprovar} />
      ))}
    </ul>
  );
}
