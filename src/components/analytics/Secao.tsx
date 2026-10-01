import type { ReactNode } from "react";

/** Moldura comum de todas as seções do painel, com título, ação e estado vazio. */
export function Secao({
  titulo,
  descricao,
  acao,
  vazio,
  mensagemVazio,
  children,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
  vazio?: boolean;
  mensagemVazio?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">{titulo}</h2>
          {descricao && <p className="mt-0.5 text-sm text-muted-foreground">{descricao}</p>}
        </div>
        {acao}
      </div>

      {vazio ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          {mensagemVazio ?? "Ainda não há dados para exibir."}
        </p>
      ) : (
        children
      )}
    </section>
  );
}

/** Percentual formatado em pt-BR, ou travessão quando não há base de cálculo. */
export function percentual(valor: number | null | undefined, casas = 0): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "—";
  return `${valor.toFixed(casas).replace(".", ",")}%`;
}

/** Tempo em milissegundos exibido em segundos. */
export function segundos(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms <= 0) return "—";
  return `${(ms / 1000).toFixed(1).replace(".", ",")}s`;
}
