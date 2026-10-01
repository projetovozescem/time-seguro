import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Camera, Check, Loader2, TriangleAlert, X } from "lucide-react";
import { AlunoLayout } from "@/components/layout/AlunoLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { rpcApp } from "@/lib/rpc";
import { sessao } from "@/lib/sessao";
import { mensagem } from "@/lib/mensagens";
import {
  CATEGORIAS,
  MINIMO_DESCRICAO,
  comprimirImagem,
  descricaoValida,
  type Categoria,
} from "@/lib/relatos";

type Criacao = { ok: true; relato_id: string } | { ok: false; motivo: string };
type DadosLocal =
  { ok: true; id: string; nome: string; setor: string | null } | { ok: false; motivo: string };

/**
 * Enviar relato de risco (docs/TIME_05 §7). Passo a passo numa tela só: o que
 * viu, onde, o que aconteceu, foto opcional.
 */
function Relatar() {
  const navigate = useNavigate();
  const { local: localDoQr } = Route.useSearch();

  const [categoria, setCategoria] = useState<Categoria | null>(null);
  const [local, setLocal] = useState<DadosLocal | null>(null);
  const [descricao, setDescricao] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState<{ comFoto: boolean; fotoFalhou: boolean } | null>(null);

  useEffect(() => {
    if (!sessao.token()) {
      void navigate({ to: "/app/entrar", replace: true });
    }
  }, [navigate]);

  // Local vindo do QR Code colado na parede: vem preenchido e travado.
  useEffect(() => {
    if (!localDoQr) return;
    rpcApp<DadosLocal>("colaborador_local", { p_local: localDoQr })
      .then(setLocal)
      .catch(() => setLocal(null));
  }, [localDoQr]);

  function escolherFoto(arquivo: File | null) {
    setFoto(arquivo);
    if (previa) URL.revokeObjectURL(previa);
    setPrevia(arquivo ? URL.createObjectURL(arquivo) : null);
  }

  /**
   * Envia a foto pela Edge Function (docs/TIME_03 §5): o colaborador não é
   * usuário do Auth, então não pode ter policy de upload. A função valida o
   * token e devolve uma URL assinada só para aquele relato.
   *
   * Falha de foto NÃO invalida o relato — ele já está salvo.
   */
  async function enviarFoto(relatoId: string): Promise<boolean> {
    if (!foto) return true;
    try {
      const comprimida = await comprimirImagem(foto);
      const { data } = await supabase.functions.invoke("relato-upload-url", {
        body: { token: sessao.token(), relato_id: relatoId },
      });
      if (!data?.ok) return false;

      const { error } = await supabase.storage
        .from("relatos-fotos")
        .uploadToSignedUrl(data.path, data.upload_token, comprimida, {
          contentType: "image/jpeg",
        });
      return !error;
    } catch {
      return false;
    }
  }

  async function enviar() {
    if (!categoria || !descricaoValida(descricao)) return;
    setEnviando(true);
    setErro(null);

    try {
      const r = await rpcApp<Criacao>("colaborador_criar_relato", {
        p_categoria: categoria,
        p_descricao: descricao.trim(),
        ...(local?.ok ? { p_local: local.id } : {}),
      });

      if (!r.ok) {
        setErro(mensagem(r.motivo));
        return;
      }

      const fotoOk = await enviarFoto(r.relato_id);
      setPronto({ comFoto: Boolean(foto), fotoFalhou: Boolean(foto) && !fotoOk });
    } catch {
      setErro("Não foi possível enviar agora. Confira a internet e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (pronto) {
    return (
      <AlunoLayout comNavegacao>
        <div className="rounded-3xl bg-superficie p-6 text-center shadow-sm">
          <Check className="mx-auto size-10 text-verde" aria-hidden />
          <p className="mt-3 font-display text-lg font-bold text-marinho">Relato enviado!</p>
          <p className="mt-2 text-sm text-texto-suave">
            O técnico vai analisar. Você ganha pontos quando ele for validado.
          </p>
          {pronto.fotoFalhou && (
            <p className="mt-3 rounded-xl bg-laranja/15 p-3 text-sm text-laranja">
              A foto não subiu, mas o relato foi salvo.
            </p>
          )}
          <div className="mt-5 flex flex-col gap-2">
            <Button asChild className="min-h-12 bg-marinho">
              <Link to="/app/relatos">Ver meus relatos</Link>
            </Button>
            <Button variant="outline" asChild className="min-h-12">
              <Link to="/app/inicio">Voltar ao início</Link>
            </Button>
          </div>
        </div>
      </AlunoLayout>
    );
  }

  const faltam = MINIMO_DESCRICAO - descricao.trim().length;

  return (
    <AlunoLayout comNavegacao>
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-vermelho/10 p-4 text-sm font-medium text-vermelho">
          <TriangleAlert className="mb-1 inline size-4" aria-hidden /> Emergência ou risco grave e
          iminente? Pare e avise o líder ou o SESMT agora. O app não substitui a comunicação
          imediata.
        </div>

        <fieldset className="rounded-3xl bg-superficie p-5 shadow-sm">
          <legend className="sr-only">O que você viu?</legend>
          <p className="font-display text-lg font-bold text-marinho">O que você viu?</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {CATEGORIAS.map((c) => (
              <button
                key={c.categoria}
                type="button"
                onClick={() => setCategoria(c.categoria)}
                aria-pressed={categoria === c.categoria}
                className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 p-3 text-center transition-colors ${
                  categoria === c.categoria
                    ? "border-marinho bg-marinho/5"
                    : "border-borda bg-superficie"
                }`}
              >
                <span className="text-2xl" aria-hidden>
                  {c.emoji}
                </span>
                <span className="font-display text-sm font-bold leading-tight text-texto">
                  {c.rotulo}
                </span>
              </button>
            ))}
          </div>
          {categoria && (
            <p className="mt-3 text-sm text-texto-suave">
              {CATEGORIAS.find((c) => c.categoria === categoria)?.ajuda}
            </p>
          )}
        </fieldset>

        {localDoQr && (
          <div className="rounded-3xl bg-superficie p-5 shadow-sm">
            <p className="font-display text-lg font-bold text-marinho">Onde?</p>
            {local?.ok ? (
              <p className="mt-1 text-sm text-texto">
                📍 {local.nome}
                {local.setor && ` · ${local.setor}`}
              </p>
            ) : (
              <p className="mt-1 text-sm text-laranja">
                {local ? mensagem(local.motivo) : "Carregando o local do QR Code…"}
              </p>
            )}
          </div>
        )}

        <div className="rounded-3xl bg-superficie p-5 shadow-sm">
          <Label htmlFor="descricao" className="font-display text-lg font-bold text-marinho">
            Conte o que aconteceu
          </Label>
          <Textarea
            id="descricao"
            rows={5}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Onde foi, o que viu, o que pode acontecer."
            className="mt-2 text-base"
          />
          <p className={`mt-1 text-xs ${faltam > 0 ? "text-laranja" : "text-texto-suave"}`}>
            {faltam > 0 ? `Escreva mais ${faltam} letra(s).` : `${descricao.trim().length} letras.`}
          </p>
        </div>

        <div className="rounded-3xl bg-superficie p-5 shadow-sm">
          <p className="font-display text-lg font-bold text-marinho">Foto (opcional)</p>
          <p className="mt-1 text-sm font-medium text-laranja">
            📷 Fotografe o risco, não as pessoas.
          </p>

          {previa ? (
            <div className="relative mt-3">
              <img src={previa} alt="Pré-visualização da foto" className="w-full rounded-xl" />
              <button
                type="button"
                onClick={() => escolherFoto(null)}
                aria-label="Remover a foto"
                className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full bg-texto/80 text-white"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : (
            <label className="mt-3 flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-borda text-sm font-medium text-texto-suave">
              <Camera className="size-5" aria-hidden />
              Tirar ou escolher foto
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => escolherFoto(e.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </label>
          )}
        </div>

        {erro && (
          <p
            role="alert"
            className="rounded-2xl bg-vermelho/10 p-4 text-sm font-medium text-vermelho"
          >
            {erro}
          </p>
        )}

        <Button
          onClick={enviar}
          disabled={!categoria || !descricaoValida(descricao) || enviando}
          className="min-h-14 bg-amarelo text-base font-bold text-texto hover:bg-amarelo/90"
        >
          {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Enviar relato
        </Button>
      </div>
    </AlunoLayout>
  );
}

/** `?local=<uuid>` vem do QR Code colado no local. */
type Busca = { local?: string };

export const Route = createFileRoute("/app/relatar")({
  validateSearch: (bruto: Record<string, unknown>): Busca => {
    const busca: Busca = {};
    if (typeof bruto["local"] === "string") busca.local = bruto["local"];
    return busca;
  },
  component: Relatar,
});
