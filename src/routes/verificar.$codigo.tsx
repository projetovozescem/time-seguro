import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, Loader2, XCircle } from "lucide-react";
import { TimeLogo } from "@/components/TimeLogo";
import { rpcPublica } from "@/lib/rpc";
import { formatarData } from "@/lib/datas";

type Verificacao =
  | {
      ok: true;
      titulo: string;
      tipo: string;
      /** Nome curto: "Carlos S." — o certificado público não expõe o nome completo. */
      colaborador: string | null;
      empresa: string;
      campanha: string;
      carga_minutos: number | null;
      emitido_em: string;
    }
  | { ok: false; motivo: string };

function cargaEmHoras(minutos: number | null): string | null {
  if (!minutos || minutos <= 0) return null;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${resto} minutos`;
  if (resto === 0) return `${horas} hora(s)`;
  return `${horas}h${String(resto).padStart(2, "0")}`;
}

/**
 * Verificação pública de certificado (docs/TIME_09 §5). Página aberta, sem
 * login: é o que permite a empresa ou um auditor conferir o código impresso.
 *
 * Mostra o nome curto que a RPC devolve, não o nome completo.
 */
function Verificar() {
  const { codigo } = Route.useParams();
  const [r, setR] = useState<Verificacao | null>(null);

  useEffect(() => {
    rpcPublica<Verificacao>("verificar_certificado", { p_codigo: codigo })
      .then(setR)
      .catch(() => setR({ ok: false, motivo: "certificado_nao_encontrado" }));
  }, [codigo]);

  return (
    <div className="min-h-screen bg-fundo">
      <div className="faixa-seguranca" />
      <main className="mx-auto flex min-h-[calc(100vh-6px)] max-w-lg flex-col justify-center gap-6 px-5 py-12">
        <div className="flex justify-center">
          <TimeLogo tamanho="lg" />
        </div>

        {!r && (
          <p className="flex items-center justify-center gap-2 text-sm text-texto-suave">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Verificando o código…
          </p>
        )}

        {r && !r.ok && (
          <div className="rounded-3xl border-2 border-vermelho bg-superficie p-6 text-center">
            <XCircle className="mx-auto size-12 text-vermelho" aria-hidden />
            <p className="mt-3 font-display text-xl font-extrabold text-vermelho">
              Certificado não encontrado
            </p>
            <p className="mt-2 text-sm text-texto-suave">
              Confira o código impresso. Ele tem o formato <code>TIME-XXXXXXXXXX</code>.
            </p>
            <p className="mt-3 font-mono text-sm text-texto">{codigo}</p>
          </div>
        )}

        {r?.ok && (
          <div className="rounded-3xl border-2 border-verde bg-superficie p-6">
            <div className="text-center">
              <BadgeCheck className="mx-auto size-12 text-verde" aria-hidden />
              <p className="mt-3 font-display text-xl font-extrabold text-verde">
                Certificado válido
              </p>
            </div>

            <dl className="mt-5 flex flex-col gap-3">
              {[
                { r: "Certificado", v: r.titulo },
                { r: "Pessoa", v: r.colaborador ?? "—" },
                { r: "Empresa", v: r.empresa },
                { r: "Campanha", v: r.campanha },
                { r: "Carga horária", v: cargaEmHoras(r.carga_minutos) },
                { r: "Emitido em", v: formatarData(r.emitido_em) },
              ]
                .filter((i) => i.v)
                .map((i) => (
                  <div key={i.r} className="border-b border-borda pb-2 last:border-0">
                    <dt className="text-xs uppercase tracking-wide text-texto-suave">{i.r}</dt>
                    <dd className="mt-0.5 text-texto">{i.v}</dd>
                  </div>
                ))}
            </dl>

            <p className="mt-4 text-center font-mono text-sm text-marinho">{codigo}</p>
          </div>
        )}

        <p className="text-center text-xs leading-relaxed text-texto-suave">
          A trilha do T.I.M.E. Seguro é complementar e não substitui os treinamentos formais
          obrigatórios das Normas Regulamentadoras.
        </p>
      </main>
    </div>
  );
}

export const Route = createFileRoute("/verificar/$codigo")({
  component: Verificar,
});
