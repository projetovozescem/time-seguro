import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePerfil } from "@/hooks/usePerfil";
import {
  STATUS_DO_COMITE,
  corDoStatusDenuncia,
  rotuloDaCategoriaDenuncia,
  rotuloDoStatusDenuncia,
  type StatusDenuncia,
} from "@/lib/respeito";
import { formatarData } from "@/lib/datas";
import { mensagem } from "@/lib/mensagens";

type Denuncia = {
  id: string;
  protocolo: string;
  categoria: string;
  descricao: string;
  local_aproximado: string | null;
  periodo_aproximado: string | null;
  quer_retorno: boolean;
  status: StatusDenuncia;
  recebida_em: string;
};

type MensagemDenuncia = {
  id: string;
  autor: string;
  mensagem: string;
  /** `date`, sem hora: faz parte do anonimato (docs/TIME_03 §6). */
  enviada_em: string;
};

/**
 * O RLS já limita a leitura a quem tem `comite_assedio` (policy
 * `denuncias_comite`). Esta consulta devolve lista vazia para os demais — não é
 * a tela que protege.
 */
function useDenuncias() {
  return useQuery({
    queryKey: ["denuncias"],
    queryFn: async (): Promise<Denuncia[]> => {
      const { data, error } = await supabase
        .from("denuncias_assedio")
        .select(
          "id, protocolo, categoria, descricao, local_aproximado, periodo_aproximado, quer_retorno, status, recebida_em",
        )
        .order("recebida_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Denuncia[];
    },
  });
}

function useMensagens(denunciaId: string | null) {
  return useQuery({
    queryKey: ["denuncia-mensagens", denunciaId],
    enabled: denunciaId !== null,
    queryFn: async (): Promise<MensagemDenuncia[]> => {
      if (!denunciaId) return [];
      const { data, error } = await supabase
        .from("denuncia_mensagens")
        .select("id, autor, mensagem, enviada_em")
        .eq("denuncia_id", denunciaId)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as MensagemDenuncia[];
    },
  });
}

/** Canal de Respeito no painel — só para `comite_assedio` (docs/TIME_04 §10). */
function Respeito() {
  const { data: perfil, isLoading: carregandoPerfil } = usePerfil();
  const { data: denuncias = [], isLoading } = useDenuncias();
  const queryClient = useQueryClient();

  const [aberta, setAberta] = useState<string | null>(null);
  const [resposta, setResposta] = useState("");
  const [novoStatus, setNovoStatus] = useState<StatusDenuncia>("em_apuracao");
  const [enviando, setEnviando] = useState(false);

  const { data: mensagens = [] } = useMensagens(aberta);
  const selecionada = denuncias.find((d) => d.id === aberta) ?? null;

  // Guard de experiência; a barreira real é a policy do RLS.
  if (!carregandoPerfil && perfil && !perfil.comite_assedio) {
    return (
      <div className="rounded-2xl border border-borda bg-superficie p-6">
        <p className="text-sm text-texto">
          Esta área é exclusiva do comitê de prevenção ao assédio.
        </p>
      </div>
    );
  }

  async function responder() {
    if (!selecionada || !resposta.trim()) return;
    setEnviando(true);
    const { data, error } = await supabase.rpc("comite_responder_denuncia", {
      p_denuncia: selecionada.id,
      p_mensagem: resposta.trim(),
      p_status: novoStatus,
    });
    setEnviando(false);

    const r = data as { ok?: boolean; motivo?: string } | null;
    if (error || !r?.ok) {
      toast.error(r?.motivo ? mensagem(r.motivo) : "Não foi possível enviar a resposta.");
      return;
    }
    toast.success("Resposta registrada.");
    setResposta("");
    await queryClient.invalidateQueries({ queryKey: ["denuncias"] });
    await queryClient.invalidateQueries({ queryKey: ["denuncia-mensagens", selecionada.id] });
  }

  const semResposta = denuncias.filter((d) => d.status === "recebida").length;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl bg-respeito px-4 py-3 text-sm font-medium text-white">
        <Lock className="mr-1.5 inline size-4" aria-hidden />
        Área sigilosa. As informações aqui não podem ser compartilhadas fora do comitê.
      </div>

      <header>
        <h1 className="sr-only">Canal de Respeito</h1>
        <p className="text-sm text-texto-suave">
          {isLoading
            ? "Carregando…"
            : `${denuncias.length} denúncia(s)${semResposta > 0 ? ` · ${semResposta} sem resposta` : ""}`}
        </p>
      </header>

      {!isLoading && denuncias.length === 0 && (
        <p className="rounded-2xl border border-borda bg-superficie p-6 text-center text-sm text-texto-suave">
          Nenhuma denúncia registrada.
        </p>
      )}

      {/* Grade de cards (era uma lista estreita ao lado do detalhe). */}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {denuncias.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => setAberta(d.id)}
              className={`flex h-full w-full flex-col gap-2 rounded-2xl border border-t-4 border-borda bg-superficie p-4 text-left transition-shadow hover:shadow-md ${
                d.status === "recebida" ? "border-t-respeito" : "border-t-borda"
              }`}
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-sm font-bold text-texto">{d.protocolo}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${corDoStatusDenuncia(d.status)}`}
                >
                  {rotuloDoStatusDenuncia(d.status)}
                </span>
              </span>
              <span className="text-sm font-semibold text-respeito">
                {rotuloDaCategoriaDenuncia(d.categoria)}
              </span>
              <span className="line-clamp-3 text-sm text-texto">{d.descricao}</span>
              <span className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-texto-suave">
                <span>Recebida em {formatarData(d.recebida_em)}</span>
                <span className={d.quer_retorno ? "font-semibold text-respeito" : ""}>
                  {d.quer_retorno ? "quer retorno" : "sem retorno"}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={selecionada !== null} onOpenChange={(aberto) => !aberto && setAberta(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="sr-only">Denúncia {selecionada?.protocolo}</DialogTitle>
          </DialogHeader>
          {selecionada && (
            <section className="flex flex-col gap-4">
              <div>
                <p className="font-mono text-lg font-bold text-texto">{selecionada.protocolo}</p>
                <p className="text-sm text-texto-suave">
                  {rotuloDaCategoriaDenuncia(selecionada.categoria)} · recebida em{" "}
                  {formatarData(selecionada.recebida_em)}
                </p>
              </div>

              <p className="whitespace-pre-line rounded-xl bg-fundo p-4 text-sm text-texto">
                {selecionada.descricao}
              </p>

              <dl className="grid gap-1 text-sm text-texto-suave">
                <div className="flex gap-2">
                  <dt>Local:</dt>
                  <dd className="text-texto">{selecionada.local_aproximado ?? "não informado"}</dd>
                </div>
                <div className="flex gap-2">
                  <dt>Período:</dt>
                  <dd className="text-texto">
                    {selecionada.periodo_aproximado ?? "não informado"}
                  </dd>
                </div>
              </dl>

              {mensagens.length > 0 && (
                <ol className="flex flex-col gap-2">
                  {mensagens.map((m) => (
                    <li
                      key={m.id}
                      className={`rounded-xl p-3 text-sm ${
                        m.autor === "comite" ? "bg-respeito/10" : "bg-fundo"
                      }`}
                    >
                      <p className="text-xs font-semibold text-texto-suave">
                        {m.autor === "comite" ? "Comitê" : "Denunciante"} ·{" "}
                        {formatarData(m.enviada_em)}
                      </p>
                      <p className="mt-1 text-texto">{m.mensagem}</p>
                    </li>
                  ))}
                </ol>
              )}

              {selecionada.quer_retorno ? (
                <div className="flex flex-col gap-3 border-t border-borda pt-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="resposta">Resposta ao denunciante</Label>
                    <Textarea
                      id="resposta"
                      rows={3}
                      value={resposta}
                      onChange={(e) => setResposta(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="status-denuncia">Status</Label>
                    <select
                      id="status-denuncia"
                      value={novoStatus}
                      onChange={(e) => setNovoStatus(e.target.value as StatusDenuncia)}
                      className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
                    >
                      {STATUS_DO_COMITE.map((s) => (
                        <option key={s} value={s}>
                          {rotuloDoStatusDenuncia(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    onClick={responder}
                    disabled={!resposta.trim() || enviando}
                    className="min-h-12 self-start bg-respeito hover:bg-respeito/90"
                  >
                    {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
                    Enviar resposta
                  </Button>
                </div>
              ) : (
                <p className="border-t border-borda pt-4 text-sm text-texto-suave">
                  Esta pessoa não pediu retorno. Registre o andamento internamente.
                </p>
              )}
            </section>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/_protegido/painel/respeito")({
  component: Respeito,
});
