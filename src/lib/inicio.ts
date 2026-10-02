import { diaOperacionalISO } from "./datas";
import { somarDias } from "./analytics";

/**
 * Números do Início do painel (docs/TIME_04 §3). Funções puras sobre as linhas
 * que o painel já lê por RLS: o número é testável sem navegador.
 */

/** Os `n` dias que terminam em `hoje`, do mais antigo para o mais novo. */
export function ultimosDias(n: number, hoje = diaOperacionalISO()): string[] {
  return Array.from({ length: n }, (_, i) => somarDias(hoje, i - (n - 1)));
}

type Atividade = { colaborador_id: string; dia: string };

/** Pessoas distintas ativas em cada dia — o gráfico de linha de 30 dias. */
export function pessoasAtivasPorDia(
  atividade: readonly Atividade[],
  dias: readonly string[],
): { dia: string; pessoas: number }[] {
  const porDia = new Map<string, Set<string>>();
  for (const a of atividade) {
    const d = a.dia.slice(0, 10);
    if (!porDia.has(d)) porDia.set(d, new Set());
    porDia.get(d)!.add(a.colaborador_id);
  }
  return dias.map((dia) => ({ dia, pessoas: porDia.get(dia)?.size ?? 0 }));
}

/**
 * % dos colaboradores ativos com alguma atividade nos últimos 7 dias. Sem
 * efetivo é 0, não divisão por zero. Só conta quem ainda está entre os ativos:
 * atividade de quem foi desligado não infla a participação.
 */
export function participacao7dias(
  atividade: readonly Atividade[],
  ativos: readonly string[],
  hoje = diaOperacionalISO(),
): number {
  if (ativos.length === 0) return 0;
  const janela = new Set(ultimosDias(7, hoje));
  const quem = new Set(ativos);
  const ativosNaJanela = new Set(
    atividade
      .filter((a) => janela.has(a.dia.slice(0, 10)) && quem.has(a.colaborador_id))
      .map((a) => a.colaborador_id),
  );
  return Math.round((ativosNaJanela.size / ativos.length) * 100);
}

type RelatoResumo = {
  status: string;
  validado: boolean;
  gravidade: string | null;
  criado_em: string;
};

/** Relatos que o técnico ainda não olhou (docs/TIME_04 §3: aguardando validação). */
export function aguardandoValidacao(relatos: readonly RelatoResumo[]): number {
  return relatos.filter((r) => r.status === "aberto" && !r.validado).length;
}

/** Status em que o relato já não precisa de ação. */
const ENCERRADOS = ["resolvido", "rejeitado", "duplicado"];

/** Gravidade alta, ainda sem solução há mais de `dias` dias (alerta vermelho). */
export function gravesParados(
  relatos: readonly RelatoResumo[],
  agora = new Date(),
  dias = 3,
): number {
  const limite = agora.getTime() - dias * 86_400_000;
  return relatos.filter(
    (r) =>
      r.gravidade === "alta" &&
      !ENCERRADOS.includes(r.status) &&
      new Date(r.criado_em).getTime() < limite,
  ).length;
}

type Colab = {
  ativo: boolean;
  anonimizado: boolean;
  lgpd_aceite_em: string | null;
  bloqueado_ate: string | null;
};

/**
 * Alertas de acesso: quem está bloqueado por PIN e quem nunca entrou. "Nunca
 * entrou" é não ter aceito o termo LGPD: o PIN é fixo e já nasce pronto, então
 * `pin_provisorio` deixou de dizer alguma coisa.
 */
export function alertasDeAcesso(colabs: readonly Colab[], agora = new Date()) {
  const ativos = colabs.filter((c) => c.ativo && !c.anonimizado);
  return {
    bloqueados: ativos.filter((c) => c.bloqueado_ate && new Date(c.bloqueado_ate) > agora).length,
    semPrimeiroAcesso: ativos.filter((c) => !c.lgpd_aceite_em).length,
  };
}
