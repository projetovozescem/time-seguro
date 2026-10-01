import { Link } from "@tanstack/react-router";
import { BookOpen, HelpCircle, Home, Megaphone, User } from "lucide-react";

/**
 * Navegação inferior fixa do app (docs/TIME_05 §1): 5 itens, ícone + palavra.
 *
 * Alvo de toque de 56px: o app é usado com uma mão, de luva, em tela suja
 * (princípios de UX do docs/TIME_05).
 */
const ITENS = [
  { rotulo: "Início", Icone: Home, rota: "/app/inicio" },
  { rotulo: "Quiz", Icone: HelpCircle, rota: "/app/quiz" },
  { rotulo: "Trilha", Icone: BookOpen, rota: "/app/trilha" },
  { rotulo: "Relatar", Icone: Megaphone, rota: "/app/relatar" },
  { rotulo: "Perfil", Icone: User, rota: "/app/perfil" },
] as const;

export function NavegacaoApp() {
  return (
    <nav
      aria-label="Navegação do app"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-borda bg-superficie"
    >
      <ul className="mx-auto flex w-full max-w-[480px]">
        {ITENS.map(({ rotulo, Icone, rota }) => (
          <li key={rotulo} className="flex-1">
            <Link
              to={rota}
              className="flex min-h-14 flex-col items-center justify-center gap-0.5 py-2 text-texto-suave"
              activeProps={{ className: "text-marinho" }}
            >
              <Icone className="size-5" aria-hidden />
              <span className="text-[11px] font-medium">{rotulo}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
