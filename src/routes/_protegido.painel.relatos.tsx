import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Camera, Check, Copy, Download, Loader2, X } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MaisOpcoes } from "@/components/painel/MaisOpcoes";
import { Textarea } from "@/components/ui/textarea";
import { usePerfil } from "@/hooks/usePerfil";
import {
  useFotoDoRelato,
  useHistoricoDoRelato,
  useRelatos,
  type RelatoPainel,
} from "@/hooks/useRelatos";
import {
  COLUNAS_KANBAN,
  GRAVIDADES,
  STATUS_DE_ANDAMENTO,
  corDoStatus,
  rotuloDaCategoria,
  rotuloDoStatus,
  type Decisao,
  type Gravidade,
  type StatusRelato,
} from "@/lib/relatos";
import { baixarCsv, montarCsv } from "@/lib/eventos";
import { formatarDataHora } from "@/lib/datas";
import { mensagem } from "@/lib/mensagens";

function Foto({ caminho }: { caminho: string }) {
  const { data: url, isLoading } = useFotoDoRelato(caminho);
  if (isLoading) return <p className="text-sm text-texto-suave">Carregando a foto…</p>;
  if (!url) return <p className="text-sm text-laranja">Foto indisponível.</p>;
  return <img src={url} alt="Foto do relato" className="w-full rounded-xl" />;
}

