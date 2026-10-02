import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCampanhaAtiva, usePerfil, diasRestantes } from "@/hooks/usePerfil";
import { useLacunas, useVisaoGeral } from "@/hooks/useAnalytics";
import { useDadosDoInicio } from "@/hooks/useDadosDoInicio";
import { useRankingIndividual, useRankingSetor } from "@/hooks/useRanking";
import { useSetores } from "@/hooks/useEventos";
import { useTemas } from "@/hooks/usePerguntas";
import {
  alertasDeAcesso,
  aguardandoValidacao,
  gravesParados,
  participacao7dias,
  pessoasAtivasPorDia,
  ultimosDias,
} from "@/lib/inicio";
import { montarMatriz, percentual, prioridadeDeTreinamento } from "@/lib/lacunas";
import { definicaoDoTipo } from "@/lib/eventos";
import { formatarData, formatarHora } from "@/lib/datas";

type Destino = "/painel/relatos" | "/painel/campanhas" | "/painel/eventos";

function Cartao({
  titulo,
  valor,
  detalhe,
  destaque,
  para,
}: {
  titulo: string;
  valor: string;
  detalhe?: string | undefined;
  destaque?: boolean;
  para?: Destino;
}) {
  const conteudo = (
    <div
      className={`h-full rounded-2xl border p-4 ${
        destaque ? "border-vermelho/50 bg-vermelho/5" : "border-borda bg-superficie"
      }`}
    >
      <dt className="text-xs uppercase tracking-wide text-texto-suave">{titulo}</dt>
      <dd
        className={`mt-1 font-display text-2xl font-extrabold tabular-nums ${
          destaque ? "text-vermelho" : "text-marinho"
        }`}
      >
        {valor}
      </dd>
      {detalhe && <p className="mt-1 text-xs text-texto-suave">{detalhe}</p>}
    </div>
  );
  return para ? <Link to={para}>{conteudo}</Link> : conteudo;
}

