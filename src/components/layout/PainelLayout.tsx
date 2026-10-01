import { Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { TimeLogo } from "@/components/TimeLogo";

/**
 * Casca do painel do técnico (docs/TIME_04): sidebar fixa no desktop, gaveta no
 * celular. O menu lateral de 16 itens, o chip da campanha ativa e o filtro por
 * papel (`usePerfil`) entram na Fase 2, quando as rotas `/painel/*` existirem —
 * ver docs/TIME_04 §1 e §2.
 */
export function PainelLayout() {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[250px] flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-5">
          <TimeLogo tamanho="md" />
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur lg:hidden">
        <Sheet open={aberto} onOpenChange={setAberto}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[270px] p-0">
            <SheetTitle className="flex h-16 items-center border-b border-sidebar-border px-5">
              <TimeLogo tamanho="md" />
            </SheetTitle>
          </SheetContent>
        </Sheet>
        <TimeLogo tamanho="sm" />
      </header>

      <div className="lg:pl-[250px]">
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