/** Gaveta de detalhe com as ações do técnico (docs/TIME_04 §9). */
function Detalhe({
  relato,
  todos,
  podeAgir,
  aoFechar,
}: {
  relato: RelatoPainel;
  todos: RelatoPainel[];
  podeAgir: boolean;
  aoFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: historico = [] } = useHistoricoDoRelato(relato.id);

  const [gravidade, setGravidade] = useState<Gravidade>("media");
  const [comentario, setComentario] = useState("");
  const [visivel, setVisivel] = useState(true);
  const [novoStatus, setNovoStatus] = useState<StatusRelato>("em_analise");
  const [agindo, setAgindo] = useState(false);

  const duplicadoDe = relato.possivel_duplicado_de
    ? todos.find((r) => r.id === relato.possivel_duplicado_de)
    : null;

  async function recarregar() {
    await queryClient.invalidateQueries({ queryKey: ["relatos"] });
    await queryClient.invalidateQueries({ queryKey: ["relato-historico", relato.id] });
  }

  async function decidir(decisao: Decisao) {
    setAgindo(true);
    // Com `exactOptionalPropertyTypes`, parâmetro opcional é OMITIDO, não
    // passado como undefined — a RPC já tem DEFAULT NULL para cada um.
    const { data, error } = await supabase.rpc("tecnico_validar_relato", {
      p_relato: relato.id,
      p_decisao: decisao,
      ...(decisao === "validar" ? { p_gravidade: gravidade } : {}),
      ...(comentario.trim() ? { p_comentario: comentario.trim() } : {}),
      ...(decisao === "duplicado" && relato.possivel_duplicado_de
        ? { p_duplicado_de: relato.possivel_duplicado_de }
        : {}),
    });
    setAgindo(false);

    const r = data as { ok?: boolean; motivo?: string; pontos?: number } | null;
    if (error || !r?.ok) {
      toast.error(r?.motivo ? mensagem(r.motivo) : "Não foi possível registrar a decisão.");
      return;
    }
    toast.success(
      decisao === "validar"
        ? `Relato validado. ${r.pontos ? `+${r.pontos} pontos para o colaborador.` : "Sem pontos: limite da semana."}`
        : "Decisão registrada.",
    );
    await recarregar();
    aoFechar();
  }

  async function atualizar() {
    setAgindo(true);
    const { data, error } = await supabase.rpc("tecnico_atualizar_relato", {
      p_relato: relato.id,
      p_status: novoStatus,
      p_visivel: visivel,
      ...(comentario.trim() ? { p_comentario: comentario.trim() } : {}),
    });
    setAgindo(false);

    const r = data as { ok?: boolean; motivo?: string; pontos?: number } | null;
    if (error || !r?.ok) {
      toast.error(r?.motivo ? mensagem(r.motivo) : "Não foi possível atualizar o relato.");
      return;
    }
    toast.success(
      novoStatus === "resolvido" && r.pontos
        ? `Resolvido. +${r.pontos} pontos de bônus para o colaborador.`
        : "Andamento atualizado.",
    );
    setComentario("");
    await recarregar();
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-marinho">
            {rotuloDaCategoria(relato.categoria)}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`rounded-full px-2.5 py-0.5 font-semibold ${corDoStatus(relato.status)}`}
            >
              {rotuloDoStatus(relato.status)}
            </span>
            {relato.gravidade && (
              <span className="rounded-full bg-muted px-2.5 py-0.5 font-semibold text-texto">
                gravidade {relato.gravidade}
              </span>
            )}
            <span className="text-texto-suave">{formatarDataHora(relato.criado_em)}</span>
          </div>

          <p className="text-sm text-texto">{relato.descricao}</p>

          <dl className="grid gap-1 text-sm text-texto-suave">
            <div className="flex gap-2">
              <dt>Quem relatou:</dt>
              <dd className="text-texto">
                {relato.colaboradores?.nome ?? "—"}
                {relato.colaboradores?.matricula && ` (${relato.colaboradores.matricula})`}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt>Onde:</dt>
              <dd className="text-texto">
                {relato.locais?.nome ?? relato.setores?.nome ?? "não informado"}
              </dd>
            </div>
          </dl>

          {duplicadoDe && (
            <div className="rounded-xl bg-laranja/10 p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-laranja">
                <Copy className="size-4" aria-hidden />
                Possível duplicado
              </p>
              <p className="mt-1 text-sm text-texto">{duplicadoDe.descricao}</p>
              <p className="mt-0.5 text-xs text-texto-suave">
                {formatarDataHora(duplicadoDe.criado_em)} · mesmo local e categoria nos últimos 7
                dias
              </p>
            </div>
          )}

          {relato.foto_path && <Foto caminho={relato.foto_path} />}

          {historico.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-texto">Histórico</h3>
              <ol className="mt-2 flex flex-col gap-2">
                {historico.map((h) => (
                  <li key={h.id} className="border-l-2 border-borda pl-3">
                    <p className="text-xs text-texto-suave">
                      {rotuloDoStatus(h.status)} · {formatarDataHora(h.criado_em)}
                      {!h.visivel_colaborador && " · interno"}
                    </p>
                    {h.comentario && <p className="text-sm text-texto">{h.comentario}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {podeAgir && (
            <div className="flex flex-col gap-3 rounded-xl border border-borda p-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="comentario">Comentário</Label>
                <Textarea
                  id="comentario"
                  rows={2}
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="O colaborador vê este texto se a visibilidade estiver ligada."
                />
                <label className="flex items-center justify-between gap-2 text-sm">
                  <span>Visível para o colaborador</span>
                  <Switch checked={visivel} onCheckedChange={setVisivel} />
                </label>
              </div>

              {!relato.validado && relato.status === "aberto" ? (
                <>
                  <fieldset className="flex flex-col gap-1.5">
                    <legend className="text-sm font-medium">Gravidade (para validar)</legend>
                    <div className="flex gap-2">
                      {GRAVIDADES.map((g) => (
                        <button
                          key={g.gravidade}
                          type="button"
                          onClick={() => setGravidade(g.gravidade)}
                          aria-pressed={gravidade === g.gravidade}
                          className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                            gravidade === g.gravidade
                              ? "border-marinho bg-marinho text-white"
                              : "border-borda text-texto"
                          }`}
                        >
                          {g.rotulo}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => decidir("validar")} disabled={agindo}>
                      {agindo && <Loader2 className="size-4 animate-spin" aria-hidden />}
                      <Check className="size-4" aria-hidden />
                      Validar
                    </Button>
                    <Button variant="outline" onClick={() => decidir("rejeitar")} disabled={agindo}>
                      <X className="size-4" aria-hidden />
                      Rejeitar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => decidir("duplicado")}
                      disabled={agindo || !relato.possivel_duplicado_de}
                      title={
                        relato.possivel_duplicado_de
                          ? undefined
                          : "Só marca duplicado quando o sistema aponta o original."
                      }
                    >
                      <Copy className="size-4" aria-hidden />
                      Duplicado
                    </Button>
                  </div>
                  <p className="text-xs text-texto-suave">
                    Rejeitado e duplicado não pontuam. Validar pontua pela gravidade.
                  </p>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="andamento">Andamento</Label>
                    <select
                      id="andamento"
                      value={novoStatus}
                      onChange={(e) => setNovoStatus(e.target.value as StatusRelato)}
                      className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
                    >
                      {STATUS_DE_ANDAMENTO.map((s) => (
                        <option key={s} value={s}>
                          {rotuloDoStatus(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button onClick={atualizar} disabled={agindo}>
                    {agindo && <Loader2 className="size-4 animate-spin" aria-hidden />}
                    Atualizar andamento
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={aoFechar}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Kanban de relatos (docs/TIME_04 §9). */
function Relatos() {
  const { data: perfil } = usePerfil();
  const { data: relatos = [], isLoading } = useRelatos();
  const [aberto, setAberto] = useState<string | null>(null);

  const podeAgir = perfil?.papel === "admin" || perfil?.papel === "tecnico";
  const selecionado = relatos.find((r) => r.id === aberto) ?? null;

  const porColuna = useMemo(() => {
    const mapa = new Map<StatusRelato, RelatoPainel[]>();
    for (const c of COLUNAS_KANBAN) mapa.set(c.status, []);
    for (const r of relatos) mapa.get(r.status)?.push(r);
    return mapa;
  }, [relatos]);

  const foraDoFluxo = relatos.filter((r) => r.status === "rejeitado" || r.status === "duplicado");

  function exportar() {
    baixarCsv(
      `relatos-${new Date().toISOString().slice(0, 10)}.csv`,
      montarCsv(
        [
          "criado_em",
          "categoria",
          "status",
          "gravidade",
          "colaborador",
          "matricula",
          "local",
          "descricao",
        ],
        relatos.map((r) => [
          formatarDataHora(r.criado_em),
          rotuloDaCategoria(r.categoria),
          rotuloDoStatus(r.status),
          r.gravidade ?? "",
          r.colaboradores?.nome ?? "",
          r.colaboradores?.matricula ?? "",
          r.locais?.nome ?? r.setores?.nome ?? "",
          r.descricao,
        ]),
      ),
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="sr-only">Relatos</h1>
        <p className="text-sm text-texto-suave">
          {isLoading ? "Carregando…" : `${relatos.length} relato(s)`}
        </p>
        <MaisOpcoes
          opcoes={[
            {
              rotulo: "Exportar CSV",
              icone: <Download aria-hidden />,
              aoClicar: exportar,
              desabilitado: relatos.length === 0,
            },
          ]}
        />
      </header>

      <div className="grid gap-3 lg:grid-cols-4">
        {COLUNAS_KANBAN.map((coluna) => {
          const daColuna = porColuna.get(coluna.status) ?? [];
          return (
            <section key={coluna.status} className="flex flex-col gap-2">
              <h2 className="flex items-baseline justify-between text-sm font-bold uppercase tracking-wide text-texto-suave">
                {coluna.titulo}
                <span className="tabular-nums">{daColuna.length}</span>
              </h2>

              {daColuna.length === 0 && (
                <p className="rounded-xl border border-dashed border-borda p-3 text-center text-xs text-texto-suave">
                  vazio
                </p>
              )}

              {daColuna.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setAberto(r.id)}
                  className="rounded-xl border border-borda bg-superficie p-3 text-left"
                >
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-texto-suave">
                    {rotuloDaCategoria(r.categoria)}
                    {r.foto_path && <Camera className="size-3" aria-label="com foto" />}
                    {r.possivel_duplicado_de && !r.validado && (
                      <AlertTriangle
                        className="size-3 text-laranja"
                        aria-label="possível duplicado"
                      />
                    )}
                  </span>
                  <span className="mt-1 line-clamp-3 block text-sm text-texto">{r.descricao}</span>
                  <span className="mt-1 block text-xs text-texto-suave">
                    {r.colaboradores?.nome ?? "—"} ·{" "}
                    {r.locais?.nome ?? r.setores?.nome ?? "sem local"}
                  </span>
                </button>
              ))}
            </section>
          );
        })}
      </div>

      {foraDoFluxo.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-texto-suave">
            Fora do fluxo ({foraDoFluxo.length})
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {foraDoFluxo.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setAberto(r.id)}
                  className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-borda bg-superficie p-3 text-left"
                >
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${corDoStatus(r.status)}`}
                  >
                    {rotuloDoStatus(r.status)}
                  </span>
                  <span className="flex-1 text-sm text-texto">{r.descricao}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {selecionado && (
        <Detalhe
          relato={selecionado}
          todos={relatos}
          podeAgir={podeAgir}
          aoFechar={() => setAberto(null)}
        />
      )}
    </div>
  );
}

export const Route = createFileRoute("/_protegido/painel/relatos")({
  component: Relatos,
});
