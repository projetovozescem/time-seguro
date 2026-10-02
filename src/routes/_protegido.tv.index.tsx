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
import { PERGUNTAS_POR_RODADA } from "@/lib/jogos/eliminacao";
import { definirPartida, type Modo } from "@/lib/jogos/partida";
import { corDoTexto } from "@/lib/jogos/cores";
import { formatarHora, hojeISO } from "@/lib/datas";

const QUANTIDADES = [5, 10] as const;

/** Os três modos (docs/TIME_06 §4). */
const MODOS: { modo: Modo; emoji: string; rotulo: string; ajuda: string }[] = [
  {
    modo: "classico",
    emoji: "🎯",
    rotulo: "Clássico",
    ajuda: "A turma discute, você toca a resposta. Um setor por partida.",
  },
  {
    modo: "duelo",
    emoji: "⚡",
    rotulo: "Duelo de Setores",
    ajuda: "Dois ou mais setores disputam no buzzer. 30 s por pergunta.",
  },
  {
    modo: "eliminacao",
    emoji: "🧩",
    rotulo: "Eliminação",
    ajuda: `Uma equipe por vez, ${PERGUNTAS_POR_RODADA} perguntas de 2 a 40 pontos. Errar zera a rodada.`,
  },
];

/** Seleção do Modo TV (docs/TIME_06 §3). */
function SelecaoTv() {
  const navigate = useNavigate();
  const { evento: eventoDaUrl } = Route.useSearch();
  const { data: campanha } = useCampanhaAtiva();
  const { data: setores = [] } = useSetores();
  const { data: temas = [] } = useTemas();
  const { data: perguntas = [] } = usePerguntas();

  const [eventoId, setEventoId] = useState<string | null>(eventoDaUrl ?? null);
  const [modo, setModo] = useState<Modo>("classico");
  const [setorId, setSetorId] = useState<string | null>(null);
  const [equipes, setEquipes] = useState<string[]>([]);
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

  /** Equipes do Duelo e da Eliminação, na ordem em que foram marcadas. */
  const equipesEscolhidas = useMemo(
    () =>
      equipes
        .map((id) => setores.find((s) => s.id === id))
        .filter((s): s is (typeof setores)[number] => s !== undefined)
        .map((s) => ({ setorId: s.id, nome: s.nome, cor: s.cor ?? "#0b3c5d" })),
    [equipes, setores],
  );

  function iniciar() {
    const base = {
      eventoId,
      eventoTitulo: eventoEscolhido?.titulo ?? null,
      iniciadaEm: Date.now(),
    };
    const sorteio = (quantas: number) =>
      sortearPerguntas(disponiveis, quantas, focarLacunas ? lacunas : []);

    if (modo === "classico") {
      const sorteadas = sorteio(quantidade);
      if (sorteadas.length === 0) return;
      definirPartida({
        ...base,
        modo: "classico",
        setorId,
        setorNome: setorId ? (setores.find((s) => s.id === setorId)?.nome ?? "Setor") : "Todos",
        perguntas: sorteadas,
      });
    } else if (modo === "duelo") {
      const sorteadas = sorteio(quantidade);
      if (sorteadas.length === 0 || equipesEscolhidas.length < 2) return;
      definirPartida({ ...base, modo: "duelo", equipes: equipesEscolhidas, perguntas: sorteadas });
    } else {
      // Eliminação: 5 perguntas POR equipe, sorteadas de uma vez e repartidas,
      // para duas equipes não receberem a mesma pergunta.
      const total = PERGUNTAS_POR_RODADA * equipesEscolhidas.length;
      const sorteadas = sorteio(total);
      if (sorteadas.length < total || equipesEscolhidas.length < 1) return;
      const porEquipe = equipesEscolhidas.map((_, i) =>
        sorteadas.slice(i * PERGUNTAS_POR_RODADA, (i + 1) * PERGUNTAS_POR_RODADA),
      );
      definirPartida({
        ...base,
        modo: "eliminacao",
        equipes: equipesEscolhidas,
        perguntasPorEquipe: porEquipe,
      });
    }

    void navigate({ to: "/tv/jogo" });
  }

  const alternarEquipe = (id: string) =>
    setEquipes((atual) => (atual.includes(id) ? atual.filter((e) => e !== id) : [...atual, id]));

  /** Quantas perguntas o modo escolhido precisa no pool. */
  const perguntasNecessarias =
    modo === "eliminacao"
      ? PERGUNTAS_POR_RODADA * Math.max(1, equipesEscolhidas.length)
      : quantidade;

  /** O que ainda falta para poder iniciar. `null` quando está tudo pronto. */
  const impedimento =
    disponiveis.length < perguntasNecessarias
      ? `Faltam perguntas: o pool tem ${disponiveis.length} e este modo precisa de ${perguntasNecessarias}.`
      : modo === "duelo" && equipesEscolhidas.length < 2
        ? "O Duelo precisa de pelo menos duas equipes."
        : modo === "eliminacao" && equipesEscolhidas.length < 1
          ? "Marque as equipes que vão jogar."
          : null;

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
            {MODOS.map((m) => (
              <button
                key={m.modo}
                type="button"
                onClick={() => setModo(m.modo)}
                aria-pressed={modo === m.modo}
                className={`min-h-14 max-w-72 rounded-2xl border-2 px-5 py-3 text-left text-lg ${
                  modo === m.modo ? "border-amarelo bg-amarelo/20" : "border-white/20"
                }`}
              >
                {m.emoji} {m.rotulo}
                <span className="block text-base text-white/60">{m.ajuda}</span>
              </button>
            ))}
          </div>
        </section>

        {modo === "classico" ? (
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
        ) : (
          <section>
            <h2 className="font-display text-2xl font-bold text-amarelo">3. Equipes</h2>
            <p className="mt-1 text-lg text-white/60">
              {modo === "duelo"
                ? "Toque nos setores que estão na sala. Cada um ganha um buzzer na sua cor."
                : "Toque nos setores na ordem em que vão jogar. Cada equipe faz a sua rodada."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {setores.map((s) => {
                const posicao = equipes.indexOf(s.id);
                const marcada = posicao >= 0;
                const cor = s.cor ?? "#0b3c5d";
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => alternarEquipe(s.id)}
                    aria-pressed={marcada}
                    style={marcada ? { backgroundColor: cor } : undefined}
                    className={`min-h-14 rounded-2xl border-2 px-5 py-3 text-lg ${
                      marcada ? `border-white/60 ${corDoTexto(cor)}` : "border-white/20"
                    }`}
                  >
                    {modo === "eliminacao" && marcada && `${posicao + 1}º · `}
                    {s.nome}
                  </button>
                );
              })}
            </div>
            {setores.length === 0 && (
              <p className="mt-2 text-lg text-white/60">
                Nenhum setor cadastrado. Cadastre em Colaboradores e setores, aba Setores e locais,
                no painel.
              </p>
            )}
          </section>
        )}

        <section>
          <h2 className="font-display text-2xl font-bold text-amarelo">4. Perguntas</h2>
          {modo === "eliminacao" ? (
            <p className="mt-2 text-lg text-white/60">
              A Eliminação usa {PERGUNTAS_POR_RODADA} perguntas por equipe — {perguntasNecessarias}{" "}
              no total, sem repetir entre as equipes.
            </p>
          ) : (
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
          )}

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

        {impedimento && <p className="rounded-2xl bg-laranja/20 p-5 text-xl">{impedimento}</p>}

        <Button
          onClick={iniciar}
          disabled={impedimento !== null}
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
