import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type Opcao = {
  rotulo: string;
  icone?: ReactNode;
  aoClicar: () => void;
  desabilitado?: boolean;
  perigo?: boolean;
};

/**
 * Botão "⋯" com as ações que se usa pouco (exportar, importar, anonimizar…).
 * Deixa na tela só a ação principal, para quem não é do ramo não se perder.
 * Some quando não há nenhuma opção para quem está logado.
 */
export function MaisOpcoes({
  opcoes,
  rotulo = "Mais opções",
  tamanho = "default",
}: {
  opcoes: readonly (Opcao | false | null | undefined)[];
  rotulo?: string;
  tamanho?: "default" | "sm";
}) {
  const validas = opcoes.filter((o): o is Opcao => !!o);
  if (validas.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={tamanho === "sm" ? "sm" : "icon"}
          aria-label={rotulo}
          title={rotulo}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {validas.map((o) => (
          <DropdownMenuItem
            key={o.rotulo}
            disabled={!!o.desabilitado}
            onSelect={o.aoClicar}
            className={o.perigo ? "text-vermelho focus:text-vermelho" : ""}
          >
            {o.icone}
            {o.rotulo}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
