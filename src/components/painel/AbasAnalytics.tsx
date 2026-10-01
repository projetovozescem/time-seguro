import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEngajamento, useRelatosAnalytics } from "@/hooks/useAnalytics";
import {
  calorPorLocal,
  contarPor,
  distribuicaoDeSequencias,
  formatarDuracao,
  horaDePico,
  mediaDeHoras,
  percentualResolvidos,
  usoPorHora,
  type Relato,
} from "@/lib/analytics";
import { baixarCsv, montarCsv } from "@/lib/eventos";
import { definicaoDoTipo } from "@/lib/eventos";
import { GRAVIDADES, rotuloDaCategoria, rotuloDoStatus } from "@/lib/relatos";
import { formatarData } from "@/lib/datas";

/**
 * Abas Relatos e Engajamento do analytics (docs/TIME_09 §1.4 e §1.5).
 *
 * Os números vêm todos de `src/lib/analytics.ts`, que é testado sem navegador;
 * aqui só há apresentação.
 */

/** Barras horizontais: lê melhor que pizza quando os rótulos são longos. */
function Barras({
  titulo,
  dados,
  cor = "bg-marinho",
  sufixo,
}: {
  titulo: string;
  dados: readonly { rotulo: string; quantidade: number }[];
  cor?: string;
  sufixo?: string;
}) {
  const maior = Math.max(1, ...dados.map((d) => d.quantidade));

  return (
    <section className="rounded-2xl border border-borda bg-superficie p-4">
      <h3 className="font-display text-base font-bold text-marinho">{titulo}</h3>
      {dados.length === 0 ? (
        <p className="mt-2 text-sm text-texto-suave">Sem dado neste período.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {dados.map((d) => (
            <li
              key={d.rotulo}
              className="grid grid-cols-[minmax(6rem,10rem)_1fr_3rem] items-center gap-2"
            >
              <span className="truncate text-sm text-texto" title={d.rotulo}>
                {d.rotulo}
              </span>
              <span className="h-4 rounded bg-muted" aria-hidden>
                <span
                  className={`block h-4 rounded ${cor}`}
                  style={{ width: `${(d.quantidade / maior) * 100}%` }}
                />
              </span>
              <span className="text-right text-sm font-semibold tabular-nums text-texto">
                {d.quantidade}
                {sufixo}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="rounded-2xl border border-borda bg-superficie p-4">
      <dt className="text-xs uppercase tracking-wide text-texto-suave">{rotulo}</dt>
      <dd className="mt-1 font-display text-2xl font-extrabold tabular-nums text-marinho">
        {valor}
      </dd>
      {detalhe && <p className="mt-1 text-xs text-texto-suave">{detalhe}</p>}
    </div>
  );
}

export function AbaRelatos({
  campanhaId,
  nomeDoSetor,
  nomeDoLocal,
}: {
  campanhaId: string | null;
  nomeDoSetor: (id: string) => string;
  nomeDoLocal: (id: string) => string;
}) {
  const { data, isLoading } = useRelatosAnalytics(campanhaId);

  if (isLoading) return <p className="text-sm text-texto-suave">Carregando…</p>;
  if (!data || data.relatos.length === 0) {
    return (
      <p className="rounded-2xl border border-borda bg-superficie p-6 text-center text-sm text-texto-suave">
        Nenhum relato nesta campanha ainda.
      </p>
    );
  }

  const relatos = data.relatos as Relato[];

  const porCategoria = contarPor(relatos, (r) => rotuloDaCategoria(r.categoria));
  const porGravidade = contarPor(
    relatos,
    (r) => GRAVIDADES.find((g) => g.gravidade === r.gravidade)?.rotulo ?? null,
    "Sem gravidade definida",
  );
  const porSetor = contarPor(relatos, (r) => (r.setor_id ? nomeDoSetor(r.setor_id) : null));
  const calor = calorPorLocal(relatos, nomeDoLocal);

  const ateValidar = mediaDeHoras(relatos.map((r) => ({ de: r.criado_em, ate: r.validado_em })));
  const ateResolver = mediaDeHoras(
    data.relatos.map((r) => ({
      de: r.validado_em as string | null,
      ate: data.resolvidoEm.get(r.id as string) ?? null,
    })),
  );

  function exportar() {
    baixarCsv(
      `relatos-analytics-${new Date().toISOString().slice(0, 10)}.csv`,
      montarCsv(
        ["recorte", "rotulo", "quantidade"],
        [
          ...porCategoria.map((d) => ["categoria", d.rotulo, d.quantidade]),
          ...porGravidade.map((d) => ["gravidade", d.rotulo, d.quantidade]),
          ...porSetor.map((d) => ["setor", d.rotulo, d.quantidade]),
          ...calor.map((c) => ["local", c.local, c.total]),
        ],
      ),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Numero rotulo="Relatos" valor={String(relatos.length)} />
        <Numero rotulo="Resolvidos" valor={`${percentualResolvidos(relatos)}%`} />
        <Numero
          rotulo="Até validar"
          valor={formatarDuracao(ateValidar)}
          detalhe="média de recebido até o técnico validar"
        />
        <Numero
          rotulo="Até resolver"
          valor={formatarDuracao(ateResolver)}
          detalhe="média de validado até virar resolvido"
        />
      </dl>

      <div className="flex justify-end">
        <Button variant="outline" onClick={exportar}>
          <Download className="size-4" aria-hidden />
          Exportar CSV
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Barras titulo="Por categoria" dados={porCategoria} />
        <Barras titulo="Por gravidade" dados={porGravidade} cor="bg-laranja" />
        <Barras titulo="Por setor" dados={porSetor} />

        <section className="rounded-2xl border border-borda bg-superficie p-4">
          <h3 className="font-display text-base font-bold text-marinho">
            Pontos que concentram risco
          </h3>
          <p className="mt-1 text-xs text-texto-suave">
            Locais com mais relatos. Os graves aparecem destacados — é por onde começar a inspeção.
          </p>
          {calor.length === 0 ? (
            <p className="mt-2 text-sm text-texto-suave">
              Nenhum relato veio de um local com QR Code ainda.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1.5">
              {calor.slice(0, 10).map((c) => (
                <li
                  key={c.local}
                  className="flex items-center justify-between gap-2 rounded-xl bg-fundo px-3 py-2 text-sm"
                >
                  <span className="truncate text-texto">{c.local}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {c.graves > 0 && (
                      <span className="rounded-full bg-vermelho/15 px-2 py-0.5 text-xs font-semibold text-vermelho">
                        {c.graves} grave{c.graves > 1 ? "s" : ""}
                      </span>
                    )}
                    <span className="font-semibold tabular-nums text-texto">{c.total}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Barras
        titulo="Por situação"
        dados={contarPor(relatos, (r) => rotuloDoStatus(r.status))}
        cor="bg-marinho/70"
      />
    </div>
  );
}

export function AbaEngajamento({ campanhaId }: { campanhaId: string | null }) {
  const { data, isLoading } = useEngajamento(campanhaId);

  if (isLoading) return <p className="text-sm text-texto-suave">Carregando…</p>;
  if (!data) return null;

  const sequencias = distribuicaoDeSequencias(data.diasPorColaborador, data.ativos);
  const horas = usoPorHora(data.instantes);
  const pico = horaDePico(data.instantes);
  const maiorHora = Math.max(1, ...horas.map((h) => h.quantidade));

  const porEvento = data.eventos.map((e) => ({
    rotulo: `${definicaoDoTipo(e.tipo as string).emoji} ${e.titulo as string} · ${formatarData(e.inicio as string)}`,
    quantidade: data.checkinsPorEvento.get(e.id as string) ?? 0,
  }));

  const participaram = data.ativos.filter(
    (id) => (data.diasPorColaborador.get(id) ?? []).length > 0,
  ).length;

  function exportar() {
    baixarCsv(
      `engajamento-${new Date().toISOString().slice(0, 10)}.csv`,
      montarCsv(
        ["recorte", "rotulo", "quantidade"],
        [
          ...sequencias.map((s) => ["sequencia", s.rotulo, s.quantidade]),
          ...horas.map((h) => ["hora", `${String(h.hora).padStart(2, "0")}h`, h.quantidade]),
          ...porEvento.map((e) => ["evento", e.rotulo, e.quantidade]),
        ],
      ),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-3 sm:grid-cols-3">
        <Numero rotulo="Colaboradores ativos" valor={String(data.ativos.length)} />
        <Numero
          rotulo="Participaram"
          valor={String(participaram)}
          detalhe={
            data.ativos.length > 0
              ? `${Math.round((participaram / data.ativos.length) * 100)}% do efetivo`
              : "sem colaborador ativo"
          }
        />
        <Numero
          rotulo="Horário de maior uso"
          valor={pico === null ? "—" : `${String(pico).padStart(2, "0")}h`}
          detalhe="bom horário para marcar o DDS"
        />
      </dl>

      <div className="flex justify-end">
        <Button variant="outline" onClick={exportar}>
          <Download className="size-4" aria-hidden />
          Exportar CSV
        </Button>
      </div>

      <Barras
        titulo="Sequência de dias seguidos"
        dados={sequencias}
        cor="bg-verde"
        sufixo=" pessoa(s)"
      />

      <section className="rounded-2xl border border-borda bg-superficie p-4">
        <h3 className="font-display text-base font-bold text-marinho">Horários de uso</h3>
        <p className="mt-1 text-xs text-texto-suave">
          Quando as pessoas respondem o quiz. O horário mais cheio é o que mais gente consegue parar
          — use para marcar o DDS.
        </p>
        <ol className="mt-3 flex h-32 items-end gap-0.5">
          {horas.map((h) => (
            <li
              key={h.hora}
              className="flex flex-1 flex-col items-center justify-end gap-1"
              title={`${String(h.hora).padStart(2, "0")}h — ${h.quantidade} resposta(s)`}
            >
              <span
                className={`w-full rounded-t ${h.hora === pico ? "bg-amarelo" : "bg-marinho"}`}
                style={{
                  height: `${Math.max((h.quantidade / maiorHora) * 100, h.quantidade > 0 ? 4 : 1)}%`,
                }}
                aria-hidden
              />
              <span className="text-[9px] tabular-nums text-texto-suave">{h.hora}</span>
            </li>
          ))}
        </ol>
      </section>

      <Barras titulo="Check-ins por evento" dados={porEvento} sufixo=" presente(s)" />
    </div>
  );
}
