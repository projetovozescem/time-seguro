import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
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
import { LETRAS } from "@/lib/importacao/tipos";
import type { Pergunta, Tema } from "@/hooks/usePerguntas";

const MIN_ALTERNATIVAS = 2;
const MAX_ALTERNATIVAS = 5;
const DIFICULDADES = [
  { valor: 1, rotulo: "Fácil" },
  { valor: 2, rotulo: "Média" },
  { valor: 3, rotulo: "Difícil" },
];

/**
 * Criar e editar pergunta (docs/TIME_04 §5): 2 a 5 alternativas A–E, a correta
 * marcada clicando, explicação recomendada, dificuldade 1–3 e tema.
 *
 * Pergunta global (`empresa_id` nulo) não chega aqui: a tela oferece
 * "Copiar para minha empresa" em vez de editar.
 */
export function PerguntaForm({
  pergunta,
  temas,
  empresaId,
  aoFechar,
}: {
  pergunta: Pergunta | null;
  temas: Tema[];
  empresaId: string | null;
  aoFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const editando = pergunta !== null;

  const [enunciado, setEnunciado] = useState(pergunta?.enunciado ?? "");
  const [alternativas, setAlternativas] = useState<string[]>(pergunta?.alternativas ?? ["", ""]);
  const [correta, setCorreta] = useState<number | null>(pergunta?.correta ?? null);
  const [temaId, setTemaId] = useState(pergunta?.tema_id ?? "");
  const [explicacao, setExplicacao] = useState(pergunta?.explicacao ?? "");
  const [dificuldade, setDificuldade] = useState(pergunta?.dificuldade ?? 2);
  const [status, setStatus] = useState<"ativa" | "inativa">(pergunta?.status ?? "ativa");
  const [salvando, setSalvando] = useState(false);

  const preenchidas = alternativas.filter((a) => a.trim().length > 0);
  const problemas: string[] = [];
  if (enunciado.trim().length < 10) problemas.push("Escreva o enunciado.");
  if (preenchidas.length < MIN_ALTERNATIVAS) problemas.push("Preencha pelo menos 2 alternativas.");
  if (correta === null || !alternativas[correta]?.trim()) {
    problemas.push("Marque qual alternativa é a correta.");
  }
  if (!temaId) problemas.push("Escolha o tema.");

  function alterar(i: number, valor: string) {
    setAlternativas((atual) => atual.map((a, j) => (j === i ? valor : a)));
  }

  function remover(i: number) {
    setAlternativas((atual) => atual.filter((_, j) => j !== i));
    // A correta anda junto com a lista; se era a removida, desmarca.
    setCorreta((c) => (c === null ? null : c === i ? null : c > i ? c - 1 : c));
  }

  async function salvar() {
    if (problemas.length > 0 || !empresaId) return;
    setSalvando(true);

    const linha = {
      tema_id: temaId,
      enunciado: enunciado.trim(),
      alternativas: preenchidas.map((a) => a.trim()),
      correta: correta!,
      explicacao: explicacao.trim() || null,
      dificuldade,
      status,
    };

    const { error } = editando
      ? await supabase.from("perguntas").update(linha).eq("id", pergunta.id)
      : await supabase
          .from("perguntas")
          .insert({ ...linha, empresa_id: empresaId, origem: "manual" });

    setSalvando(false);

    if (error) {
      toast.error(
        error.message.includes("perguntas_alternativas")
          ? "Alternativas inválidas: use de 2 a 5."
          : "Não foi possível salvar a pergunta.",
      );
      return;
    }

    toast.success(editando ? "Pergunta atualizada." : "Pergunta criada.");
    await queryClient.invalidateQueries({ queryKey: ["perguntas"] });
    aoFechar();
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-marinho">
            {editando ? "Editar pergunta" : "Nova pergunta"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="enunciado">Enunciado</Label>
            <Textarea
              id="enunciado"
              rows={3}
              value={enunciado}
              onChange={(e) => setEnunciado(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Alternativas — toque na letra para marcar a correta</Label>
            {alternativas.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCorreta(i)}
                  aria-label={`Marcar ${LETRAS[i]} como correta`}
                  aria-pressed={correta === i}
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full border-2 font-display font-bold transition-colors ${
                    correta === i
                      ? "border-verde bg-verde text-white"
                      : "border-borda text-marinho hover:border-marinho"
                  }`}
                >
                  {correta === i ? <Check className="size-5" aria-hidden /> : LETRAS[i]}
                </button>
                <Input
                  value={a}
                  onChange={(e) => alterar(i, e.target.value)}
                  className="min-h-10"
                />
                {alternativas.length > MIN_ALTERNATIVAS && (
                  <button
                    type="button"
                    onClick={() => remover(i)}
                    aria-label={`Remover alternativa ${LETRAS[i]}`}
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg text-texto-suave hover:text-vermelho"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </div>
            ))}
            {alternativas.length < MAX_ALTERNATIVAS && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => setAlternativas((atual) => [...atual, ""])}
              >
                <Plus className="size-4" aria-hidden />
                Alternativa
              </Button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="tema">Tema</Label>
              <select
                id="tema"
                value={temaId}
                onChange={(e) => setTemaId(e.target.value)}
                className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Escolha…</option>
                {temas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.icone} {t.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dificuldade">Dificuldade</Label>
              <select
                id="dificuldade"
                value={dificuldade}
                onChange={(e) => setDificuldade(Number(e.target.value))}
                className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {DIFICULDADES.map((d) => (
                  <option key={d.valor} value={d.valor}>
                    {d.rotulo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="explicacao">Explicação (recomendada)</Label>
            <Textarea
              id="explicacao"
              rows={3}
              value={explicacao}
              onChange={(e) => setExplicacao(e.target.value)}
              placeholder="Aparece para o colaborador depois que ele responde."
            />
            {!explicacao.trim() && (
              <p className="text-xs text-laranja">
                Sem explicação o colaborador não aprende com o erro.
              </p>
            )}
          </div>

          {editando && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as "ativa" | "inativa")}
                className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="ativa">Ativa — entra no sorteio do quiz</option>
                <option value="inativa">Inativa — fica guardada, fora do quiz</option>
              </select>
            </div>
          )}

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
