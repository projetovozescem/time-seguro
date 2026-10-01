import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Camera, Megaphone } from "lucide-react";
import { AlunoLayout } from "@/components/layout/AlunoLayout";
import { Button } from "@/components/ui/button";
import { rpcApp } from "@/lib/rpc";
import { sessao } from "@/lib/sessao";
import { mensagem } from "@/lib/mensagens";
import { corDoStatus, rotuloDaCategoria, rotuloDoStatus } from "@/lib/relatos";
import { formatarData } from "@/lib/datas";

type Historico = { status: string; comentario: string | null; em: string };

type Relato = {
  id: string;
  categoria: string;
  descricao: string;
  status: string;
  validado: boolean;
  tem_foto: boolean;
  local: string | null;
  criado_em: string;
  historico: Historico[];
};

type Resposta = { ok: true; relatos: Relato[] } | { ok: false; motivo: string };

/** Meus relatos, com a linha do tempo (docs/TIME_05 §7). */
function MeusRelatos() {
  const navigate = useNavigate();
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    if (!sessao.token()) {
      void navigate({ to: "/app/entrar", replace: true });
      return;
    }
    rpcApp<Resposta>("colaborador_meus_relatos")
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
          Carregando…
        </p>
      </AlunoLayout>
    );
  }

  if (!resposta.ok) {
    return (
      <AlunoLayout comNavegacao>
        <p className="rounded-2xl bg-superficie p-6 text-center text-sm text-texto shadow-sm">
          {mensagem(resposta.motivo)}
        </p>
      </AlunoLayout>
    );
  }

  const relatos = resposta.relatos;

  return (
    <AlunoLayout comNavegacao>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-3xl bg-superficie p-5 shadow-sm">
          <h1 className="font-display text-xl font-extrabold text-marinho">Meus relatos</h1>
          <Button asChild size="sm" className="bg-marinho">
            <Link to="/app/relatar">
              <Megaphone className="size-4" aria-hidden />
              Relatar
            </Link>
          </Button>
        </div>

        {relatos.length === 0 && (
          <div className="rounded-3xl bg-superficie p-6 text-center shadow-sm">
            <p className="text-sm text-texto">Você ainda não enviou nenhum relato.</p>
            <p className="mt-1 text-sm text-texto-suave">
              Viu um risco? Relatar leva menos de um minuto.
            </p>
          </div>
        )}

        <ul className="flex flex-col gap-2.5">
          {relatos.map((r) => {
            const expandido = aberto === r.id;
            const visiveis = r.historico.filter((h) => h.comentario);

            return (
              <li key={r.id} className="rounded-2xl bg-superficie shadow-sm">
                <button
                  type="button"
                  onClick={() => setAberto(expandido ? null : r.id)}
                  aria-expanded={expandido}
                  className="w-full p-4 text-left"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${corDoStatus(r.status)}`}
                    >
                      {rotuloDoStatus(r.status)}
                    </span>
                    <span className="text-xs text-texto-suave">
                      {rotuloDaCategoria(r.categoria)} · {formatarData(r.criado_em)}
                    </span>
                    {r.tem_foto && (
                      <Camera className="size-3.5 text-texto-suave" aria-label="com foto" />
                    )}
                  </span>
                  <span className="mt-1.5 block text-sm text-texto">{r.descricao}</span>
                  {r.local && (
                    <span className="mt-1 block text-xs text-texto-suave">📍 {r.local}</span>
                  )}
                </button>

                {expandido && (
                  <div className="border-t border-borda px-4 py-3">
                    {visiveis.length === 0 ? (
                      <p className="text-sm text-texto-suave">Nenhuma mensagem do técnico ainda.</p>
                    ) : (
                      <ol className="flex flex-col gap-3">
                        {visiveis.map((h, i) => (
                          <li key={i} className="border-l-2 border-marinho/30 pl-3">
                            <p className="text-xs font-semibold text-texto-suave">
                              {rotuloDoStatus(h.status)} · {formatarData(h.em)}
                            </p>
                            <p className="mt-0.5 text-sm text-texto">{h.comentario}</p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </AlunoLayout>
  );
}

export const Route = createFileRoute("/app/relatos")({
  component: MeusRelatos,
});
