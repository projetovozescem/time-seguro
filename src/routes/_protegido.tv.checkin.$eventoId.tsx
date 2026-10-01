import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CascaTv } from "@/components/tv/CascaTv";
import { formatarHora } from "@/lib/datas";

/** O código muda a cada 60 s (docs/TIME_06 §2). */
const SEGUNDOS_DO_CODIGO = 60;
/** Lista de presentes recarrega a cada 5 s. */
const MS_DA_PRESENCA = 5000;

type Presente = {
  criado_em: string;
  colaboradores: { nome: string } | null;
};

/** "Carlos Souza" → "Carlos S." (docs/TIME_06 §2 e TIME_03 §7). */
function nomeCurto(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length < 2) return partes[0] ?? "";
  return `${partes[0]} ${partes[partes.length - 1]![0]!.toUpperCase()}.`;
}

/** Tela de check-in na TV: QR gigante que gira a cada minuto. */
function CheckinNaTv() {
  const { eventoId } = Route.useParams();
  const navigate = useNavigate();

  const [codigo, setCodigo] = useState<string | null>(null);
  const [restante, setRestante] = useState(SEGUNDOS_DO_CODIGO);
  const [erro, setErro] = useState<string | null>(null);
  const girando = useRef(false);

  const { data: evento } = useQuery({
    queryKey: ["evento", eventoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventos")
        .select("id, titulo, tipo, pontos, inicio")
        .eq("id", eventoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: presentes = [] } = useQuery({
    queryKey: ["presenca-tv", eventoId],
    refetchInterval: MS_DA_PRESENCA,
    queryFn: async (): Promise<Presente[]> => {
      const { data, error } = await supabase
        .from("checkins")
        .select("criado_em, colaboradores ( nome )")
        .eq("evento_id", eventoId)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Presente[];
    },
  });

  const girar = useCallback(async () => {
    if (girando.current) return;
    girando.current = true;
    try {
      const { data, error } = await supabase.rpc("tecnico_rotacionar_codigo", {
        p_evento: eventoId,
      });
      const r = data as { ok?: boolean; codigo?: string; motivo?: string } | null;
      if (error || !r?.ok || !r.codigo) {
        setErro("Não foi possível gerar o código. Confira se o evento existe.");
        return;
      }
      setCodigo(r.codigo);
      setRestante(SEGUNDOS_DO_CODIGO);
      setErro(null);
    } finally {
      girando.current = false;
    }
  }, [eventoId]);

  // Gira ao abrir e a cada 60 s.
  useEffect(() => {
    void girar();
    const timer = window.setInterval(() => void girar(), SEGUNDOS_DO_CODIGO * 1000);
    return () => window.clearInterval(timer);
  }, [girar]);

  // Barra de contagem: só visual, o que vale é o intervalo acima.
  useEffect(() => {
    const timer = window.setInterval(() => setRestante((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const url =
    typeof window !== "undefined" && codigo
      ? `${window.location.origin}/app/checkin?e=${eventoId}&c=${codigo}`
      : null;

  return (
    <CascaTv>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-8 py-10">
        <header>
          <p className="text-xl text-white/70">Check-in</p>
          <h1 className="font-display text-5xl font-extrabold">{evento?.titulo ?? "Evento"}</h1>
          {evento && (
            <p className="mt-1 text-2xl text-amarelo">
              {evento.pontos} pontos para quem confirmar presença
            </p>
          )}
        </header>

        {erro && (
          <p role="alert" className="rounded-2xl bg-vermelho/20 p-5 text-2xl">
            {erro}
          </p>
        )}

        <div className="grid flex-1 gap-8 lg:grid-cols-[1fr_22rem]">
          <div className="flex flex-col items-center justify-center gap-6 rounded-3xl bg-white p-8">
            {url ? (
              <>
                <QRCodeSVG value={url} size={380} level="M" />
                <p className="font-display text-6xl font-extrabold tracking-[0.2em] text-marinho">
                  {codigo}
                </p>
                <p className="text-center text-xl text-texto-suave">
                  Aponte a câmera do celular ou digite o código no app.
                </p>
              </>
            ) : (
              <p className="text-2xl text-texto-suave">Gerando o código…</p>
            )}

            <span className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-marinho transition-all duration-1000"
                style={{ width: `${(restante / SEGUNDOS_DO_CODIGO) * 100}%` }}
              />
            </span>
            <p className="text-lg text-texto-suave">
              O código muda em {restante}s. O anterior vale por 3 minutos.
            </p>
          </div>

          <aside className="flex flex-col gap-4 rounded-3xl bg-white/10 p-6">
            <p className="flex items-center gap-2 font-display text-3xl font-extrabold">
              <Users className="size-7" aria-hidden />
              {presentes.length}
            </p>
            <p className="text-lg text-white/70">presentes</p>

            <ul className="flex flex-col gap-2">
              {presentes.slice(0, 5).map((p, i) => (
                <li key={i} className="text-2xl">
                  {p.colaboradores?.nome ? nomeCurto(p.colaboradores.nome) : "—"} ✅
                  <span className="ml-2 text-base text-white/50">{formatarHora(p.criado_em)}</span>
                </li>
              ))}
            </ul>

            <Button
              onClick={() => navigate({ to: "/tv", search: { evento: eventoId } })}
              className="mt-auto min-h-16 bg-amarelo text-xl font-bold text-texto hover:bg-amarelo/90"
            >
              Começar o quiz
            </Button>
          </aside>
        </div>
      </div>
    </CascaTv>
  );
}

export const Route = createFileRoute("/_protegido/tv/checkin/$eventoId")({
  component: CheckinNaTv,
});
