import { Link, useLocation } from "@tanstack/react-router";
import { usePerfil } from "@/hooks/usePerfil";
import { abaDaRota, secaoDaRota, abaVisivel } from "./secoes";

/**
 * Abas da seção atual (ex.: Campanhas · Perguntas · Eventos · Ranking ·
 * Certificados). Some quando a seção tem uma tela só para quem está logado.
 */
export function AbasDaSecao() {
  const { pathname } = useLocation();
  const { data: perfil } = usePerfil();
  const secao = secaoDaRota(pathname);
  const atual = abaDaRota(pathname);
  const abas = (secao?.abas ?? []).filter((a) =>
    abaVisivel(a, { papel: perfil?.papel, comite: !!perfil?.comite_assedio }),
  );
  if (abas.length < 2) return null;

  return (
    <nav
      aria-label={secao?.rotulo}
      className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-muted p-1"
    >
      {abas.map((a) => (
        <Link
          key={a.rota}
          to={a.rota}
          aria-current={a === atual ? "page" : undefined}
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium ${
            a === atual ? "bg-superficie text-marinho shadow-sm" : "text-texto-suave"
          }`}
        >
          {a.rotulo}
        </Link>
      ))}
    </nav>
  );
}
