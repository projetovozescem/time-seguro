import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, KeyRound, Loader2, MessageSquareText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { mensagem } from "@/lib/mensagens";
import { mensagemDeAcesso } from "@/lib/cadastro";

type Resposta = { ok: boolean; pin?: string; motivo?: string };

/**
 * PIN fixo de um colaborador, para o gestor entregar a ele.
 *
 * O PIN NÃO vem na lista de pessoas: só esta consulta o devolve, e cada
 * consulta fica registrada no banco (`acessos_pin`). Por isso a busca só roda
 * quando o diálogo abre, e nada fica em cache depois que fecha.
 */
export function DialogoDoPin({
  colaborador,
  empresaCodigo,
  podeReemitir,
  aoFechar,
}: {
  colaborador: { id: string; nome: string; matricula: string };
  empresaCodigo: string;
  podeReemitir: boolean;
  aoFechar: () => void;
}) {
  const [reemitido, setReemitido] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [reemitindo, setReemitindo] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["pin-do-colaborador", colaborador.id],
    gcTime: 0,
    staleTime: 0,
    queryFn: async (): Promise<Resposta> => {
      const { data, error } = await supabase.rpc("tecnico_ver_pin", {
        p_colaborador: colaborador.id,
      });
      if (error) return { ok: false, motivo: "acesso_negado" };
      return data as unknown as Resposta;
    },
  });

  const pin = reemitido ?? (data?.ok ? (data.pin ?? null) : null);
  const origem = typeof window === "undefined" ? "" : window.location.origin;

  async function copiar(texto: string, aviso: string) {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(aviso);
    } catch {
      toast.error("Não consegui copiar. Selecione e copie à mão.");
    }
  }

  async function reemitir() {
    setReemitindo(true);
    const { data: r, error } = await supabase.rpc("tecnico_reemitir_pin", {
      p_colaborador: colaborador.id,
    });
    setReemitindo(false);
    setConfirmando(false);

    const resposta = r as unknown as Resposta | null;
    if (error || !resposta?.ok || !resposta.pin) {
      toast.error(
        resposta?.motivo ? mensagem(resposta.motivo) : "Não foi possível reemitir o PIN.",
      );
      return;
    }
    setReemitido(resposta.pin);
    toast.success("PIN reemitido. O número antigo deixou de valer e a sessão foi encerrada.");
  }

  return (
    <>
      <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-marinho">
              <KeyRound className="size-5" aria-hidden />
              PIN de {colaborador.nome}
            </DialogTitle>
          </DialogHeader>

          {isLoading && (
            <p className="flex items-center gap-2 text-sm text-texto-suave">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Buscando…
            </p>
          )}

          {!isLoading && !pin && (
            <p className="rounded-xl bg-vermelho/10 p-3 text-sm text-vermelho">
              {mensagem(data?.motivo)}
            </p>
          )}

          {pin && (
            <div className="flex flex-col gap-3">
              <div className="rounded-2xl bg-marinho px-4 py-5 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-amarelo">
                  Matrícula {colaborador.matricula}
                </p>
                <p
                  className="mt-1 font-mono text-5xl font-extrabold tracking-[0.3em] text-white"
                  aria-label={`PIN ${pin.split("").join(" ")}`}
                >
                  {pin}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void copiar(pin, "PIN copiado.")}>
                  <Copy className="size-4" aria-hidden />
                  Copiar PIN
                </Button>
                <Button
                  onClick={() =>
                    void copiar(
                      mensagemDeAcesso({
                        nome: colaborador.nome,
                        matricula: colaborador.matricula,
                        pin,
                        empresaCodigo,
                        origem,
                      }),
                      "Mensagem copiada. Cole no WhatsApp ou no e-mail.",
                    )
                  }
                >
                  <MessageSquareText className="size-4" aria-hidden />
                  Copiar mensagem pronta
                </Button>
              </div>

              <p className="text-xs text-texto-suave">
                Este número é <strong>fixo</strong>: o colaborador não consegue trocar. Cada
                consulta fica registrada (quem viu, de quem e quando). Mande só para a própria
                pessoa.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            {podeReemitir && pin ? (
              <Button
                variant="ghost"
                onClick={() => setConfirmando(true)}
                className="text-vermelho"
              >
                <RefreshCw className="size-4" aria-hidden />
                Reemitir (vazou)
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={aoFechar}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reemitir o PIN de {colaborador.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Só use se o PIN vazou. O número atual deixa de valer, a pessoa é desconectada do app e
              você precisará enviar o novo PIN. A ação fica registrada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void reemitir()} disabled={reemitindo}>
              Reemitir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
