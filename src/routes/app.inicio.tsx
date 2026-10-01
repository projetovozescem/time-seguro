import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HelpCircle, Megaphone } from "lucide-react";
import { AlunoLayout } from "@/components/layout/AlunoLayout";
import { rpcApp } from "@/lib/rpc";
import { sessao } from "@/lib/sessao";
import { mensagem } from "@/lib/mensagens";

/** Resposta de `colaborador_resumo` (docs/TIME_05 §4). */
type Resumo = {
  nome: string;
  setor: string | null;
  campanha: { nome: string; dias_restantes: number; premiacao: string | null } | null;
  pontos: { total: number; conhecimento: number; relatos: number; engajamento: number };
  sequencia: number;
  posicao: { geral: number | null; setor: number | null } | null;
  quiz_do_dia: { respondidas: number; total: number };
};

const PILARES = [
  { chave: "conhecimento", rotulo: "Conhecimento", emoji: "🧠", cor: "bg-marinho" },
  { chave: "relatos", rotulo: "Relatos", emoji: "📢", cor: "bg-laranja" },
  { chave: "engajamento", rotulo: "Engajamento", emoji: "🔥", cor: "bg-amarelo" },
] as const;

/** Home do app (docs/TIME_05 §4): pontos por pilar, sequência e missões do dia. */
function AppInicio() {
  const navigate = useNavigate();
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!sessao.token()) {
      void navigate({ to: "/app/entrar", replace: true });
      return;
    }
    rpcApp<Resumo>("colaborador_resumo")
      .then(setResumo)
      .catch(() => setErro(mensagem("erro_interno")));
  }, [navigate]);

  if (erro) {
    return (
      <AlunoLayout>
        <p role="alert" className="rounded-2xl bg-superficie p-6 text-sm text-vermelho shadow-sm">
          {erro}
        </p>
      </AlunoLayout>
    );
  }

  if (!resumo) {
    return (
      <AlunoLayout>
        <p className="rounded-2xl bg-superficie p-6 text-sm text-texto-suave shadow-sm">
          Carregando…
        </p>
      </AlunoLayout>
    );
  }

  // Sem campanha ativa o app não mostra missões (docs/TIME_05 §4).
  if (!resumo.campanha) {
    return (
      <AlunoLayout>
        <div className="rounded-3xl bg-superficie p-6 text-center shadow-sm">
          <p className="font-display text-lg font-bold text-marinho">
            Nenhuma campanha no momento.
          </p>
          <p className="mt-2 text-sm text-texto-suave">Fique de olho nos avisos da SST!</p>
        </div>
      </AlunoLayout>
    );
  }

  const maior = Math.max(resumo.pontos.total, 1);

  return (
    <AlunoLayout>
      <div className="flex flex-col gap-4">
        <div className="rounded-3xl bg-superficie p-5 shadow-sm">
          <p className="font-display text-lg font-bold text-marinho">
            Olá, {resumo.nome.split(" ")[0]}! 👷
          </p>
          {resumo.setor && <p className="text-sm text-texto-suave">{resumo.setor}</p>}
          <p className="mt-2 text-sm font-medium text-texto-suave">
            🏆 {resumo.campanha.nome} · faltam {resumo.campanha.dias_restantes} dias
          </p>
        </div>

        <div className="rounded-3xl bg-superficie p-5 shadow-sm">
          <div className="flex items-baseline justify-between">
            <p className="font-display text-3xl font-extrabold tabular-nums text-marinho">
              {resumo.pontos.total.toLocaleString("pt-BR")}
              <span className="ml-1 text-base font-bold text-texto-suave">pts</span>
            </p>
            <p className="font-display text-lg font-bold text-laranja">
              🔥 {resumo.sequencia} dias
            </p>
          </div>

          {resumo.posicao && (
            <p className="mt-1 text-sm text-texto-suave">
              {resumo.posicao.geral !== null && `#${resumo.posicao.geral} geral`}
              {resumo.posicao.geral !== null && resumo.posicao.setor !== null && " · "}
              {resumo.posicao.setor !== null && `setor #${resumo.posicao.setor}`}
            </p>
          )}

          <ul className="mt-4 flex flex-col gap-2.5">
            {PILARES.map(({ chave, rotulo, emoji, cor }) => (
              <li key={chave} className="flex items-center gap-3">
                <span aria-hidden>{emoji}</span>
                <span className="sr-only">{rotulo}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className={`block h-full rounded-full ${cor}`}
                    style={{ width: `${(resumo.pontos[chave] / maior) * 100}%` }}
                  />
                </span>
                <span className="w-14 text-right text-sm font-semibold tabular-nums text-texto">
                  {resumo.pontos[chave]}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl bg-superficie p-5 shadow-sm">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-texto-suave">
            Missões de hoje
          </h2>
          <Link
            to="/app/quiz"
            className="mt-3 flex min-h-14 items-center gap-3 rounded-2xl bg-marinho px-4 py-3 text-white"
          >
            <HelpCircle className="size-6 shrink-0 text-amarelo" aria-hidden />
            <span className="flex-1 font-display font-bold">Quiz do dia</span>
            <span className="font-semibold tabular-nums">
              {resumo.quiz_do_dia.respondidas}/{resumo.quiz_do_dia.total}
            </span>
          </Link>
          <p className="mt-3 flex min-h-14 items-center gap-3 rounded-2xl border border-borda px-4 py-3 text-texto-suave">
            <Megaphone className="size-6 shrink-0" aria-hidden />
            Viu um risco? O envio de relatos entra na próxima etapa.
          </p>
        </div>

        {resumo.campanha.premiacao && (
          <p className="rounded-2xl bg-amarelo/20 p-4 text-sm font-medium text-texto">
            🎁 Prêmio: {resumo.campanha.premiacao}
          </p>
        )}
      </div>
    </AlunoLayout>
  );
}

export const Route = createFileRoute("/app/inicio")({
  component: AppInicio,
});
