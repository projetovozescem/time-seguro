import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTelaCheia } from "@/hooks/useTelaCheia";
import { LogOut, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { TimeLogo } from "@/components/TimeLogo";
import { useCampanhaAtiva, usePerfil, diasRestantes } from "@/hooks/usePerfil";
import { cn } from "@/lib/utils";
import { AbasDaSecao } from "./AbasDaSecao";
import { secaoDaRota, secoesVisiveis } from "./secoes";

/** Menu lateral: 7 seções; as telas de cada uma viram abas (`secoes.ts`). */
function Navegacao({ aoNavegar }: { aoNavegar?: () => void }) {
  const { data: perfil } = usePerfil();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const atual = secaoDaRota(pathname);

  const visiveis = secoesVisiveis({ papel: perfil?.papel, comite: !!perfil?.comite_assedio });

  async function sair() {
    await supabase.auth.signOut();
    // O perfil e tudo o mais fica em cache por usuario: sem limpar, quem entra em
    // seguida (admin e CIPA no mesmo computador) veria o menu do anterior.
    queryClient.clear();
    aoNavegar?.();
    await navigate({ to: "/painel/login", replace: true });
  }

  return (
    <nav className="flex h-full flex-col gap-0.5 overflow-y-auto p-3">
      {visiveis.map((item) => (
        <Link
          key={item.rotulo}
          to={item.abas[0]!.rota}
          onClick={aoNavegar}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-sidebar-accent",
            atual?.rotulo === item.rotulo && "bg-marinho text-white hover:bg-marinho",
          )}
        >
          <span aria-hidden>{item.emoji}</span>
          {item.rotulo}
        </Link>
      ))}

      <div className="mt-auto pt-3">
        <button
          type="button"
          onClick={sair}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="size-4 shrink-0" aria-hidden />
          Sair
        </button>
      </div>
    </nav>
  );
}

/** Nome da empresa, do técnico e o chip da campanha ativa (docs/TIME_04 §2). */
function Cabecalho() {
  const { data: perfil } = usePerfil();
  const { data: campanha } = useCampanhaAtiva();
  const dias = diasRestantes(campanha?.fim);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {perfil && (
        <>
          <span className="font-semibold text-texto">{perfil.empresa.nome}</span>
          <span className="text-texto-suave">{perfil.nome}</span>
        </>
      )}
      {campanha && (
        <span className="rounded-full bg-amarelo/25 px-3 py-0.5 text-xs font-semibold text-texto">
          🏆 {campanha.nome}
          {dias !== null && ` · faltam ${dias} dias`}
        </span>
      )}
    </div>
  );
}

/** Casca do painel do técnico (docs/TIME_04): sidebar no desktop, gaveta no celular. */
export function PainelLayout() {
  const [aberto, setAberto] = useState(false);
  const { data: perfil, isLoading } = usePerfil();
  const { pathname } = useLocation();
  const naTv = pathname.startsWith("/tv");
  const cheia = useTelaCheia();

  // A TV só entra em tela cheia pelo botão. Ao sair da TV (voltar do navegador,
  // menu), a tela cheia não pode continuar valendo para o resto do painel.
  useEffect(() => {
    if (!naTv && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, [naTv]);

  // Usuário existe no Auth mas não foi vinculado a uma empresa (docs/TIME_03 §2).
  if (!isLoading && perfil === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-fundo px-5">
        <div className="max-w-md rounded-2xl border border-borda bg-superficie p-6 text-center">
          <TimeLogo tamanho="md" />
          <p className="mt-4 text-texto">
            Seu usuário ainda não foi vinculado a uma empresa. Fale com o administrador.
          </p>
        </div>
      </div>
    );
  }

  // Modo TV abre no layout normal, com o menu ao lado. Só em tela cheia (botão
  // da `CascaTv`) ocupa a tela inteira, sem menu nem cabeçalho.
  if (naTv && cheia) return <Outlet />;

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[250px] flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-5">
          <TimeLogo tamanho="md" />
        </div>
        <Navegacao />
      </aside>

      <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-border bg-card/90 px-4 py-2 backdrop-blur">
        <Sheet open={aberto} onOpenChange={setAberto}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menu" className="lg:hidden">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[270px] p-0">
            <SheetTitle className="flex h-16 items-center border-b border-sidebar-border px-5">
              <TimeLogo tamanho="md" />
            </SheetTitle>
            <Navegacao aoNavegar={() => setAberto(false)} />
          </SheetContent>
        </Sheet>
        <div className="lg:pl-[250px]">
          <Cabecalho />
        </div>
        <ul aria-label="T.I.M.E." className="ml-auto hidden shrink-0 items-center gap-1.5 md:flex">
          {(
            [
              ["Treinar", "bg-marinho text-white"],
              ["Identificar", "bg-amarelo text-texto"],
              ["Mobilizar", "bg-marinho text-white"],
              ["Evoluir", "bg-amarelo text-texto"],
            ] as const
          ).map(([palavra, cor]) => (
            <li key={palavra} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cor}`}>
              {palavra}
            </li>
          ))}
        </ul>
      </header>

      <div className="lg:pl-[250px]">
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
          <AbasDaSecao />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
