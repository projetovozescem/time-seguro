import { useState } from "react";
import { Check, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { mensagem } from "@/lib/mensagens";
import type { Modo } from "@/lib/jogos/partida";

/**
 * Botão "Salvar pontuação" dos três modos de TV (docs/TIME_06 §5).
 *
 * Um só lugar chama `tecnico_salvar_quiz_tv`: o servidor recalcula os pontos a
 * partir das respostas, então o que a tela manda é o registro do que aconteceu,
 * não a pontuação final. Sem evento é treino — o botão nem aparece.
 */
export function SalvarPontuacao({
  eventoId,
  modo,
  duracaoMs,
  equipes,
  respostas,
}: {
  eventoId: string | null;
  modo: Modo;
  duracaoMs: number;
  equipes: { setor_id: string | null; pontos: number }[];
  respostas: {
    setor_id: string | null;
    pergunta_id: string;
    alternativa: number;
    tempo_ms: number;
    ordem: number;
  }[];
}) {
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  if (!eventoId) {
    return (
      <p className="text-xl text-white/70">
        Treino: o resultado não é salvo e não entra no ranking.
      </p>
    );
  }

  if (salvo) {
    return (
      <p className="flex items-center gap-2 text-2xl text-verde">
        <Check className="size-7" aria-hidden />
        Pontuação salva
      </p>
    );
  }

  // Const local: o TypeScript nao mantem o estreitamento de `eventoId` dentro
  // do closure, embora o retorno acima garanta que aqui ele nao e nulo.
  const evento = eventoId;

  async function salvar() {
    setSalvando(true);
    const { data, error } = await supabase.rpc("tecnico_salvar_quiz_tv", {
      p_evento: evento,
      p_modo: modo,
      p_duracao_ms: duracaoMs,
      p_equipes: equipes,
      p_respostas: respostas,
    });
    setSalvando(false);

    const r = data as { ok?: boolean; motivo?: string } | null;
    if (error || !r?.ok) {
      toast.error(
        r?.motivo === "evento_ja_tem_sessao"
          ? "Este evento já tem pontuação salva."
          : r?.motivo
            ? mensagem(r.motivo)
            : "Não foi possível salvar a pontuação.",
      );
      return;
    }
    setSalvo(true);
    toast.success("Pontuação salva. Os pontos entraram no ranking do setor.");
  }

  return (
    <Button
      onClick={salvar}
      disabled={salvando}
      className="min-h-20 bg-amarelo px-10 text-2xl font-extrabold text-texto hover:bg-amarelo/90"
    >
      {salvando && <Loader2 className="size-6 animate-spin" aria-hidden />}
      <Save className="size-6" aria-hidden />
      Salvar pontuação
    </Button>
  );
}
