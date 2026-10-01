import { useMemo } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TIPOS_EVENTO, tipoEvento, type EventoCalendario } from "@/lib/vozes";
import { cn } from "@/lib/utils";

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function CalendarioGrid({
  mes,
  aoMudarMes,
  eventos,
  diaSelecionado,
  aoSelecionarDia,
}: {
  mes: Date;
  aoMudarMes: (novo: Date) => void;
  eventos: EventoCalendario[];
  diaSelecionado: Date | null;
  aoSelecionarDia: (dia: Date) => void;
}) {
  // A grade cobre semanas inteiras, então inclui dias vizinhos do mês anterior/seguinte.
  const dias = useMemo(() => {
    const inicio = startOfWeek(startOfMonth(mes), { locale: ptBR });
    const fim = endOfWeek(endOfMonth(mes), { locale: ptBR });
    return eachDayOfInterval({ start: inicio, end: fim });
  }, [mes]);

  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, EventoCalendario[]>();
    for (const evento of eventos) {
      const chave = evento.data.slice(0, 10);
      mapa.set(chave, [...(mapa.get(chave) ?? []), evento]);
    }
    return mapa;
  }, [eventos]);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mês anterior"
          onClick={() => aoMudarMes(subMonths(mes, 1))}
        >
          <ChevronLeft className="size-5" />
        </Button>
        <h2 className="font-display text-lg font-bold capitalize">
          {format(mes, "MMMM 'de' yyyy", { locale: ptBR })}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Próximo mês"
          onClick={() => aoMudarMes(addMonths(mes, 1))}
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="py-1 capitalize">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {dias.map((dia) => {
          const chave = format(dia, "yyyy-MM-dd");
          const doDia = eventosPorDia.get(chave) ?? [];
          const doMes = isSameMonth(dia, mes);
          const selecionado = diaSelecionado && isSameDay(dia, diaSelecionado);

          return (
            <button
              key={chave}
              type="button"
              onClick={() => aoSelecionarDia(dia)}
              className={cn(
                "flex min-h-16 flex-col items-start gap-1 rounded-xl border p-1.5 text-left transition-colors sm:min-h-24",
                doMes ? "border-border bg-card" : "border-transparent bg-muted/40 opacity-50",
                selecionado && "border-primary ring-2 ring-primary/40",
                !selecionado && "hover:border-primary/50",
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                  isToday(dia) && "bg-primary text-primary-foreground",
                )}
              >
                {format(dia, "d")}
              </span>

              <div className="flex w-full flex-col gap-0.5 overflow-hidden">
                {doDia.slice(0, 2).map((evento) => {
                  const tipo = tipoEvento(evento.tipo);
                  return (
                    <span
                      key={evento.id}
                      title={evento.titulo}
                      className="truncate rounded px-1 py-0.5 text-[10px] font-medium text-white"
                      style={{ backgroundColor: tipo.cor }}
                    >
                      {tipo.emoji} {evento.titulo}
                    </span>
                  );
                })}
                {doDia.length > 2 && (
                  <span className="px-1 text-[10px] font-medium text-muted-foreground">
                    +{doDia.length - 2} evento{doDia.length - 2 > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 border-t border-border pt-3">
        {Object.entries(TIPOS_EVENTO).map(([chave, tipo]) => (
          <span key={chave} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="size-3 rounded-full"
              style={{ backgroundColor: tipo.cor }}
              aria-hidden
            />
            {tipo.emoji} {tipo.rotulo}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Data ISO (YYYY-MM-DD) de um Date, sem recuo de fuso. */
export function paraISO(dia: Date): string {
  return format(dia, "yyyy-MM-dd");
}
