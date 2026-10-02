import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarRange, Pencil, Plus, Trophy, Users } from "lucide-react";
import { CampanhaForm } from "@/components/painel/CampanhaForm";
import { Button } from "@/components/ui/button";
import { usePerfil } from "@/hooks/usePerfil";
import { useCampanhas, useTemasDaCampanha, type Campanha } from "@/hooks/useCampanhas";
import { useTemas } from "@/hooks/usePerguntas";
import { COR_DO_STATUS, ROTULO_DO_STATUS } from "@/lib/campanha";
import { formatarData } from "@/lib/datas";

/** Carrega os temas da campanha só quando ela entra em edição. */
function FormComTemas({
  campanha,
  temas,
  empresaId,
  aoFechar,
}: {
  campanha: Campanha | null;
  temas: ReturnType<typeof useTemas>["data"];
  empresaId: string | null;
  aoFechar: () => void;
}) {
  const { data: vinculados, isLoading } = useTemasDaCampanha(campanha?.id ?? "");
  if (campanha && isLoading) return null;

  return (
    <CampanhaForm
      campanha={campanha}
      temasIniciais={campanha ? (vinculados ?? []) : []}
      temas={temas ?? []}
      empresaId={empresaId}
      aoFechar={aoFechar}
    />
  );
}

/** Lista de campanhas (docs/TIME_04 §4). */
function Campanhas() {
  const { data: perfil } = usePerfil();
  const { data: temas = [] } = useTemas();
  const { data: campanhas = [], isLoading } = useCampanhas();
  const [editando, setEditando] = useState<Campanha | "nova" | null>(null);

  const podeEditar = perfil?.papel === "admin" || perfil?.papel === "tecnico";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-end gap-3">
        <h1 className="sr-only">Campanhas</h1>
        {podeEditar && (
          <Button onClick={() => setEditando("nova")}>
            <Plus className="size-4" aria-hidden />
            Nova campanha
          </Button>
        )}
      </header>

      {isLoading && (
        <p className="rounded-2xl border border-borda bg-superficie p-6 text-sm text-texto-suave">
          Carregando…
        </p>
      )}

      {!isLoading && campanhas.length === 0 && (
        <p className="rounded-2xl border border-borda bg-superficie p-6 text-center text-sm text-texto-suave">
          Nenhuma campanha ainda. Crie a primeira como rascunho, vincule os temas e ative quando
          estiver pronta.
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {campanhas.map((c) => (
          <li
            key={c.id}
            className="flex flex-col rounded-2xl border border-borda bg-superficie p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-texto">{c.nome}</h2>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${COR_DO_STATUS[c.status]}`}
              >
                {ROTULO_DO_STATUS[c.status]}
              </span>
            </div>

            {c.descricao && <p className="mt-1 text-sm text-texto-suave">{c.descricao}</p>}

            <dl className="mt-3 flex flex-col gap-1 text-sm text-texto-suave">
              <div className="flex items-center gap-2">
                <CalendarRange className="size-4 shrink-0" aria-hidden />
                <dt className="sr-only">Período</dt>
                <dd>
                  {formatarData(c.inicio)} a {formatarData(c.fim)}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <Users className="size-4 shrink-0" aria-hidden />
                <dt className="sr-only">Perguntas por dia</dt>
                <dd>{c.perguntas_por_dia} perguntas por dia</dd>
              </div>
              {c.premiacao && (
                <div className="flex items-center gap-2">
                  <Trophy className="size-4 shrink-0" aria-hidden />
                  <dt className="sr-only">Premiação</dt>
                  <dd>{c.premiacao}</dd>
                </div>
              )}
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link to="/painel/campanhas/$id" params={{ id: c.id }}>
                  Abrir
                </Link>
              </Button>
              {podeEditar && c.status !== "encerrada" && (
                <Button size="sm" variant="ghost" onClick={() => setEditando(c)}>
                  <Pencil className="size-4" aria-hidden />
                  Editar
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {editando && (
        <FormComTemas
          campanha={editando === "nova" ? null : editando}
          temas={temas}
          empresaId={perfil?.empresa.id ?? null}
          aoFechar={() => setEditando(null)}
        />
      )}
    </div>
  );
}

export const Route = createFileRoute("/_protegido/painel/campanhas/")({
  component: Campanhas,
});
