import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, Check, Lock, Star } from "lucide-react";
import { AlunoLayout } from "@/components/layout/AlunoLayout";
import { rpcApp } from "@/lib/rpc";
import { sessao } from "@/lib/sessao";
import { mensagem } from "@/lib/mensagens";

/** Uma lição como `colaborador_trilha` devolve (docs/TIME_02 §5.3). */
type ItemTrilha = {
  id: string;
  titulo: string;
  tema: string | null;
  tema_icone: string | null;
  carga_minutos: number;
  obrigatoria: boolean;
  nota_minima: number;
  conteudo_concluido: boolean;
  melhor_nota: number | null;
  aprovado: boolean;
};

type Resposta = { ok: true; licoes: ItemTrilha[] } | { ok: false; motivo: string };

/** Estado visual de um nó da trilha (docs/TIME_05 §6). */
function estado(l: ItemTrilha) {
  if (l.aprovado) {
    return { icone: Check, cor: "bg-verde text-white", rotulo: `aprovado · nota ${l.melhor_nota}` };
  }
  if (l.conteudo_concluido) {
    return { icone: BookOpen, cor: "bg-amarelo text-texto", rotulo: "conteúdo lido" };
  }
  return { icone: Lock, cor: "bg-muted text-texto-suave", rotulo: "não iniciada" };
}

/** Trilha de treinamentos, em formato de caminho vertical (docs/TIME_05 §6). */
function Trilha() {
  const navigate = useNavigate();
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!sessao.token()) {
      void navigate({ to: "/app/entrar", replace: true });
      return;
    }
    rpcApp<Resposta>("colaborador_trilha")
      .then(setResposta)
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

  if (!resposta) {
    return (
      <AlunoLayout comNavegacao>
        <p className="rounded-2xl bg-superficie p-6 text-sm text-texto-suave shadow-sm">
          Carregando a trilha…
        </p>
      </AlunoLayout>
    );
  }

  if (!resposta.ok) {
    return (
      <AlunoLayout comNavegacao>
        <div className="rounded-3xl bg-superficie p-6 text-center shadow-sm">
          <p className="text-sm text-texto">{mensagem(resposta.motivo)}</p>
        </div>
      </AlunoLayout>
    );
  }

  const licoes = resposta.licoes;
  const aprovadas = licoes.filter((l) => l.aprovado).length;

  return (
    <AlunoLayout comNavegacao>
      <div className="flex flex-col gap-4">
        <div className="rounded-3xl bg-superficie p-5 shadow-sm">
          <h1 className="font-display text-xl font-extrabold text-marinho">Trilha</h1>
          <p className="mt-1 text-sm text-texto-suave">
            {licoes.length === 0
              ? "Nenhuma lição publicada ainda."
              : `${aprovadas} de ${licoes.length} aprovada(s).`}
          </p>
          {licoes.length > 0 && (
            <span className="mt-3 block h-2.5 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-verde"
                style={{ width: `${(aprovadas / licoes.length) * 100}%` }}
              />
            </span>
          )}
        </div>

        {licoes.length === 0 && (
          <p className="rounded-2xl bg-superficie p-6 text-center text-sm text-texto-suave shadow-sm">
            O técnico de SST ainda não publicou lições nesta campanha.
          </p>
        )}

        <ol className="flex flex-col gap-3">
          {licoes.map((l) => {
            const e = estado(l);
            const Icone = e.icone;
            return (
              <li key={l.id}>
                <Link
                  to="/app/trilha/$licaoId"
                  params={{ licaoId: l.id }}
                  className="flex min-h-16 items-center gap-3 rounded-2xl bg-superficie p-4 shadow-sm"
                >
                  <span
                    className={`flex size-11 shrink-0 items-center justify-center rounded-full ${e.cor}`}
                  >
                    <Icone className="size-5" aria-hidden />
                  </span>
                  <span className="flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 font-display font-bold text-texto">
                      {l.tema_icone} {l.titulo}
                      {l.obrigatoria && (
                        <Star className="size-3.5 text-amarelo" aria-label="obrigatória" />
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-texto-suave">
                      {l.carga_minutos} min · {e.rotulo}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </AlunoLayout>
  );
}

export const Route = createFileRoute("/app/trilha/")({
  component: Trilha,
});
