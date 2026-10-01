import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { AlunoLayout } from "@/components/layout/AlunoLayout";
import { Button } from "@/components/ui/button";
import { rpcApp } from "@/lib/rpc";
import { sessao } from "@/lib/sessao";
import { mensagem } from "@/lib/mensagens";

type DadosLocal =
  | { ok: true; id: string; nome: string; setor: string | null; descricao: string | null }
  | { ok: false; motivo: string };

/**
 * Entrada pelo QR Code colado num local (docs/TIME_05 §7). Confirma onde a
 * pessoa está e manda para o relato com o local já preenchido.
 *
 * Se não houver sessão, o login leva de volta para cá — assim o QR na parede
 * funciona para quem ainda não entrou.
 */
function Local() {
  const { localId } = Route.useParams();
  const navigate = useNavigate();
  const [dados, setDados] = useState<DadosLocal | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!sessao.token()) {
      void navigate({ to: "/app/entrar", replace: true });
      return;
    }
    rpcApp<DadosLocal>("colaborador_local", { p_local: localId })
      .then(setDados)
      .catch(() => setErro(mensagem("erro_interno")));
  }, [localId, navigate]);

  if (erro || (dados && !dados.ok)) {
    return (
      <AlunoLayout comNavegacao>
        <p
          role="alert"
          className="rounded-2xl bg-superficie p-6 text-center text-sm text-texto shadow-sm"
        >
          {erro ?? mensagem(dados && !dados.ok ? dados.motivo : "local_invalido")}
        </p>
      </AlunoLayout>
    );
  }

  if (!dados) {
    return (
      <AlunoLayout comNavegacao>
        <p className="flex items-center gap-2 rounded-2xl bg-superficie p-6 text-sm text-texto-suave shadow-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Lendo o QR Code…
        </p>
      </AlunoLayout>
    );
  }

  return (
    <AlunoLayout comNavegacao>
      <div className="rounded-3xl bg-superficie p-6 text-center shadow-sm">
        <MapPin className="mx-auto size-10 text-marinho" aria-hidden />
        <p className="mt-3 font-display text-xl font-extrabold text-marinho">{dados.nome}</p>
        {dados.setor && <p className="text-sm text-texto-suave">{dados.setor}</p>}
        {dados.descricao && <p className="mt-2 text-sm text-texto">{dados.descricao}</p>}

        <Button
          onClick={() => navigate({ to: "/app/relatar", search: { local: dados.id } })}
          className="mt-6 min-h-14 w-full bg-amarelo text-base font-bold text-texto hover:bg-amarelo/90"
        >
          Relatar um risco aqui
        </Button>
      </div>
    </AlunoLayout>
  );
}

export const Route = createFileRoute("/app/local/$localId")({
  component: Local,
});
