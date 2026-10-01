import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CascaTv } from "@/components/tv/CascaTv";
import { useCampanhaAtiva } from "@/hooks/usePerfil";
import { useSetores } from "@/hooks/useEventos";
import { usePerguntas, useTemas } from "@/hooks/usePerguntas";
import { sortearPerguntas, type PerguntaTv } from "@/lib/jogos/classico";
import { definirPartida } from "@/lib/jogos/partida";
import { formatarHora, hojeISO } from "@/lib/datas";

const QUANTIDADES = [5, 10] as const;

/**
 * Seleção do Modo TV (docs/TIME_06 §3). Só o Clássico nesta etapa — Duelo de
 * Setores e Eliminação são o item 13 da ordem (TIME_11 marca como ⏳).
 */
function SelecaoTv() {
  const navigate = useNavigate();
  const { evento: eventoDaUrl } = Route.useSearch();
  const { data: campanha } = useCampanhaAtiva();
  const { data: setores = [] } = useSetores();
  const { data: temas = [] } = useTemas();
  const { data: perguntas = [] } = usePerguntas();

  const [eventoId, setEventoId] = useState<string | null>(eventoDaUrl ?? null);
  const [setorId, setSetorId] = useState<string | null>(null);
  const [temasEscolhidos, setTemasEscolhidos] = useState<string[]>([]);
  const [quantidade, setQuantidade] = useState<number>(5);
  const [focarLacunas, setFocarLacunas] = useState(false);

  /** Eventos de hoje, agendados e ainda sem sessão salva (docs/TIME_06 §3.1). */
  const { data: eventos = [] } = useQuery({
    queryKey: ["eventos-de-hoje"],
    queryFn: async () => {
      const hoje = hojeISO();
      const { data, error } = await supabase
        .from("eventos")
        .select("id, titulo, tipo, inicio, setor_id, status")
        .eq("status", "agendado")
        .gte("inicio", `${hoje}T00:00:00`)
        .lte("inicio", `${hoje}T23:59:59`)
        .order("inicio");
      if (error) throw error;
      return data ?? [];
    },
  });

  /** Temas com pior taxa de acerto, de `v_lacunas` (docs/TIME_06 §3.4). */
  const { data: lacunas = [] } = useQuery({
    queryKey: ["lacunas-tv", setorId],
    enabled: focarLacunas,
    queryFn: async (): Promise<string[]> => {
      const consulta = supabase
        .from("v_lacunas")
        .select("tema_id, taxa_acerto")
        .order("taxa_acerto", { ascending: true });
      const { data, error } = setorId ? await consulta.eq("setor_id", setorId) : await consulta;
      if (error) return [];
      return (data ?? []).map((l) => l.tema_id as string);
    },
  });

  const eventoEscolhido = eventos.find((e) => e.id === eventoId) ?? null;

  /** Pool de perguntas: ativas, dos temas escolhidos (ou da campanha). */
  const disponiveis = useMemo(() => {
    const filtro = temasEscolhidos.length > 0 ? new Set(temasEscolhidos) : null;
    return perguntas
      .filter((p) => p.status === "ativa" && (!filtro || filtro.has(p.tema_id)))
      .map((p): PerguntaTv & { tema_id: string } => ({
        id: p.id,
        enunciado: p.enunciado,
        alternativas: p.alternativas,
        correta: p.correta,
        explicacao: p.explicacao,
        tema: temas.find((t) => t.id === p.tema_id)?.nome ?? null,
        tema_id: p.tema_id,
      }));
  }, [perguntas, temasEscolhidos, temas]);

  const faltamPerguntas = disponiveis.length < quantidade;

  function iniciar() {
    const sorteadas = sortearPerguntas(disponiveis, quantidade, focarLacunas ? lacunas : []);
    if (sorteadas.length === 0) return;

    definirPartida({
      eventoId,
      eventoTitulo: eventoEscolhido?.titulo ?? null,
      setorId,
      setorNome: setorId ? (setores.find((s) => s.id === setorId)?.nome ?? "Setor") : "Todos",
      perguntas: sorteadas,
      iniciadaEm: Date.now(),
    });
    void navigate({ to: "/tv/jogo" });
  }

  const alternarTema = (id: string) =>
    setTemasEscolhidos((atual) =>
      atual.includes(id) ? atual.filter((t) => t !== id) : [...atual, id],
    );

  return (
    <CascaTv>
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-7 px-8 py-10">
        <header>
          <h1 className="font-display text-5xl font-extrabold">Modo TV</h1>
          <p className="mt-1 text-xl text-white/70">
            {campanha ? campanha.nome : "Sem campanha ativa — vale como treino"}
          </p>
        </header>

        <section>
          <h2 className="font-display text-2xl font-bold text-amarelo">1. Evento</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEventoId(null)}
              aria-pressed={eventoId === null}
              className={`min-h-14 rounded-2xl border-2 px-5 py-3 text-lg ${
                eventoId === null ? "border-amarelo bg-amarelo/20" : "border-white/20"
              }`}
            >
              Treino (não pontua)
            </button>
            {eventos.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => {
                  setEventoId(e.id);
                  if (e.setor_id) setSetorId(e.setor_id);
                }}
                aria-pressed={eventoId === e.id}
                className={`min-h-14 rounded-2xl border-2 px-5 py-3 text-left text-lg ${
                  eventoId === e.id ? "border-amarelo bg-amarelo/20" : "border-white/20"
                }`}
              >
                {e.titulo}
                <span className="ml-2 text-base text-white/60">{formatarHora(e.inicio)}</span>
              </button>
            ))}
          </div>
          {eventos.length === 0 && (
            <p className="mt-2 text-lg text-white/60">
              Nenhum evento agendado para hoje. Dá para jogar como treino.
            </p>
          )}
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-amarelo">2. Modo</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="min-h-14 rounded-2xl border-2 border-amarelo bg-amarelo/20 px-5 py-3 text-lg">
              🎯 Clássico
            </span>
            <span className="min-h-14 rounded-2xl border-2 border-white/10 px-5 py-3 text-lg text-white/40">
              ⚡ Duelo de Setores — em breve
            </span>
            <span className="min-h-14 rounded-2xl border-2 border-white/10 px-5 py-3 text-lg text-white/40">
              🧩 Eliminação — em breve
            </span>
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-amarelo">3. Setor</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSetorId(null)}
              aria-pressed={setorId === null}
              className={`min-h-14 rounded-2xl border-2 px-5 py-3 text-lg ${
                setorId === null ? "border-amarelo bg-amarelo/20" : "border-white/20"
              }`}
            >
              Todos
            </button>
            {setores.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSetorId(s.id)}
                aria-pressed={setorId === s.id}
                className={`min-h-14 rounded-2xl border-2 px-5 py-3 text-lg ${
                  setorId === s.id ? "border-amarelo bg-amarelo/20" : "border-white/20"
                }`}
              >
                {s.nome}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-amarelo">4. Perguntas</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {QUANTIDADES.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuantidade(q)}
                aria-pressed={quantidade === q}
                className={`min-h-14 rounded-2xl border-2 px-6 py-3 text-lg ${
                  quantidade === q ? "border-amarelo bg-amarelo/20" : "border-white/20"
                }`}
              >
                {q}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {temas.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => alternarTema(t.id)}
                aria-pressed={temasEscolhidos.includes(t.id)}
                className={`rounded-full border px-4 py-2 ${
                  temasEscolhidos.includes(t.id)
                    ? "border-amarelo bg-amarelo/20"
                    : "border-white/20 text-white/70"
                }`}
              >
                {t.icone} {t.nome}
              </button>
            ))}
          </div>
          <p className="mt-2 text-base text-white/60">
            {temasEscolhidos.length === 0
              ? "Nenhum tema marcado: sorteia de todos."
              : `${temasEscolhidos.length} tema(s) marcado(s).`}{" "}
            {disponiveis.length} pergunta(s) no pool.
          </p>

          <button
            type="button"
            onClick={() => setFocarLacunas((f) => !f)}
            aria-pressed={focarLacunas}
            className={`mt-3 flex min-h-14 items-center gap-2 rounded-2xl border-2 px-5 py-3 text-lg ${
              focarLacunas ? "border-amarelo bg-amarelo/20" : "border-white/20"
            }`}
          >
            <Target className="size-5" aria-hidden />
            Focar nas lacunas do setor
          </button>
        </section>

        {faltamPerguntas && (
          <p className="rounded-2xl bg-laranja/20 p-5 text-xl">
            Só {disponiveis.length} pergunta(s) no pool. Escolha menos perguntas, marque mais temas
            ou importe mais perguntas no painel.
          </p>
        )}

        <Button
          onClick={iniciar}
          disabled={disponiveis.length === 0}
          className="min-h-20 bg-amarelo text-3xl font-extrabold text-texto hover:bg-amarelo/90"
        >
          <Play className="size-8" aria-hidden />
          Iniciar
        </Button>
      </div>
    </CascaTv>
  );
}

/** `?evento=<uuid>` vem da tela de check-in. */
type Busca = { evento?: string };

export const Route = createFileRoute("/_protegido/tv/")({
  validateSearch: (bruto: Record<string, unknown>): Busca => {
    const busca: Busca = {};
    if (typeof bruto["evento"] === "string") busca.evento = bruto["evento"];
    return busca;
  },
  component: SelecaoTv,
});