/** Início do painel: dashboard de docs/TIME_04 §3. */
function PainelInicio() {
  const { data: perfil } = usePerfil();
  const { data: campanha, isLoading: carregandoCampanha } = useCampanhaAtiva();
  const campanhaId = campanha?.id ?? null;

  const { data: dados } = useDadosDoInicio(campanhaId);
  const { data: geral } = useVisaoGeral(campanhaId);
  const { data: individual = [] } = useRankingIndividual(campanhaId);
  const { data: porSetor = [] } = useRankingSetor(campanhaId);
  const { data: lacunas = [] } = useLacunas(campanhaId);
  const { data: setores = [] } = useSetores();
  const { data: temas = [] } = useTemas();

  const nomeDoSetor = useMemo(() => new Map(setores.map((s) => [s.id, s.nome])), [setores]);
  const nomeDoTema = useMemo(
    () => new Map(temas.map((t) => [t.id, `${t.icone} ${t.nome}`])),
    [temas],
  );

  const ativos = useMemo(
    () => (dados?.colaboradores ?? []).filter((c) => c.ativo && !c.anonimizado).map((c) => c.id),
    [dados],
  );
  const serie = useMemo(
    () => pessoasAtivasPorDia(dados?.atividade ?? [], ultimosDias(30)),
    [dados],
  );
  const piores = useMemo(() => {
    const matriz = montarMatriz(
      lacunas,
      setores.map((s) => s.id),
      [...new Set(lacunas.map((l) => l.tema_id))],
    );
    return prioridadeDeTreinamento(matriz).slice(0, 3);
  }, [lacunas, setores]);

  const alertas = alertasDeAcesso(dados?.colaboradores ?? []);
  const graves = gravesParados(dados?.relatos ?? []);
  const dias = diasRestantes(campanha?.fim);
  const evento = dados?.proximoEvento;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold text-marinho">Início</h1>
        {perfil && <p className="mt-1 text-sm text-texto-suave">{perfil.empresa.nome}</p>}
      </header>

      {!carregandoCampanha && !campanha && (
        <section className="rounded-2xl border border-amarelo bg-amarelo/10 p-5">
          <h2 className="font-display text-lg font-bold text-texto">Nenhuma campanha ativa</h2>
          <p className="mt-1 text-sm text-texto-suave">
            Sem campanha ativa o app do colaborador não tem quiz do dia nem ranking.
          </p>
          <Link
            to="/painel/campanhas"
            className="mt-3 inline-block rounded-xl bg-marinho px-4 py-2 text-sm font-semibold text-white"
          >
            Criar campanha
          </Link>
        </section>
      )}

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Cartao
          titulo="🏆 Campanha ativa"
          valor={campanha?.nome ?? "—"}
          detalhe={
            campanha
              ? `${formatarData(campanha.inicio)} a ${formatarData(campanha.fim)}${
                  dias !== null ? ` · faltam ${dias} dias` : ""
                }`
              : undefined
          }
          {...(campanha ? { para: "/painel/campanhas" as const } : {})}
        />
        <Cartao
          titulo="👷 Participação"
          valor={`${participacao7dias(dados?.atividade ?? [], ativos)}%`}
          detalhe="dos ativos, nos últimos 7 dias"
        />
        <Cartao
          titulo="📢 Relatos para validar"
          valor={String(aguardandoValidacao(dados?.relatos ?? []))}
          detalhe="aguardando o técnico"
          para="/painel/relatos"
        />
        <Cartao
          titulo="🔴 Graves parados"
          valor={String(graves)}
          detalhe="gravidade alta sem solução há mais de 3 dias"
          destaque={graves > 0}
          para="/painel/relatos"
        />
        <Cartao
          titulo="🧠 Taxa de acerto"
          valor={geral && geral.respostas > 0 ? `${percentual(geral.taxaAcerto)}%` : "—"}
          detalhe={geral ? `${geral.respostas} respostas` : undefined}
        />
        <Cartao
          titulo="📅 Próximo evento"
          valor={evento ? evento.titulo : "—"}
          detalhe={
            evento
              ? `${definicaoDoTipo(evento.tipo).rotulo} · ${formatarData(evento.inicio)} ${formatarHora(evento.inicio)}`
              : "nenhum agendado"
          }
          {...(evento ? { para: "/painel/eventos" as const } : {})}
        />
      </dl>

      <section className="rounded-2xl border border-borda bg-superficie p-4">
        <h2 className="font-display text-base font-bold text-marinho">
          Pessoas ativas por dia — últimos 30 dias
        </h2>
        <div className="mt-3 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serie}>
              <XAxis dataKey="dia" tickFormatter={(d: string) => d.slice(8, 10)} fontSize={11} />
              <YAxis allowDecimals={false} width={28} fontSize={11} />
              <Tooltip labelFormatter={(d) => formatarData(String(d))} />
              <Line
                type="monotone"
                dataKey="pessoas"
                name="Pessoas"
                stroke="#0B3C5D"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-borda bg-superficie p-4">
          <h2 className="font-display text-base font-bold text-marinho">Top 5 colaboradores</h2>
          {individual.length === 0 ? (
            <p className="mt-2 text-sm text-texto-suave">Sem pontuação ainda.</p>
          ) : (
            <ol className="mt-2 flex flex-col gap-1 text-sm">
              {individual.slice(0, 5).map((c, i) => (
                <li key={c.colaborador_id} className="flex justify-between gap-2">
                  <span>
                    {i + 1}º {c.nome}
                  </span>
                  <span className="font-semibold tabular-nums">{c.total}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-2xl border border-borda bg-superficie p-4">
          <h2 className="font-display text-base font-bold text-marinho">Ranking de setores</h2>
          {porSetor.length === 0 ? (
            <p className="mt-2 text-sm text-texto-suave">Sem pontuação ainda.</p>
          ) : (
            <ol className="mt-2 flex flex-col gap-1 text-sm">
              {porSetor.slice(0, 5).map((s, i) => (
                <li key={s.setor_id} className="flex justify-between gap-2">
                  <span>
                    {i + 1}º {s.nome}
                  </span>
                  <span className="font-semibold tabular-nums">{s.total}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-borda bg-superficie p-4">
        <h2 className="font-display text-base font-bold text-marinho">Onde reforçar</h2>
        {piores.length === 0 ? (
          <p className="mt-2 text-sm text-texto-suave">
            Nenhuma lacuna com resposta suficiente ainda (mínimo de 10 por célula).
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {piores.map((c) => (
              <li
                key={`${c.setor_id}|${c.tema_id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-fundo px-3 py-2 text-sm"
              >
                <span>
                  {nomeDoSetor.get(c.setor_id) ?? "Setor"} · {nomeDoTema.get(c.tema_id) ?? "Tema"} —{" "}
                  <strong>{percentual(c.taxa)}%</strong> de acerto
                </span>
                <Link to="/painel/eventos" className="font-semibold text-marinho underline">
                  Agendar DDS sobre este tema
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(alertas.bloqueados > 0 || alertas.semPrimeiroAcesso > 0) && (
        <section className="rounded-2xl border border-amarelo bg-amarelo/10 p-4 text-sm">
          <h2 className="font-display text-base font-bold text-texto">Alertas de acesso</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {alertas.bloqueados > 0 && (
              <li>🔒 {alertas.bloqueados} colaborador(es) bloqueado(s) por PIN errado.</li>
            )}
            {alertas.semPrimeiroAcesso > 0 && (
              <li>🆕 {alertas.semPrimeiroAcesso} ainda não fizeram o primeiro acesso.</li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_protegido/painel/")({
  component: PainelInicio,
});
