import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Markdown from "react-markdown";
import { ChevronDown, ChevronUp, Loader2, Pencil, Plus, Star } from "lucide-react";
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
import { useLicoes, usePerguntasDaLicao, type Licao } from "@/hooks/useCampanhas";
import { usePerguntas, type Tema } from "@/hooks/usePerguntas";
import { LETRAS } from "@/lib/importacao/tipos";

const NOTA_MINIMA_PADRAO = 70;
/** docs/TIME_04 §4: recomendado de 3 a 5 perguntas na avaliação. */
const AVALIACAO_RECOMENDADA = { min: 3, max: 5 };

/** Extrai o id de um vídeo do YouTube das formas usuais de link. */
export function idDoYouTube(url: string): string | null {
  const limpo = url.trim();
  if (!limpo) return null;
  const padroes = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([A-Za-z0-9_-]{11})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const re of padroes) {
    const achado = re.exec(limpo);
    if (achado) return achado[1]!;
  }
  return /^[A-Za-z0-9_-]{11}$/.test(limpo) ? limpo : null;
}

function LicaoForm({
  licao,
  campanhaId,
  empresaId,
  temas,
  temasDaCampanha,
  proximaOrdem,
  aoFechar,
}: {
  licao: Licao | null;
  campanhaId: string;
  empresaId: string | null;
  temas: Tema[];
  temasDaCampanha: string[];
  proximaOrdem: number;
  aoFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const editando = licao !== null;
  const { data: perguntas = [] } = usePerguntas();
  const { data: escolhidasIniciais } = usePerguntasDaLicao(licao?.id ?? null);

  const [titulo, setTitulo] = useState(licao?.titulo ?? "");
  const [temaId, setTemaId] = useState(licao?.tema_id ?? temasDaCampanha[0] ?? "");
  const [conteudo, setConteudo] = useState(licao?.conteudo_md ?? "");
  const [video, setVideo] = useState(licao?.video_url ?? "");
  const [carga, setCarga] = useState(licao?.carga_minutos ?? 10);
  const [notaMinima, setNotaMinima] = useState(licao?.nota_minima ?? NOTA_MINIMA_PADRAO);
  const [obrigatoria, setObrigatoria] = useState(licao?.obrigatoria ?? false);
  const [publicada, setPublicada] = useState(licao?.publicada ?? false);
  const [verPrevia, setVerPrevia] = useState(false);
  const [escolhidas, setEscolhidas] = useState<string[] | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Enquanto as perguntas da lição não carregam, usa a lista do banco.
  const selecionadas = escolhidas ?? escolhidasIniciais ?? [];

  const doTema = useMemo(
    () => perguntas.filter((p) => p.tema_id === temaId && p.status === "ativa"),
    [perguntas, temaId],
  );

  const videoId = idDoYouTube(video);
  const problemas: string[] = [];
  if (titulo.trim().length < 3) problemas.push("Dê um título à lição.");
  if (!temaId) problemas.push("Escolha o tema.");
  if (conteudo.trim().length < 20) problemas.push("Escreva o conteúdo da lição.");
  if (video.trim() && !videoId) problemas.push("O link do vídeo não parece ser do YouTube.");
  if (notaMinima < 1 || notaMinima > 100) problemas.push("Nota mínima: use de 1 a 100.");
  if (publicada && selecionadas.length === 0) {
    problemas.push("Para publicar, escolha as perguntas da avaliação.");
  }

  function alternar(id: string) {
    setEscolhidas(
      selecionadas.includes(id) ? selecionadas.filter((p) => p !== id) : [...selecionadas, id],
    );
  }

  async function salvar() {
    if (problemas.length > 0 || !empresaId) return;
    setSalvando(true);

    const linha = {
      tema_id: temaId,
      titulo: titulo.trim(),
      conteudo_md: conteudo.trim(),
      video_url: video.trim() || null,
      carga_minutos: carga,
      nota_minima: notaMinima,
      obrigatoria,
      publicada,
    };

    let id = licao?.id;
    if (editando) {
      const { error } = await supabase.from("licoes").update(linha).eq("id", licao.id);
      if (error) {
        setSalvando(false);
        toast.error("Não foi possível salvar a lição.");
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("licoes")
        .insert({ ...linha, empresa_id: empresaId, campanha_id: campanhaId, ordem: proximaOrdem })
        .select("id")
        .single();
      if (error || !data) {
        setSalvando(false);
        toast.error("Não foi possível criar a lição.");
        return;
      }
      id = data.id;
    }

    // Perguntas da avaliação: troca o conjunto inteiro, guardando a ordem.
    if (id) {
      await supabase.from("licao_perguntas").delete().eq("licao_id", id);
      if (selecionadas.length > 0) {
        const { error } = await supabase.from("licao_perguntas").insert(
          selecionadas.map((pergunta_id, i) => ({
            licao_id: id,
            pergunta_id,
            empresa_id: empresaId,
            ordem: i + 1,
          })),
        );
        if (error) {
          setSalvando(false);
          toast.error("A lição foi salva, mas as perguntas não. Edite e tente de novo.");
          return;
        }
      }
    }

    setSalvando(false);
    toast.success(editando ? "Lição atualizada." : "Lição criada.");
    await queryClient.invalidateQueries({ queryKey: ["licoes", campanhaId] });
    await queryClient.invalidateQueries({ queryKey: ["licao-perguntas", id] });
    aoFechar();
  }

  const quantidade = selecionadas.length;
  const foraDoRecomendado =
    quantidade > 0 &&
    (quantidade < AVALIACAO_RECOMENDADA.min || quantidade > AVALIACAO_RECOMENDADA.max);

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-marinho">
            {editando ? "Editar lição" : "Nova lição"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="titulo">Título</Label>
            <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="tema-licao">Tema</Label>
              <select
                id="tema-licao"
                value={temaId}
                onChange={(e) => setTemaId(e.target.value)}
                className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Escolha…</option>
                {temas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.icone} {t.nome}
                    {temasDaCampanha.includes(t.id) ? "" : " (fora da campanha)"}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="carga">Carga (minutos)</Label>
              <Input
                id="carga"
                type="number"
                min={1}
                value={carga}
                onChange={(e) => setCarga(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="conteudo">Conteúdo (Markdown)</Label>
              <button
                type="button"
                onClick={() => setVerPrevia((v) => !v)}
                className="text-sm font-medium text-marinho underline-offset-4 hover:underline"
              >
                {verPrevia ? "Editar" : "Pré-visualizar"}
              </button>
            </div>
            {verPrevia ? (
              <div className="prose-time min-h-40 rounded-md border border-borda bg-fundo p-4 text-sm">
                <Markdown>{conteudo || "_Nada escrito ainda._"}</Markdown>
              </div>
            ) : (
              <Textarea
                id="conteudo"
                rows={10}
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                placeholder={
                  "## Por que isso importa\n\nTexto curto, direto, para ler no celular.\n\n- item\n- item"
                }
                className="font-mono text-xs"
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="video">Vídeo do YouTube (opcional)</Label>
            <Input
              id="video"
              value={video}
              onChange={(e) => setVideo(e.target.value)}
              placeholder="https://youtu.be/..."
            />
            {videoId && <p className="text-xs text-verde">Vídeo reconhecido: {videoId}</p>}
          </div>

          <fieldset className="flex flex-col gap-2 rounded-xl border border-borda p-3">
            <legend className="px-1 text-sm font-medium">Perguntas da avaliação</legend>
            {!temaId && <p className="text-sm text-texto-suave">Escolha o tema primeiro.</p>}
            {temaId && doTema.length === 0 && (
              <p className="text-sm text-laranja">
                Nenhuma pergunta ativa neste tema. Cadastre ou importe antes de publicar.
              </p>
            )}
            {doTema.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selecionadas.includes(p.id)}
                  onChange={() => alternar(p.id)}
                  className="mt-1 size-4 shrink-0"
                />
                <span>
                  <span className="block text-texto">{p.enunciado}</span>
                  <span className="block text-xs text-texto-suave">
                    Correta: {LETRAS[p.correta]}) {p.alternativas[p.correta]}
                  </span>
                </span>
              </label>
            ))}
            <p className={`text-xs ${foraDoRecomendado ? "text-laranja" : "text-texto-suave"}`}>
              {quantidade} escolhida(s). Recomendado de {AVALIACAO_RECOMENDADA.min} a{" "}
              {AVALIACAO_RECOMENDADA.max}.
            </p>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nota">Nota mínima</Label>
              <Input
                id="nota"
                type="number"
                min={1}
                max={100}
                value={notaMinima}
                onChange={(e) => setNotaMinima(Number(e.target.value))}
              />
            </div>
            <label className="flex items-center justify-between gap-2 rounded-xl border border-borda px-3 py-2">
              <span className="text-sm">Obrigatória</span>
              <Switch checked={obrigatoria} onCheckedChange={setObrigatoria} />
            </label>
            <label className="flex items-center justify-between gap-2 rounded-xl border border-borda px-3 py-2">
              <span className="text-sm">Publicada</span>
              <Switch checked={publicada} onCheckedChange={setPublicada} />
            </label>
          </div>

          {problemas.length > 0 && (
            <ul className="rounded-lg bg-vermelho/10 p-3 text-sm text-vermelho">
              {problemas.map((p) => (
                <li key={p}>• {p}</li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={problemas.length > 0 || salvando || !empresaId}>
            {salvando && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Aba Trilha do detalhe da campanha (docs/TIME_04 §4). */
export function TrilhaDaCampanha({
  campanhaId,
  empresaId,
  temas,
  temasDaCampanha,
  podeEditar,
}: {
  campanhaId: string;
  empresaId: string | null;
  temas: Tema[];
  temasDaCampanha: string[];
  podeEditar: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: licoes = [], isLoading } = useLicoes(campanhaId);
  const [editando, setEditando] = useState<Licao | "nova" | null>(null);
  const [movendo, setMovendo] = useState(false);

  const nomeDoTema = new Map(temas.map((t) => [t.id, `${t.icone} ${t.nome}`]));

  /**
   * Reordena por botões em vez de arrastar: funciona com teclado e com luva, e
   * o `TIME_05` §6 já exige o app usável com uma mão. Arrastar entra se o
   * técnico pedir.
   */
  async function mover(indice: number, direcao: -1 | 1) {
    const outro = indice + direcao;
    if (outro < 0 || outro >= licoes.length) return;
    const a = licoes[indice]!;
    const b = licoes[outro]!;

    setMovendo(true);
    const [r1, r2] = await Promise.all([
      supabase.from("licoes").update({ ordem: b.ordem }).eq("id", a.id),
      supabase.from("licoes").update({ ordem: a.ordem }).eq("id", b.id),
    ]);
    setMovendo(false);

    if (r1.error || r2.error) {
      toast.error("Não foi possível reordenar.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["licoes", campanhaId] });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-texto-suave">
          {isLoading ? "Carregando…" : `${licoes.length} lição(ões) na trilha`}
        </p>
        {podeEditar && (
          <Button onClick={() => setEditando("nova")}>
            <Plus className="size-4" aria-hidden />
            Nova lição
          </Button>
        )}
      </div>

      {!isLoading && licoes.length === 0 && (
        <p className="rounded-2xl border border-borda bg-superficie p-6 text-center text-sm text-texto-suave">
          A trilha está vazia. A lição só aparece no app depois de publicada e com as perguntas da
          avaliação escolhidas.
        </p>
      )}

      <ol className="flex flex-col gap-2.5">
        {licoes.map((l, i) => (
          <li
            key={l.id}
            className="flex items-start gap-3 rounded-2xl border border-borda bg-superficie p-4"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-display font-bold text-marinho">
              {i + 1}
            </span>

            <div className="flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium text-texto">
                {l.titulo}
                {l.obrigatoria && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-amarelo">
                    <Star className="size-3" aria-hidden />
                    obrigatória
                  </span>
                )}
                {!l.publicada && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-texto-suave">
                    rascunho
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-texto-suave">
                {nomeDoTema.get(l.tema_id) ?? "tema removido"} · {l.carga_minutos} min · nota mínima{" "}
                {l.nota_minima}
              </p>
            </div>

            {podeEditar && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => mover(i, -1)}
                  disabled={i === 0 || movendo}
                  aria-label="Subir na trilha"
                  className="flex size-8 items-center justify-center rounded-lg text-texto-suave hover:bg-muted disabled:opacity-30"
                >
                  <ChevronUp className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => mover(i, 1)}
                  disabled={i === licoes.length - 1 || movendo}
                  aria-label="Descer na trilha"
                  className="flex size-8 items-center justify-center rounded-lg text-texto-suave hover:bg-muted disabled:opacity-30"
                >
                  <ChevronDown className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setEditando(l)}
                  aria-label={`Editar ${l.titulo}`}
                  className="flex size-8 items-center justify-center rounded-lg text-texto-suave hover:bg-muted"
                >
                  <Pencil className="size-4" aria-hidden />
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>

      {editando && (
        <LicaoForm
          licao={editando === "nova" ? null : editando}
          campanhaId={campanhaId}
          empresaId={empresaId}
          temas={temas}
          temasDaCampanha={temasDaCampanha}
          proximaOrdem={(licoes.at(-1)?.ordem ?? 0) + 1}
          aoFechar={() => setEditando(null)}
        />
      )}
    </div>
  );
}
