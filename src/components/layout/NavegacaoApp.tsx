import { Link } from "@tanstack/react-router";
import { Home, HelpCircle, BookOpen, Megaphone, User } from "lucide-react";

/**
 * Navegação inferior fixa do app (docs/TIME_05 §1): 5 itens, ícone + palavra.
 *
 * Alvo de toque de 56px: o app é usado com uma mão, de luva, em tela suja
 * (docs/TIME_05, princípios de UX).
 *
 * `rota` nula = tela que ainda não existe; fica desabilitada em vez de dar erro
 * de rota — com o router tipado, link para rota inexistente não compila.
 */
const ITENS = [
  { rotulo: "Início", Icone: Home, rota: "/app/inicio" as const },
  { rotulo: "Quiz", Icone: HelpCircle, rota: "/app/quiz" as const },
  { rotulo: "Trilha", Icone: BookOpen, rota: "/app/trilha" as const },
  { rotulo: "Relatar", Icone: Megaphone, rota: null },
  { rotulo: "Perfil", Icone: User, rota: null },
];

export function NavegacaoApp() {
  return (
    <nav
      aria-label="Navegação do app"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-borda bg-superficie"
    >
      <ul className="mx-auto flex w-full max-w-[480px]">
        {ITENS.map(({ rotulo, Icone, rota }) => (
          <li key={rotulo} className="flex-1">
            {rota ? (
              <Link
                to={rota}
                className="flex min-h-14 flex-col items-center justify-center gap-0.5 py-2 text-texto-suave"
                activeProps={{ className: "text-marinho" }}
              >
                <Icone className="size-5" aria-hidden />
                <span className="text-[11px] font-medium">{rotulo}</span>
              </Link>
            ) : (
              <span
                aria-disabled
                title="Em breve"
                className="flex min-h-14 cursor-not-allowed flex-col items-center justify-center gap-0.5 py-2 text-texto-suave/40"
              >
                <Icone className="size-5" aria-hidden />
                <span className="text-[11px] font-medium">{rotulo}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
