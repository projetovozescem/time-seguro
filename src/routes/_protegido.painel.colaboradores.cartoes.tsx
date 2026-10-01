import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePerfil } from "@/hooks/usePerfil";
import { emFolhas, rotuloDoTurno } from "@/lib/colaboradores";
import type { CartaoDeAcesso } from "@/lib/colaboradores";
import { cartoesPendentes, limparCartoes } from "@/lib/cartoes-pendentes";

/** Um cartão para recortar e entregar em mão (docs/TIME_04 §6). */
function Cartao({ cartao, empresa }: { cartao: CartaoDeAcesso; empresa: string }) {
  return (
    <div className="flex break-inside-avoid flex-col gap-1 border border-dashed border-texto-suave p-3">
      <div className="faixa-seguranca" />
      <p className="text-[10px] font-bold uppercase tracking-wide text-texto-suave">{empresa}</p>
      <p className="font-display text-base font-extrabold leading-tight text-marinho">
        {cartao.nome}
      </p>
      <p className="text-xs text-texto-suave">
        Matrícula <span className="font-mono font-bold text-texto">{cartao.matricula}</span>
        {cartao.setor && ` · ${cartao.setor}`}
      </p>
      <div className="mt-1 rounded-lg bg-marinho px-3 py-2 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amarelo">
          Seu PIN provisório
        </p>
        <p className="font-mono text-2xl font-extrabold tracking-[0.3em] text-white">
          {cartao.pin}
        </p>
      </div>
      <p className="text-[10px] leading-snug text-texto-suave">
        Entre no app com a matrícula e este PIN. No primeiro acesso você escolhe um PIN só seu. Não
        mostre este papel para ninguém.
      </p>
    </div>
  );
}

/**
 * Impressão dos cartões de acesso. Recebe os PINs em memória de
 * `/painel/colaboradores`; recarregar a página perde os cartões de propósito,
 * porque o PIN puro não é gravado em lugar nenhum.
 */
function Cartoes() {
  const navigate = useNavigate();
  const { data: perfil } = usePerfil();
  const [cartoes] = useState<CartaoDeAcesso[]>(() => cartoesPendentes());

  // Sai da memória ao deixar a tela: o PIN não fica pendurado na aba aberta.
  useEffect(() => limparCartoes, []);

  const empresa = perfil?.empresa.nome ?? "";
  const folhas = emFolhas(cartoes);

  if (cartoes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-borda bg-superficie p-10 text-center">
        <p className="font-display text-lg font-bold text-marinho">Nada para imprimir</p>
        <p className="max-w-md text-sm text-texto-suave">
          O PIN aparece uma única vez, logo depois de gerado — não fica guardado. Volte, marque os
          colaboradores e gere os PINs de novo.
        </p>
        <Button onClick={() => void navigate({ to: "/painel/colaboradores" })}>
          <ArrowLeft className="size-4" aria-hidden />
          Voltar aos colaboradores
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-marinho">Cartões de acesso</h1>
          <p className="mt-1 text-sm text-texto-suave">
            {cartoes.length} cartão(ões) em {folhas.length} folha(s). Imprima, recorte e entregue em
            mão. Esta tela não volta: ao sair, os PINs desaparecem.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void navigate({ to: "/painel/colaboradores" })}>
            <ArrowLeft className="size-4" aria-hidden />
            Voltar
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden />
            Imprimir
          </Button>
        </div>
      </header>

      <p className="rounded-xl border border-amarelo bg-amarelo/10 p-3 text-sm text-texto print:hidden">
        <strong>Atenção:</strong> quem já tinha PIN perdeu o antigo e foi desconectado do app. O PIN
        novo é provisório: o colaborador troca no primeiro acesso.
      </p>

      {folhas.map((folha, i) => (
        <section
          key={i}
          className="break-after-page rounded-2xl border border-borda bg-white p-4 print:rounded-none print:border-0 print:p-0"
        >
          <div className="grid grid-cols-2 gap-3">
            {folha.map((c) => (
              <Cartao key={c.colaborador_id} cartao={c} empresa={empresa} />
            ))}
          </div>
          <p className="mt-3 text-center text-[10px] text-texto-suave print:mt-1">
            T.I.M.E. Seguro · folha {i + 1} de {folhas.length}
          </p>
        </section>
      ))}
    </div>
  );
}

export const Route = createFileRoute("/_protegido/painel/colaboradores/cartoes")({
  component: Cartoes,
});
