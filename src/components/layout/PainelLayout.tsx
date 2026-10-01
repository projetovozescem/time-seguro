import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { TimeLogo } from "@/components/TimeLogo";
import { useCampanhaAtiva, usePerfil, diasRestantes, podeAcessar } from "@/hooks/usePerfil";
import { cn } from "@/lib/utils";

/**
 * Menu lateral de docs/TIME_04 §2, na ordem do documento.
 *
 * `rota` só está preenchida onde a tela existe. O que falta aparece desabilitado
 * em vez de dar erro de rota — assim o técnico vê o mapa do produto e o que já
 * está pronto, sem link quebrado.
 */
const MENU = [
  { emoji: "🏠", rotulo: "Início", rota: "/painel" as const, minimo: "cipa" as const },
  { emoji: "🏆", rotulo: "Campanhas", rota: "/painel/campanhas" as const, minimo: "cipa" as const },
  {
    emoji: "❓",
    rotulo: "Perguntas",
    rota: "/painel/perguntas" as const,
    minimo: "tecnico" as const,
  },
  { emoji: "👷", rotulo: "Colaboradores", rota: null, minimo: "tecnico" as const },
  { emoji: "🏭", rotulo: "Setores e Locais", rota: null, minimo: "tecnico" as const },
  { emoji: "📅", rotulo: "Eventos", rota: "/painel/eventos" as const, minimo: "cipa" as const },
  { emoji: "📢", rotulo: "Relatos", rota: "/painel/relatos" as const, minimo: "cipa" as const },
  {
    emoji: "💜",
    rotulo: "Canal de Respeito",
    rota: "/painel/respeito" as const,
    minimo: "cipa" as const,
    soComite: true,
  },
  { emoji: "🥇", rotulo: "Ranking", rota: null, minimo: "cipa" as const },
  { emoji: "📈", rotulo: "Analytics", rota: null, minimo: "cipa" as const },
  { emoji: "📄", rotulo: "Relatórios", rota: null, minimo: "cipa" as const },
  { emoji: "🎓", rotulo: "Certificados", rota: null, minimo: "cipa" as const },
  { emoji: "🖼️", rotulo: "Materiais", rota: null, minimo: "tecnico" as const },
  { emoji: "📺", rotulo: "Modo TV", rota: null, minimo: "tecnico" as const },
  { emoji: "⚙️", rotulo: "Configurações", rota: null, minimo: "admin" as const },
];

function Navegacao({ aoNavegar }: { aoNavegar?: () => void }) {
  const { data: perfil } = usePerfil();
  const navigate = useNavigate();

  const visiveis = MENU.filter((item) => {
    if (!podeAcessar(perfil?.papel, item.minimo)) return false;
    if (item.soComite && !perfil?.comite_assedio) return false;
    return true;
  });

  async function sair() {
    await supabase.auth.signOut();
    aoNavegar?.();
    await navigate({ to: "/painel/login", replace: true });
  }

  return (
    <nav className="flex h-full flex-col gap-0.5 overflow-y-auto p-3">
      {visiveis.map((item) =>
        item.rota ? (
          <Link
            key={item.rotulo}
            to={item.rota}
            onClick={aoNavegar}
            activeOptions={{ exact: item.rota === "/painel" }}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-sidebar-accent"
            activeProps={{
              className: cn("bg-marinho text-white hover:bg-marinho"),
            }}
          >
            <span aria-hidden>{item.emoji}</span>
            {item.rotulo}
          </Link>
        ) : (
          <span
            key={item.rotulo}
            aria-disabled
            title="Esta tela ainda não foi construída."
            className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-texto-suave/50"
          >
            <span aria-hidden>{item.emoji}</span>
            {item.rotulo}
            <span className="ml-auto text-[10px] uppercase tracking-wide">em breve</span>
          </span>
        ),
      )}

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
          <span className="text-texto-suave">
            {perfil.nome} · {perfil.papel}
            {perfil.comite_assedio && " · comitê"}
          </span>
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
      </header>

      <div className="lg:pl-[250px]">
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
