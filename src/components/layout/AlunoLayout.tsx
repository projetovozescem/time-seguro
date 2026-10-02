import { useEffect, type ReactNode } from "react";
import { TimeLogo } from "@/components/TimeLogo";
import { NavegacaoApp } from "@/components/layout/NavegacaoApp";
import { BotaoInstalar } from "@/components/aluno/BotaoInstalar";
import { registrarServiceWorker } from "@/lib/pwa";

/**
 * Casca do app do colaborador (docs/TIME_05): mobile first, no máximo 480px
 * centralizado, faixa de segurança no topo.
 *
 * `comNavegacao` liga a barra inferior de 5 itens. As telas de entrada (login,
 * novo PIN, termo) ficam sem ela: antes de resolver a pendência, nada mais
 * funciona, e oferecer atalho só levaria a erro.
 */
export function AlunoLayout({
  children,
  comNavegacao = false,
}: {
  children: ReactNode;
  comNavegacao?: boolean;
}) {
  // O app do colaborador e o unico instalavel (manifest com escopo /app).
  useEffect(() => registrarServiceWorker(), []);

  return (
    <div className="min-h-screen bg-[linear-gradient(170deg,#0B3C5D_0%,#13294B_38%,#F4F6F9_38.5%,#F4F6F9_100%)]">
      <div className="faixa-seguranca" />
      <div
        className={`mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-5 pt-8 ${
          comNavegacao ? "pb-24" : "pb-10"
        }`}
      >
        <div className="flex justify-center">
          <TimeLogo tamanho="md" claro />
        </div>
        <div className="mt-6 flex-1">{children}</div>
        <div className="mt-6">
          <BotaoInstalar />
        </div>
      </div>
      {comNavegacao && <NavegacaoApp />}
    </div>
  );
}
