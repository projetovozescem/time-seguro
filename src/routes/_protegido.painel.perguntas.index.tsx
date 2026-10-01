import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown, Copy, Download, Pencil, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PerguntaForm } from "@/components/painel/PerguntaForm";
import { usePerfil } from "@/hooks/usePerfil";
import { useDesempenho, usePerguntas, useTemas, type Pergunta } from "@/hooks/usePerguntas";
import { escreverTxt } from "@/lib/importacao/txt";
import { LETRAS } from "@/lib/importacao/tipos";
import { normalizar } from "@/lib/importacao/tipos";

const DIFICULDADES = ["Fácil", "Média", "Difícil"] as const;

/** Banco de perguntas (docs/TIME_04 §5). */
function Perguntas() {
  const { data: perfil } = usePerfil();
  const { data: temas = [] } = useTemas();
  const { data: perguntas = [], isLoading } = usePerguntas();
  const { data: desempenho } = useDesempenho();
  const queryClient = useQueryClient();

  const [busca, setBusca] = useState("");
  const [tema, setTema] = useState("");
  const [status, setStatus] = useState("");
  const [origem, setOrigem] = useState("");
  const [dificuldade, setDificuldade] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);
  const [editando, setEditando] = useState<Pergunta | "nova" | null>(null);

  const nomeDoTema = useMemo(
    () => new Map(temas.map((t) => [t.id, `${t.icone} ${t.nome}`])),
    [temas],
  );

  const filtradas = useMemo(() => {
    const alvo = normalizar(busca);
    return perguntas.filter((p) => {
      if (tema && p.tema_id !== tema) return false;
      if (status && p.status !== status) return false;
      if (dificuldade && String(p.dificuldade) !== dificuldade) return false;
      if (origem === "global" && p.empresa_id !== null) return false;
      if (origem && origem !== "global" && (p.origem !== origem || p.empresa_id === null)) {
        return false;
      }
      if (alvo && !normalizar(p.enunciado).includes(alvo)) return false;
      return true;
    });
  }, [perguntas, busca, tema, status, origem, dificuldade]);

  /** Exporta no mesmo formato TXT da importação (docs/TIME_04 §5). */
  function exportarTxt() {
    const slugDoTema = new Map(temas.map((t) => [t.id, t.slug]));
    const texto = escreverTxt(
      filtradas.map((p) => ({
        enunciado: p.enunciado,
        alternativas: p.alternativas,
        correta: p.correta,
        tema: slugDoTema.get(p.tema_id) ?? null,
        ...(p.explicacao ? { explicacao: p.explicacao } : {}),
        dificuldade: (p.dificuldade as 1 | 2 | 3) ?? 2,
        avisos: [],
      })),
    );

    const url = URL.createObjectURL(new Blob([texto], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `perguntas-time-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtradas.length} pergunta(s) exportada(s).`);
  }

  /** Copia uma pergunta global para a empresa, para poder editá-la. */
  async function copiarParaEmpresa(p: Pergunta) {
    if (!perfil) return;
    const { error } = await supabase.from("perguntas").insert({
      empresa_id: perfil.empresa.id,
      tema_id: p.tema_id,
      enunciado: p.enunciado,
      alternativas: p.alternativas,
      correta: p.correta,
      explicacao: p.explicacao,
      dificuldade: p.dificuldade,
      origem: "manual",
    });
    if (error) {
      toast.error("Não foi possível copiar a pergunta.");
      return;
    }
    toast.success("Copiada para a sua empresa. Agora você pode editá-la.");
    await queryClient.invalidateQueries({ queryKey: ["perguntas"] });
  }

  const limpar = () => {
    setBusca("");
    setTema("");
    setStatus("");
    setOrigem("");
    setDificuldade("");
  };
  const comFiltro = busca || tema || status || origem || dificuldade;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-marinho">Perguntas</h1>
          <p className="mt-1 text-sm text-texto-suave">
            {isLoading ? "Carregando…" : `${filtradas.length} de ${perguntas.length} pergunta(s)`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportarTxt} disabled={filtradas.length === 0}>
            <Download className="size-4" aria-hidden />
            Exportar TXT
          </Button>
          <Button variant="outline" asChild>
            <Link to="/painel/perguntas/importar">
              <Upload className="size-4" aria-hidden />
              Importar
            </Link>
          </Button>
          <Button onClick={() => setEditando("nova")}>
            <Plus className="size-4" aria-hidden />
            Nova pergunta
          </Button>
        </div>
      </header>

      <section className="grid gap-3 rounded-2xl border border-borda bg-superficie p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="busca">Buscar</Label>
          <Input
            id="busca"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Texto do enunciado"
          />
        </div>
        {[
          {
            id: "tema",
            rotulo: "Tema",
            valor: tema,
            set: setTema,
            opcoes: temas.map((t) => ({ v: t.id, r: `${t.icone} ${t.nome}` })),
          },
          {
            id: "status",
            rotulo: "Status",
            valor: status,
            set: setStatus,
            opcoes: [
              { v: "ativa", r: "Ativa" },
              { v: "inativa", r: "Inativa" },
            ],
          },
          {
            id: "origem",
            rotulo: "Origem",
            valor: origem,
            set: setOrigem,
            opcoes: [
              { v: "manual", r: "Manual" },
              { v: "importacao", r: "Importação" },
              { v: "global", r: "Banco global" },
            ],
          },
          {
            id: "dificuldade",
            rotulo: "Dificuldade",
            valor: dificuldade,
            set: setDificuldade,
            opcoes: DIFICULDADES.map((d, i) => ({ v: String(i + 1), r: d })),
          },
        ].map(({ id, rotulo, valor, set, opcoes }) => (
          <div key={id} className="flex flex-col gap-1.5">
            <Label htmlFor={id}>{rotulo}</Label>
            <select
              id={id}
              value={valor}
              onChange={(e) => set(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">Todos</option>
              {opcoes.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.r}
                </option>
              ))}
            </select>
          </div>
        ))}
        {comFiltro && (
          <button
            type="button"
            onClick={limpar}
            className="justify-self-start text-sm font-medium text-marinho underline-offset-4 hover:underline lg:col-span-5"
          >
            Limpar filtros
          </button>
        )}
      </section>

      {!isLoading && filtradas.length === 0 && (
        <p className="rounded-2xl border border-borda bg-superficie p-6 text-center text-sm text-texto-suave">
          {perguntas.length === 0
            ? "Nenhuma pergunta ainda. Use Importar para trazer o banco inicial."
            : "Nenhuma pergunta com esses filtros."}
        </p>
      )}

      <ul className="flex flex-col gap-2.5">
        {filtradas.map((p) => {
          const expandida = aberta === p.id;
          const global = p.empresa_id === null;
          const d = desempenho?.get(p.id);

          return (
            <li key={p.id} className="rounded-2xl border border-borda bg-superficie">
              <button
                type="button"
                onClick={() => setAberta(expandida ? null : p.id)}
                aria-expanded={expandida}
                className="flex w-full items-start gap-3 px-4 py-3 text-left"
              >
                <ChevronDown
                  className={`mt-0.5 size-5 shrink-0 text-texto-suave transition-transform ${expandida ? "rotate-180" : ""}`}
                  aria-hidden
                />
                <span className="flex-1">
                  <span className="block font-medium text-texto">{p.enunciado}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-texto-suave">
                    <span>{nomeDoTema.get(p.tema_id) ?? "tema removido"}</span>
                    <span>· {DIFICULDADES[p.dificuldade - 1] ?? "—"}</span>
                    {global && (
                      <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">
                        global
                      </span>
                    )}
                    {p.status === "inativa" && (
                      <span className="rounded-full bg-vermelho/15 px-2 py-0.5 font-semibold text-vermelho">
                        inativa
                      </span>
                    )}
                    {d && d.tentativas > 0 && (
                      <span className="font-semibold text-marinho">
                        {Math.round(d.taxa_acerto * 100)}% de acerto ({d.tentativas})
                      </span>
                    )}
                  </span>
                </span>
              </button>

              {expandida && (
                <div className="border-t border-borda px-4 py-3">
                  <ol className="flex flex-col gap-1.5">
                    {p.alternativas.map((a, i) => (
                      <li
                        key={i}
                        className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm ${
                          i === p.correta
                            ? "bg-verde/10 font-medium text-texto"
                            : "text-texto-suave"
                        }`}
                      >
                        <span className="font-display font-bold">{LETRAS[i]})</span>
                        <span>{a}</span>
                        {i === p.correta && <span className="ml-auto text-verde">✓</span>}
                      </li>
                    ))}
                  </ol>

                  {p.explicacao ? (
                    <p className="mt-3 rounded-lg bg-fundo p-3 text-sm text-texto">
                      {p.explicacao}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-laranja">Sem explicação.</p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {global ? (
                      <Button size="sm" variant="outline" onClick={() => copiarParaEmpresa(p)}>
                        <Copy className="size-4" aria-hidden />
                        Copiar para minha empresa
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setEditando(p)}>
                        <Pencil className="size-4" aria-hidden />
                        Editar
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {editando && (
        <PerguntaForm
          pergunta={editando === "nova" ? null : editando}
          temas={temas}
          empresaId={perfil?.empresa.id ?? null}
          aoFechar={() => setEditando(null)}
        />
      )}
    </div>
  );
}

export const Route = createFileRoute("/_protegido/painel/perguntas/")({
  component: Perguntas,
});
