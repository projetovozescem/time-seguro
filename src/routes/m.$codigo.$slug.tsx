import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogIn, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rpcPublica } from "@/lib/rpc";
import { mensagem } from "@/lib/mensagens";
import { ICONES_MATERIAL, lerBlocos, type BlocoMaterial } from "@/lib/materiais";

type Resposta =
  | {
      ok: true;
      empresa: string;
      codigo: string;
      titulo: string;
      subtitulo: string | null;
      blocos: unknown;
    }
  | { ok: false; motivo: string };

type Material = {
  empresa: string;
  codigo: string;
  titulo: string;
  subtitulo: string | null;
  blocos: BlocoMaterial[];
};

/**
 * Material informativo — página PÚBLICA, destino do QR Code do cartaz.
 * Sem login e sem token: lê só pela RPC `material_publico` (CLAUDE.md regra 4).
 */
function PaginaMaterial() {
  const { codigo, slug } = Route.useParams();
  const [material, setMaterial] = useState<Material | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    rpcPublica<Resposta>("material_publico", { p_empresa_codigo: codigo, p_slug: slug })
      .then((r) => {
        if (r.ok) setMaterial({ ...r, blocos: lerBlocos(r.blocos) });
        else setErro(r.motivo);
      })
      .catch(() => setErro("material_nao_encontrado"));
  }, [codigo, slug]);

  return (
    <div className="min-h-screen bg-fundo">
      <div className="faixa-seguranca h-2" />
      <header className="bg-marinho px-5 py-6 text-white">
        <div className="mx-auto flex max-w-xl flex-col gap-1">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/75">
            {material?.empresa ?? "T.I.M.E. Seguro"}
          </p>
          <h1 className="font-display text-3xl font-extrabold text-amarelo">
            {material?.titulo ?? "Material de segurança"}
          </h1>
          {material?.subtitulo && <p className="text-white/90">{material.subtitulo}</p>}
        </div>
      </header>

      <main className="mx-auto flex max-w-xl flex-col gap-3 px-5 py-6">
        {!material && !erro && (
          <p className="flex items-center gap-2 text-texto-suave">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Carregando…
          </p>
        )}

        {erro && <p className="rounded-2xl bg-superficie p-5 text-texto">{mensagem(erro)}</p>}

        {material?.blocos.map((b, i) => {
          const Icone = ICONES_MATERIAL[b.icone];
          return (
            <section
              key={i}
              className="flex gap-3 rounded-2xl border border-borda bg-superficie p-4"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amarelo/25 text-marinho">
                <Icone className="size-6" aria-hidden />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-marinho">{b.titulo}</h2>
                <p className="mt-0.5 text-texto">{b.texto}</p>
              </div>
            </section>
          );
        })}

        {material && (
          <div className="mt-2 flex flex-col gap-2">
            <Button asChild size="lg" className="h-12 text-base">
              <Link to="/app/entrar" search={{ empresa: material.codigo }}>
                <LogIn className="size-5" aria-hidden /> Entrar no app e responder o quiz
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 text-base">
              <Link to="/respeito/$codigo" params={{ codigo: material.codigo }}>
                <ShieldCheck className="size-5" aria-hidden /> Canal de Respeito (anônimo)
              </Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

export const Route = createFileRoute("/m/$codigo/$slug")({
  component: PaginaMaterial,
});
