import type { ReactNode } from "react";
import { TimeLogo } from "@/components/TimeLogo";

/**
 * Casca do app do colaborador (docs/TIME_05): mobile first, no máximo 480px
 * centralizado, faixa de segurança no topo. A navegação inferior de 5 itens
 * entra em `/app/*` logado — esta casca serve também às telas de entrada.
 */
export function AlunoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(170deg,#0B3C5D_0%,#13294B_38%,#F4F6F9_38.5%,#F4F6F9_100%)]">
      <div className="faixa-seguranca" />
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-5 pb-10 pt-8">
        <div className="flex justify-center">
          <TimeLogo tamanho="md" claro />
        </div>
        <div className="mt-6 flex-1">{children}</div>
      </div>
    </div>
  );
}
