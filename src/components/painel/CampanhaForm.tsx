import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  CONFIG_CAMPANHA,
  ROTULO_DO_PILAR,
  configParaGravar,
  tetoDiarioDoQuiz,
  validarCampanha,
  valorEmVigor,
  type Config,
  type Pilar,
} from "@/lib/campanha";
import type { Campanha } from "@/hooks/useCampanhas";
import type { Tema } from "@/hooks/usePerguntas";

const PILARES: Pilar[] = ["conhecimento", "relatos", "engajamento"];

/** Criar e editar campanha (docs/TIME_04 §4 "Criar/editar"). */
export function CampanhaForm({
  campanha,
  temasIniciais,
  temas,
  empresaId,
  aoFechar,
}: {
  campanha: Campanha | null;
  temasIniciais: string[];
  temas: Tema[];
  empresaId: string | null;
  aoFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const editando = campanha !== null;

  const [nome, setNome] = useState(campanha?.nome ?? "");
  const [descricao, setDescricao] = useState(campanha?.descricao ?? "");
  const [inicio, setInicio] = useState(campanha?.inicio ?? "");
  const [fim, setFim] = useState(campanha?.fim ?? "");
  const [escolhidos, setEscolhidos] = useState<string[]>(temasIniciais);
  const [perguntasPorDia, setPerguntasPorDia] = useState(campanha?.perguntas_por_dia ?? 5);
  const [premiacao, setPremiacao] = useState(campanha?.premiacao ?? "");
  const [rankingVisivel, setRankingVisivel] = useState(campanha?.ranking_visivel ?? true);
  const [avancado, setAvancado] = useState(false);
  const [config, setConfig] = useState<Config>({ ...(campanha?.config ?? {}) });
  const [salvando, setSalvando] = useState(false);

  const erros = validarCampanha({
    nome,
    descricao,
    inicio,
    fim,
    temas: escolhidos,
    perguntas_por_dia: perguntasPorDia,
    premiacao,
    ranking_visivel: rankingVisivel,
  });

  const pontosPorAcerto = Number(
    valorEmVigor(
      config,
      CONFIG_CAMPANHA.find((d) => d.chave === "pontos_acerto_diario")!,
    ),
  );
  const teto = tetoDiarioDoQuiz(perguntasPorDia, pontosPorAcerto);

  const alternarTema = (id: string) =>
    setEscolhidos((atual) => (atual.includes(id) ? atual.filter((t) => t !== id) : [...atual, id]));

  async function salvar() {
    if (erros.length > 0 || !empresaId) return;
    setSalvando(true);

    const linha = {
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      inicio,
      fim,
      perguntas_por_dia: perguntasPorDia,
      premiacao: premiacao.trim() || null,
      ranking_visivel: rankingVisivel,
      config: configParaGravar(config),
    };

    let id = campanha?.id;
    if (editando) {
      const { error } = await supabase.from("campanhas").update(linha).eq("id", campanha.id);
      if (error) {
        setSalvando(false);
        toast.error("Não foi possível salvar a campanha.");
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("campanhas")
        .insert({ ...linha, empresa_id: empresaId, status: "rascunho" })
        .select("id")
        .single();
      if (error || !data) {
        setSalvando(false);
        toast.error("Não foi possível criar a campanha.");
        return;
      }
      id = data.id;
    }

    // Os temas são uma tabela de ligação: troca o conjunto inteiro.
    if (id) {
      await supabase.from("campanha_temas").delete().eq("campanha_id", id);
      if (escolhidos.length > 0) {
        const { error } = await supabase
          .from("campanha_temas")
          .insert(
            escolhidos.map((tema_id) => ({ campanha_id: id, tema_id, empresa_id: empresaId })),
          );
        if (error) {
          setSalvando(false);
          toast.error("A campanha foi salva, mas os temas não. Edite e tente de novo.");
          return;
        }
      }
    }

    setSalvando(false);
    toast.success(editando ? "Campanha atualizada." : "Campanha criada como rascunho.");
    await queryClient.invalidateQueries({ queryKey: ["campanhas"] });
    await queryClient.invalidateQueries({ queryKey: ["campanha", id] });
    await queryClient.invalidateQueries({ queryKey: ["campanha-temas", id] });
    aoFechar();
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-marinho">
            {editando ? "Editar campanha" : "Nova campanha"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inicio">Início</Label>
              <Input
                id="inicio"
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fim">Fim</Label>
              <Input id="fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">
              Temas do quiz diário <span className="text-texto-suave">(pelo menos um)</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {temas.map((t) => {
                const marcado = escolhidos.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => alternarTema(t.id)}
                    aria-pressed={marcado}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      marcado
                        ? "border-marinho bg-marinho text-white"
                        : "border-borda text-texto hover:border-marinho"
                    }`}
                  >
                    {t.icone} {t.nome}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ppd">Perguntas por dia</Label>
              <Input
                id="ppd"
                type="number"
                min={1}
                max={20}
                value={perguntasPorDia}
                onChange={(e) => setPerguntasPorDia(Number(e.target.value))}
              />
              <p className="text-xs text-texto-suave">
                Teto do quiz: {teto} pontos por dia ({perguntasPorDia} × {pontosPorAcerto}).
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="premiacao">Premiação</Label>
              <Input
                id="premiacao"
                value={premiacao}
                onChange={(e) => setPremiacao(e.target.value)}
                placeholder="Definida pela empresa, entregue fora do sistema"
              />
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-borda p-3">
            <span>
              <span className="block text-sm font-medium text-texto">
                Ranking visível aos colaboradores
              </span>
              <span className="block text-xs text-texto-suave">
                Desligado, o app mostra “o ranking será revelado no fim da campanha”.
              </span>
            </span>
            <Switch checked={rankingVisivel} onCheckedChange={setRankingVisivel} />
          </label>

          <div className="rounded-xl border border-borda">
            <button
              type="button"
              onClick={() => setAvancado((a) => !a)}
              aria-expanded={avancado}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-texto"
            >
              <ChevronDown
                className={`size-4 transition-transform ${avancado ? "rotate-180" : ""}`}
                aria-hidden
              />
              Pontos avançados
              <span className="ml-auto text-xs font-normal text-texto-suave">
                em branco = padrão
              </span>
            </button>

            {avancado && (
              <div className="border-t border-borda p-4">
                <p className="mb-3 text-xs text-texto-suave">
                  Os padrões vêm de <code>docs/TIME_08</code> §1. Só o que você mudar é gravado na
                  campanha — assim um ajuste futuro no padrão vale para as campanhas que não
                  sobrescreveram.
                </p>
                {PILARES.map((pilar) => (
                  <div key={pilar} className="mb-4 last:mb-0">
                    <h4 className="mb-2 text-sm font-semibold text-marinho">
                      {ROTULO_DO_PILAR[pilar]}
                    </h4>
                    <div className="flex flex-col gap-2">
                      {CONFIG_CAMPANHA.filter((d) => d.pilar === pilar).map((d) => (
                        <div
                          key={d.chave}
                          className="grid gap-1 sm:grid-cols-[1fr_7rem] sm:items-center"
                        >
                          <span>
                            <Label htmlFor={d.chave} className="text-sm font-normal">
                              {d.rotulo}
                            </Label>
                            <span className="block text-xs text-texto-suave">{d.ajuda}</span>
                          </span>
                          {typeof d.padrao === "boolean" ? (
                            <Switch
                              id={d.chave}
                              checked={Boolean(valorEmVigor(config, d))}
                              onCheckedChange={(v) => setConfig((c) => ({ ...c, [d.chave]: v }))}
                            />
                          ) : (
                            <Input
                              id={d.chave}
                              type="number"
                              min={0}
                              placeholder={String(d.padrao)}
                              value={config[d.chave] === undefined ? "" : String(config[d.chave])}
                              onChange={(e) =>
                                setConfig((c) => {
                                  const proximo = { ...c };
                                  if (e.target.value === "") delete proximo[d.chave];
                                  else proximo[d.chave] = Number(e.target.value);
                                  return proximo;
                                })
                              }
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
