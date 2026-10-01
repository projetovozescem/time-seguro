import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, HelpCircle, Megaphone } from "lucide-react";
import { AlunoLayout } from "@/components/layout/AlunoLayout";
import { rpcApp } from "@/lib/rpc";
import { sessao } from "@/lib/sessao";
import { mensagem } from "@/lib/mensagens";

/**
 * Resposta de `colaborador_resumo`, lida do SQL da migration 0003 — não do
 * documento. A primeira versão desta tela assumiu um formato parecido mas
 * errado (`quiz_do_dia`, `posicao.geral`) e não mostrava nada.
 */
type Resumo =
  | {
      ok: true;
      nome: string;
      setor: string | null;
      pendencia: string | null;
      campanha: {
        id: string;
        nome: string;
        dias_restantes: number;
        premiacao: string | null;
        ranking_visivel: boolean;
      } | null;
      pontos: {
        total: number;
        conhecimento: number;
        relatos: number;
        engajamento: number;
        hoje: number;
      };
      streak: number;
      /** Nulos quando o ranking está oculto na campanha. */
      posicao_individual: number | null;
      posicao_setor: number | null;
      quiz_hoje: { respondidas: number; total: number };
      licoes: { aprovadas: number; total: number };
      relatos: { em_andamento: number; validados: number };
    }
  | { ok: false; motivo: string };

const PILARES = [
  { chave: "conhecimento", emoji: "🧠", rotulo: "Conhecimento", cor: "bg-marinho" },
  { chave: "relatos", emoji: "📢", rotulo: "Relatos", cor: "bg-laranja" },
  { chave: "engajamento", emoji: "🔥", rotulo: "Engajamento", cor: "bg-amarelo" },
] as const;

/** Home do app (docs/TIME_05 §4). */
function Inicio() {
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
      <AlunoLayout comNavegacao>
        <p role="alert" className="rounded-2xl bg-superficie p-6 text-sm text-vermelho shadow-sm">
          {erro}
        </p>
      </AlunoLayout>
    );
  }

  if (!resumo) {
    return (
      <AlunoLayout comNavegacao>
        <p className="rounded-2xl bg-superficie p-6 text-sm text-texto-suave shadow-sm">
          Carregando…
        </p>
      </AlunoLayout>
    );
  }

  if (!resumo.ok) {
    return (
      <AlunoLayout comNavegacao>
        <p className="rounded-2xl bg-superficie p-6 text-center text-sm text-texto shadow-sm">
          {mensagem(resumo.motivo)}
        </p>
      </AlunoLayout>
    );
  }

  // Sem campanha ativa o app não mostra missões (docs/TIME_05 §4).
  if (!resumo.campanha) {
    return (
      <AlunoLayout comNavegacao>
        <div className="rounded-3xl bg-superficie p-6 text-center shadow-sm">
          <p className="font-display text-lg font-bold text-marinho">
            Nenhuma campanha no momento.
          </p>
          <p className="mt-2 text-sm text-texto-suave">Fique de olho nos avisos da SST!</p>
        </div>
      </AlunoLayout>
    );
  }

  const { campanha, pontos, licoes, quiz_hoje, relatos } = resumo;
  // Base das barras: o maior pilar, para a comparação entre eles ser legível.
  const maior = Math.max(pontos.conhecimento, pontos.relatos, pontos.engajamento, 1);
  const quizCompleto = quiz_hoje.total > 0 && quiz_hoje.respondidas >= quiz_hoje.total;

  return (
    <AlunoLayout comNavegacao>
      <div className="flex flex-col gap-4">
        <div className="rounded-3xl bg-superficie p-5 shadow-sm">
          <p className="font-display text-lg font-bold text-marinho">
            Olá, {resumo.nome.split(" ")[0]}! 👷
          </p>
          {resumo.setor && <p className="text-sm text-texto-suave">{resumo.setor}</p>}
          <p className="mt-2 text-sm font-medium text-texto-suave">
            🏆 {campanha.nome} · faltam {campanha.dias_restantes} dias
          </p>
        </div>

        <div className="rounded-3xl bg-superficie p-5 shadow-sm">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-display text-3xl font-extrabold tabular-nums text-marinho">
              {pontos.total.toLocaleString("pt-BR")}
              <span className="ml-1 text-base font-bold text-texto-suave">pts</span>
            </p>
            <p className="font-display text-lg font-bold text-laranja">🔥 {resumo.streak} dias</p>
          </div>

          {pontos.hoje > 0 && <p className="mt-0.5 text-sm text-verde">+{pontos.hoje} hoje</p>}

          {campanha.ranking_visivel ? (
            <p className="mt-1 text-sm text-texto-suave">
              {resumo.posicao_individual !== null && `#${resumo.posicao_individual} geral`}
              {resumo.posicao_individual !== null && resumo.posicao_setor !== null && " · "}
              {resumo.posicao_setor !== null && `setor #${resumo.posicao_setor}`}
            </p>
          ) : (
            <p className="mt-1 text-sm text-texto-suave">{mensagem("ranking_oculto")}</p>
          )}

          <ul className="mt-4 flex flex-col gap-2.5">
            {PILARES.map(({ chave, emoji, rotulo, cor }) => (
              <li key={chave} className="flex items-center gap-3">
                <span aria-hidden>{emoji}</span>
                <span className="sr-only">{rotulo}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className={`block h-full rounded-full ${cor}`}
                    style={{ width: `${(pontos[chave] / maior) * 100}%` }}
                  />
                </span>
                <span className="w-14 text-right text-sm font-semibold tabular-nums text-texto">
                  {pontos[chave]}
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
            <span className="flex-1 font-display font-bold">
              {quizCompleto ? "Quiz de hoje concluído" : "Quiz do dia"}
            </span>
            <span className="font-semibold tabular-nums">
              {quiz_hoje.respondidas}/{quiz_hoje.total}
            </span>
          </Link>

          <Link
            to="/app/trilha"
            className="mt-2.5 flex min-h-14 items-center gap-3 rounded-2xl border border-borda px-4 py-3 text-texto"
          >
            <BookOpen className="size-6 shrink-0 text-marinho" aria-hidden />
            <span className="flex-1 font-display font-bold">Trilha de treinamentos</span>
            <span className="font-semibold tabular-nums text-texto-suave">
              {licoes.aprovadas}/{licoes.total}
            </span>
          </Link>

          <Link
            to="/app/relatar"
            className="mt-2.5 flex min-h-14 items-center gap-3 rounded-2xl border border-borda px-4 py-3 text-texto"
          >
            <Megaphone className="size-6 shrink-0 text-laranja" aria-hidden />
            <span className="flex-1 font-display font-bold">Viu um risco? Relate</span>
            {relatos.em_andamento > 0 && (
              <span className="font-semibold tabular-nums text-texto-suave">
                {relatos.em_andamento} em andamento
              </span>
            )}
          </Link>
        </div>

        {campanha.premiacao && (
          <p className="rounded-2xl bg-amarelo/20 p-4 text-sm font-medium text-texto">
            🎁 Prêmio: {campanha.premiacao}
          </p>
        )}
      </div>
    </AlunoLayout>
  );
}

export const Route = createFileRoute("/app/inicio")({
  component: Inicio,
});
