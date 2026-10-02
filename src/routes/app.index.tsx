import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AlunoLayout } from "@/components/layout/AlunoLayout";
import { sessao } from "@/lib/sessao";

/**
 * Raiz do app do colaborador: é o `start_url` do PWA (docs/TIME_05 §1 e §10).
 *
 * Quem abre o app instalado cai aqui e vai direto para o início, se ainda
 * estiver logado (a sessão dura 30 dias), ou para a entrada. A decisão é no
 * navegador: o `localStorage` não existe no servidor.
 */
function AppRaiz() {
  const navigate = useNavigate();

  useEffect(() => {
    void navigate({ to: sessao.token() ? "/app/inicio" : "/app/entrar", replace: true });
  }, [navigate]);

  return (
    <AlunoLayout>
      <p className="mt-10 text-center text-sm text-white/80">Abrindo…</p>
    </AlunoLayout>
  );
}

export const Route = createFileRoute("/app/")({
  component: AppRaiz,
});
