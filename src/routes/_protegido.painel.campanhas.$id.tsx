import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Play, Square } from "lucide-react";
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
import { TrilhaDaCampanha } from "@/components/painel/TrilhaDaCampanha";
import { usePerfil } from "@/hooks/usePerfil";
import { useCampanha, useNumerosDaCampanha, useTemasDaCampanha } from "@/hooks/useCampanhas";
import { useTemas } from "@/hooks/usePerguntas";
import {
  CONFIG_CAMPANHA,
  COR_DO_STATUS,
  ROTULO_DO_PILAR,
  ROTULO_DO_STATUS,
  valorEmVigor,
} from "@/lib/campanha";
import { mensagem } from "@/lib/mensagens";
import { formatarData } from "@/lib/datas";

type Aba = "geral" | "trilha" | "eventos" | "ranking" | "resultados";

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "geral", rotulo: "Visão geral" },
  { id: "trilha", rotulo: "Trilha" },
  { id: "eventos", rotulo: "Eventos" },
  { id: "ranking", rotulo: "Ranking" },
  { id: "resultados", rotulo: "Resultados" },
];

/** Confirmação do encerramento (docs/TIME_04 §4): o texto avisa que não desfaz. */
function ConfirmarEncerramento({
  aoConfirmar,
  aoFechar,
  encerrando,
}: {
  aoConfirmar: (topN: number) => void;
  aoFechar: () => void;
  encerrando: boolean;
}) {
  const [topN, setTopN] = useState(3);

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-marinho">Encerrar campanha</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-texto">
          Isso congela o ranking, concede os selos finais e emite os certificados.{" "}
          <strong>Não dá para desfazer.</strong>
        </p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="top-n">Quantos destaques gerais recebem certificado?</Label>
          <Input
            id="top-n"
            type="number"
            min={1}
            max={50}
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value))}
          />
          <p className="text-xs text-texto-suave">
            Além destes, o 1º lugar de cada setor também recebe.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button
            onClick={() => aoConfirmar(topN)}
            disabled={encerrando || topN < 1}
            className="bg-vermelho hover:bg-vermelho/90"
          >
            {encerrando && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Encerrar mesmo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Detalhe() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: perfil } = usePerfil();
  const { data: campanha, isLoading } = useCampanha(id);
  const { data: temasVinculados = [] } = useTemasDaCampanha(id);
  const { data: temas = [] } = useTemas();
  const { data: numeros } = useNumerosDaCampanha(id);

  const [aba, setAba] = useState<Aba>("geral");
  const [confirmando, setConfirmando] = useState(false);
  const [agindo, setAgindo] = useState(false);

  const podeAgir = perfil?.papel === "admin" || perfil?.papel === "tecnico";

  async function recarregar() {
    await queryClient.invalidateQueries({ queryKey: ["campanha", id] });
    await queryClient.invalidateQueries({ queryKey: ["campanhas"] });
    await queryClient.invalidateQueries({ queryKey: ["campanha-ativa"] });
  }

  async function ativar() {
    setAgindo(true);
    const { data, error } = await supabase.rpc("tecnico_ativar_campanha", { p_campanha: id });
    setAgindo(false);

    const r = data as { ok?: boolean; motivo?: string } | null;
    if (error || !r?.ok) {
      toast.error(r?.motivo ? mensagem(r.motivo) : "Não foi possível ativar a campanha.");
      return;
    }
    toast.success("Campanha ativa. O quiz diário já está no ar.");
    await recarregar();
  }

  async function encerrar(topN: number) {
    setAgindo(true);
    const { data, error } = await supabase.rpc("tecnico_encerrar_campanha", {
      p_campanha: id,
      p_top_n: topN,
    });
    setAgindo(false);
    setConfirmando(false);

    const r = data as { ok?: boolean; motivo?: string } | null;
    if (error || !r?.ok) {
      toast.error(r?.motivo ? mensagem(r.motivo) : "Não foi possível encerrar a campanha.");
      return;
    }
    toast.success("Campanha encerrada. Ranking congelado e certificados emitidos.");
    await recarregar();
    await queryClient.invalidateQueries({ queryKey: ["campanha-numeros", id] });
  }

  if (isLoading) {
    return <p className="text-sm text-texto-suave">Carregando…</p>;
  }

  if (!campanha) {
    return (
      <div className="rounded-2xl border border-borda bg-superficie p-6">
        <p className="text-sm text-texto">Campanha não encontrada.</p>
        <Button variant="outline" asChild className="mt-4">
          <Link to="/painel/campanhas">Voltar</Link>
        </Button>
      </div>
    );
  }

  const nomeDoTema = new Map(temas.map((t) => [t.id, `${t.icone} ${t.nome}`]));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-extrabold text-marinho">{campanha.nome}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${COR_DO_STATUS[campanha.status]}`}
            >
              {ROTULO_DO_STATUS[campanha.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-texto-suave">
            {formatarData(campanha.inicio)} a {formatarData(campanha.fim)} ·{" "}
            {campanha.perguntas_por_dia} perguntas por dia
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/painel/campanhas">
            <ArrowLeft className="size-4" aria-hidden />
            Campanhas
          </Link>
        </Button>
      </header>

      <div className="flex flex-wrap gap-1 overflow-x-auto rounded-xl bg-muted p-1">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAba(a.id)}
            aria-pressed={aba === a.id}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              aba === a.id ? "bg-superficie text-marinho shadow-sm" : "text-texto-suave"
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {aba === "geral" && (
        <div className="flex flex-col gap-4">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { r: "Participantes", v: numeros?.participantes },
              { r: "Pontos lançados", v: numeros?.pontos },
              { r: "Respostas", v: numeros?.respostas },
              { r: "Relatos", v: numeros?.relatos },
            ].map((n) => (
              <div key={n.r} className="rounded-2xl border border-borda bg-superficie p-4">
                <dt className="text-xs uppercase tracking-wide text-texto-suave">{n.r}</dt>
                <dd className="mt-1 font-display text-2xl font-extrabold tabular-nums text-marinho">
                  {n.v ?? "—"}
                </dd>
              </div>
            ))}
          </dl>

          <section className="rounded-2xl border border-borda bg-superficie p-4">
            <h2 className="font-display text-lg font-bold text-texto">Temas do quiz</h2>
            {temasVinculados.length === 0 ? (
              <p className="mt-2 text-sm text-laranja">
                Nenhum tema vinculado. A campanha não pode ser ativada sem pelo menos um.
              </p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {temasVinculados.map((t) => (
                  <li key={t} className="rounded-full bg-muted px-3 py-1 text-sm text-texto">
                    {nomeDoTema.get(t) ?? "tema removido"}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-borda bg-superficie p-4">
            <h2 className="font-display text-lg font-bold text-texto">Pontos em vigor</h2>
            <p className="mt-1 text-xs text-texto-suave">
              Valor em negrito foi ajustado nesta campanha; o resto usa o padrão de{" "}
              <code>docs/TIME_08</code>.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              {(["conhecimento", "relatos", "engajamento"] as const).map((pilar) => (
                <div key={pilar}>
                  <h3 className="text-sm font-semibold text-marinho">{ROTULO_DO_PILAR[pilar]}</h3>
                  <ul className="mt-1 flex flex-col gap-0.5 text-sm">
                    {CONFIG_CAMPANHA.filter((d) => d.pilar === pilar).map((d) => {
                      const valor = valorEmVigor(campanha.config, d);
                      const ajustado = campanha.config?.[d.chave] !== undefined;
                      return (
                        <li key={d.chave} className="flex justify-between gap-2">
                          <span className="text-texto-suave">{d.rotulo}</span>
                          <span className={ajustado ? "font-bold text-marinho" : "text-texto"}>
                            {typeof valor === "boolean" ? (valor ? "sim" : "não") : valor}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {podeAgir && (
            <div className="flex flex-wrap gap-2">
              {campanha.status === "rascunho" && (
                <Button onClick={ativar} disabled={agindo || temasVinculados.length === 0}>
                  {agindo && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  <Play className="size-4" aria-hidden />
                  Ativar campanha
                </Button>
              )}
              {campanha.status === "ativa" && (
                <Button variant="outline" onClick={() => setConfirmando(true)} disabled={agindo}>
                  <Square className="size-4" aria-hidden />
                  Encerrar campanha
                </Button>
              )}
              {campanha.status === "encerrada" && (
                <p className="text-sm text-texto-suave">
                  Encerrada em {formatarData(campanha.encerrada_em)}. O ranking está congelado.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {aba === "trilha" && (
        <TrilhaDaCampanha
          campanhaId={id}
          empresaId={perfil?.empresa.id ?? null}
          temas={temas}
          temasDaCampanha={temasVinculados}
          podeEditar={podeAgir}
        />
      )}

      {aba === "eventos" && (
        <section className="rounded-2xl border border-borda bg-superficie p-6">
          <h2 className="font-display text-lg font-bold text-texto">Eventos da campanha</h2>
          <p className="mt-2 text-sm text-texto-suave">
            O calendário de DDS, SIPAT e treinamentos fica em Eventos, no menu lateral — lá dá para
            abrir o check-in na TV e ver a lista de presença.
          </p>
          <Button variant="outline" asChild className="mt-4">
            <Link to="/painel/eventos">Abrir Eventos</Link>
          </Button>
        </section>
      )}

      {(aba === "ranking" || aba === "resultados") && (
        <section className="rounded-2xl border border-borda bg-superficie p-6">
          <h2 className="font-display text-lg font-bold text-texto">
            {aba === "ranking" ? "Ranking" : "Resultados"}
          </h2>
          <p className="mt-2 text-sm text-texto-suave">
            {aba === "ranking"
              ? "O ranking individual e por setor entra junto com a tela de Ranking do menu."
              : campanha.status === "encerrada"
                ? "O ranking congelado, os selos e os certificados emitidos entram com a tela de Certificados."
                : "Os resultados aparecem depois de encerrar a campanha."}
          </p>
        </section>
      )}

      {confirmando && (
        <ConfirmarEncerramento
          aoConfirmar={encerrar}
          aoFechar={() => setConfirmando(false)}
          encerrando={agindo}
        />
      )}
    </div>
  );
}

export const Route = createFileRoute("/_protegido/painel/campanhas/$id")({
  component: Detalhe,
});
