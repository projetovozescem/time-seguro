import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Download, Loader2, Monitor, Pencil, Plus, Tv, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePerfil, useCampanhaAtiva } from "@/hooks/usePerfil";
import { useEventos, usePresenca, useSetores, type Evento } from "@/hooks/useEventos";
import { useCampanhas } from "@/hooks/useCampanhas";
import {
  TIPOS_EVENTO,
  agruparPorDia,
  baixarCsv,
  definicaoDoTipo,
  montarCsv,
  paraInputDataHora,
  pontosPadrao,
  validarEvento,
  type EventoForm as Dados,
  type TipoEvento,
} from "@/lib/eventos";
import { formatarData, formatarHora } from "@/lib/datas";

function Formulario({
  evento,
  empresaId,
  campanhaPadrao,
  aoFechar,
}: {
  evento: Evento | null;
  empresaId: string | null;
  campanhaPadrao: string | null;
  aoFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: setores = [] } = useSetores();
  const { data: campanhas = [] } = useCampanhas();
  const editando = evento !== null;

  const [titulo, setTitulo] = useState(evento?.titulo ?? "");
  const [tipo, setTipo] = useState<TipoEvento>(evento?.tipo ?? "dds");
  const [inicio, setInicio] = useState(paraInputDataHora(evento?.inicio));
  const [fim, setFim] = useState(paraInputDataHora(evento?.fim));
  const [setorId, setSetorId] = useState(evento?.setor_id ?? "");
  const [pontos, setPontos] = useState(evento?.pontos ?? pontosPadrao("dds"));
  const [campanhaId, setCampanhaId] = useState(evento?.campanha_id ?? campanhaPadrao ?? "");
  const [descricao, setDescricao] = useState(evento?.descricao ?? "");
  const [salvando, setSalvando] = useState(false);

  const dados: Dados = {
    titulo,
    tipo,
    inicio,
    fim,
    setor_id: setorId || null,
    pontos,
    campanha_id: campanhaId || null,
    descricao,
  };
  const erros = validarEvento(dados);

  /** Trocar o tipo reajusta os pontos, a menos que já tenham sido mexidos. */
  function trocarTipo(novo: TipoEvento) {
    if (pontos === pontosPadrao(tipo)) setPontos(pontosPadrao(novo));
    setTipo(novo);
  }

  async function salvar() {
    if (erros.length > 0 || !empresaId) return;
    setSalvando(true);

    const linha = {
      titulo: titulo.trim(),
      tipo,
      inicio: new Date(inicio).toISOString(),
      fim: new Date(fim).toISOString(),
      setor_id: setorId || null,
      pontos,
      campanha_id: campanhaId || null,
      descricao: descricao.trim() || null,
    };

    const { error } = editando
      ? await supabase.from("eventos").update(linha).eq("id", evento.id)
      : await supabase.from("eventos").insert({ ...linha, empresa_id: empresaId });

    setSalvando(false);
    if (error) {
      toast.error("Não foi possível salvar o evento.");
      return;
    }
    toast.success(editando ? "Evento atualizado." : "Evento criado.");
    await queryClient.invalidateQueries({ queryKey: ["eventos"] });
    aoFechar();
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-marinho">
            {editando ? "Editar evento" : "Novo evento"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="titulo-evento">Título</Label>
            <Input
              id="titulo-evento"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="DDS — uso correto do cinto de segurança"
            />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Tipo</legend>
            <div className="flex flex-wrap gap-2">
              {TIPOS_EVENTO.map((t) => (
                <button
                  key={t.tipo}
                  type="button"
                  onClick={() => trocarTipo(t.tipo)}
                  aria-pressed={tipo === t.tipo}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    tipo === t.tipo
                      ? "border-marinho bg-marinho text-white"
                      : "border-borda text-texto hover:border-marinho"
                  }`}
                >
                  {t.emoji} {t.rotulo}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inicio-evento">Começa</Label>
              <Input
                id="inicio-evento"
                type="datetime-local"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fim-evento">Termina</Label>
              <Input
                id="fim-evento"
                type="datetime-local"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="setor-evento">Setor</Label>
              <select
                id="setor-evento"
                value={setorId}
                onChange={(e) => setSetorId(e.target.value)}
                className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Todos os setores</option>
                {setores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
              <p className="text-xs text-texto-suave">
                Com setor escolhido, só quem é dele consegue fazer check-in.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pontos-evento">Pontos do check-in</Label>
              <Input
                id="pontos-evento"
                type="number"
                min={0}
                max={100}
                value={pontos}
                onChange={(e) => setPontos(Number(e.target.value))}
              />
              <p className="text-xs text-texto-suave">
                Padrão do tipo {definicaoDoTipo(tipo).rotulo}: {pontosPadrao(tipo)}.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="campanha-evento">Campanha</Label>
            <select
              id="campanha-evento"
              value={campanhaId}
              onChange={(e) => setCampanhaId(e.target.value)}
              className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">Sem campanha (não pontua)</option>
              {campanhas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="descricao-evento">Descrição</Label>
            <Textarea
              id="descricao-evento"
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          {erros.length > 0 && (
            <ul className="rounded-lg bg-vermelho/10 p-3 text-sm text-vermelho">
              {erros.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={erros.length > 0 || salvando || !empresaId}>
            {salvando && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Lista de presença de um evento, com exportação em CSV (docs/TIME_04 §8). */
function Presenca({ evento, aoFechar }: { evento: Evento; aoFechar: () => void }) {
  const { data: presentes = [], isLoading } = usePresenca(evento.id);

  function exportar() {
    baixarCsv(
      `presenca-${evento.titulo.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`,
      montarCsv(
        ["nome", "matricula", "setor", "hora"],
        presentes.map((p) => [
          p.colaboradores?.nome ?? "",
          p.colaboradores?.matricula ?? "",
          p.colaboradores?.setores?.nome ?? "",
          formatarHora(p.criado_em),
        ]),
      ),
    );
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-marinho">Lista de presença</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-texto-suave">
          {evento.titulo} · {formatarData(evento.inicio)}
        </p>

        {isLoading && <p className="text-sm text-texto-suave">Carregando…</p>}

        {!isLoading && presentes.length === 0 && (
          <p className="rounded-xl bg-fundo p-4 text-sm text-texto-suave">
            Ninguém fez check-in ainda. O código aparece na TV e muda a cada 60 segundos.
          </p>
        )}

        {presentes.length > 0 && (
          <>
            <p className="text-sm font-semibold text-texto">{presentes.length} presente(s)</p>
            <ol className="flex flex-col gap-1.5">
              {presentes.map((p, i) => (
                <li key={i} className="flex items-baseline gap-2 text-sm">
                  <span className="w-6 shrink-0 text-right tabular-nums text-texto-suave">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-texto">{p.colaboradores?.nome ?? "—"}</span>
                  <span className="text-xs text-texto-suave">
                    {p.colaboradores?.setores?.nome ?? "—"} · {formatarHora(p.criado_em)}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={exportar} disabled={presentes.length === 0}>
            <Download className="size-4" aria-hidden />
            Exportar CSV
          </Button>
          <Button onClick={aoFechar}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Calendário de eventos (docs/TIME_04 §8). */
function Eventos() {
  const { data: perfil } = usePerfil();
  const { data: campanhaAtiva } = useCampanhaAtiva();
  const { data: eventos = [], isLoading } = useEventos();
  const { data: setores = [] } = useSetores();

  const [editando, setEditando] = useState<Evento | "novo" | null>(null);
  const [vendoPresenca, setVendoPresenca] = useState<Evento | null>(null);
  const [filtroTipo, setFiltroTipo] = useState("");

  const podeEditar = perfil?.papel === "admin" || perfil?.papel === "tecnico";
  const nomeDoSetor = new Map(setores.map((s) => [s.id, s.nome]));

  const porDia = useMemo(
    () => agruparPorDia(filtroTipo ? eventos.filter((e) => e.tipo === filtroTipo) : eventos),
    [eventos, filtroTipo],
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-marinho">Eventos</h1>
          <p className="mt-1 text-sm text-texto-suave">
            DDS, SIPAT e treinamentos. O check-in pontua pelo valor do evento.
          </p>
        </div>
        {podeEditar && (
          <Button onClick={() => setEditando("novo")}>
            <Plus className="size-4" aria-hidden />
            Novo evento
          </Button>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFiltroTipo("")}
          aria-pressed={filtroTipo === ""}
          className={`rounded-full border px-3 py-1.5 text-sm ${
            filtroTipo === "" ? "border-marinho bg-marinho text-white" : "border-borda text-texto"
          }`}
        >
          Todos
        </button>
        {TIPOS_EVENTO.map((t) => (
          <button
            key={t.tipo}
            type="button"
            onClick={() => setFiltroTipo(t.tipo)}
            aria-pressed={filtroTipo === t.tipo}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              filtroTipo === t.tipo
                ? "border-marinho bg-marinho text-white"
                : "border-borda text-texto"
            }`}
          >
            {t.emoji} {t.rotulo}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-texto-suave">Carregando…</p>}

      {!isLoading && porDia.size === 0 && (
        <p className="rounded-2xl border border-borda bg-superficie p-6 text-center text-sm text-texto-suave">
          <CalendarDays className="mx-auto mb-2 size-6" aria-hidden />
          Nenhum evento {filtroTipo ? "desse tipo" : "ainda"}.
        </p>
      )}

      {[...porDia.entries()].map(([dia, doDia]) => (
        <section key={dia} className="flex flex-col gap-2">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-texto-suave">
            {formatarData(dia)}
          </h2>
          <ul className="flex flex-col gap-2">
            {doDia.map((e) => {
              const d = definicaoDoTipo(e.tipo);
              return (
                <li
                  key={e.id}
                  className="flex flex-wrap items-start gap-3 rounded-2xl border border-borda bg-superficie p-4"
                >
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${d.cor}`}
                  >
                    {d.emoji} {d.rotulo}
                  </span>

                  <div className="min-w-48 flex-1">
                    <p className="font-medium text-texto">{e.titulo}</p>
                    <p className="mt-0.5 text-xs text-texto-suave">
                      {formatarHora(e.inicio)} às {formatarHora(e.fim)} ·{" "}
                      {e.setor_id
                        ? (nomeDoSetor.get(e.setor_id) ?? "setor removido")
                        : "todos os setores"}{" "}
                      · {e.pontos} pontos
                    </p>
                    {e.descricao && <p className="mt-1 text-sm text-texto-suave">{e.descricao}</p>}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setVendoPresenca(e)}>
                      <Users className="size-4" aria-hidden />
                      Presença
                    </Button>
                    {podeEditar && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled
                          title="A tela do Modo TV entra na próxima etapa."
                        >
                          <Tv className="size-4" aria-hidden />
                          Check-in na TV
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled
                          title="A tela do Modo TV entra na próxima etapa."
                        >
                          <Monitor className="size-4" aria-hidden />
                          Quiz na TV
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditando(e)}>
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {editando && (
        <Formulario
          evento={editando === "novo" ? null : editando}
          empresaId={perfil?.empresa.id ?? null}
          campanhaPadrao={campanhaAtiva?.id ?? null}
          aoFechar={() => setEditando(null)}
        />
      )}

      {vendoPresenca && <Presenca evento={vendoPresenca} aoFechar={() => setVendoPresenca(null)} />}
    </div>
  );
}

export const Route = createFileRoute("/_protegido/painel/eventos")({
  component: Eventos,
});
