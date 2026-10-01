import { MINIMO_RESPOSTAS, percentual } from "./lacunas";

/**
 * Comparativo trimestral (docs/TIME_09 §3): duas a quatro campanhas lado a lado.
 *
 * Tudo é função pura sobre as linhas de `v_lacunas` e os totais que o painel já
 * lê. A regra que mais importa aqui é a mesma do mapa de lacunas: célula com
 * menos de `MINIMO_RESPOSTAS` respostas **não entra na comparação**, porque uma
 * variação de 2 para 4 respostas não é evolução, é ruído.
 */

export type LinhaLacunaCampanha = {
  campanha_id: string;
  setor_id: string;
  tema_id: string;
  tentativas: number;
  acertos: number;
};

export type ResumoDaCampanha = {
  campanhaId: string;
  nome: string;
  /** Colaboradores que pontuaram, sobre os ativos no fim da campanha. */
  participantes: number;
  ativos: number;
  tentativas: number;
  acertos: number;
  relatosRecebidos: number;
  relatosValidados: number;
  relatosResolvidos: number;
  /** Média de horas de validado até resolvido; `null` quando nada foi resolvido. */
  horasAteResolver: number | null;
};

/** Participação em % do efetivo. Sem efetivo é 0, não divisão por zero. */
export function participacao(resumo: Pick<ResumoDaCampanha, "participantes" | "ativos">): number {
  if (resumo.ativos === 0) return 0;
  return Math.round((resumo.participantes / resumo.ativos) * 100);
}

/** Taxa de acerto geral em %, arredondada. `null` quando ninguém respondeu. */
export function taxaGeral(resumo: Pick<ResumoDaCampanha, "tentativas" | "acertos">): number | null {
  if (resumo.tentativas === 0) return null;
  return percentual(resumo.acertos / resumo.tentativas);
}

/** Taxa por tema de uma campanha, somando todos os setores. */
export function taxaPorTema(
  linhas: readonly LinhaLacunaCampanha[],
): Map<string, { tentativas: number; acertos: number; taxa: number | null }> {
  const porTema = new Map<string, { tentativas: number; acertos: number; taxa: number | null }>();
  for (const l of linhas) {
    const atual = porTema.get(l.tema_id) ?? { tentativas: 0, acertos: 0, taxa: null };
    atual.tentativas += l.tentativas;
    atual.acertos += l.acertos;
    porTema.set(l.tema_id, atual);
  }
  for (const v of porTema.values()) {
    v.taxa = v.tentativas > 0 ? percentual(v.acertos / v.tentativas) : null;
  }
  return porTema;
}

export type Variacao = {
  setor_id: string;
  tema_id: string;
  antes: number;
  depois: number;
  /** Em pontos percentuais. Positivo é melhora. */
  delta: number;
};

/**
 * Variação de cada célula setor × tema entre duas campanhas.
 *
 * Só compara célula que tem respostas suficientes nas DUAS campanhas: sem isso,
 * um setor que respondeu 3 perguntas no trimestre passado apareceria com uma
 * "queda de 40 pontos" que nunca existiu.
 */
export function variacoes(
  antes: readonly LinhaLacunaCampanha[],
  depois: readonly LinhaLacunaCampanha[],
): Variacao[] {
  const chave = (l: LinhaLacunaCampanha) => `${l.setor_id}|${l.tema_id}`;
  const mapaAntes = new Map(antes.map((l) => [chave(l), l]));

  const resultado: Variacao[] = [];
  for (const d of depois) {
    const a = mapaAntes.get(chave(d));
    if (!a) continue;
    if (a.tentativas < MINIMO_RESPOSTAS || d.tentativas < MINIMO_RESPOSTAS) continue;
    const taxaAntes = percentual(a.acertos / a.tentativas);
    const taxaDepois = percentual(d.acertos / d.tentativas);
    resultado.push({
      setor_id: d.setor_id,
      tema_id: d.tema_id,
      antes: taxaAntes,
      depois: taxaDepois,
      delta: taxaDepois - taxaAntes,
    });
  }
  return resultado.sort((x, y) => y.delta - x.delta);
}

/** Variação menor que isto é empate: não vira frase nem seta. */
export const VARIACAO_MINIMA = 5;

/**
 * Frases do topo do comparativo (docs/TIME_09 §3), por regra simples: a maior
 * subida e a maior queda que passem de `VARIACAO_MINIMA` pontos.
 */
export function frasesDeDestaque(
  lista: readonly Variacao[],
  nomeDoSetor: (id: string) => string,
  nomeDoTema: (id: string) => string,
): string[] {
  const relevantes = lista.filter((v) => Math.abs(v.delta) >= VARIACAO_MINIMA);
  if (relevantes.length === 0) return [];

  const frases: string[] = [];
  const subiu = relevantes[0]!;
  if (subiu.delta > 0) {
    frases.push(
      `A taxa de acerto em ${nomeDoTema(subiu.tema_id)} no setor ${nomeDoSetor(subiu.setor_id)} subiu de ${subiu.antes}% para ${subiu.depois}%.`,
    );
  }

  const caiu = relevantes.at(-1)!;
  if (caiu.delta < 0 && caiu !== subiu) {
    frases.push(
      `A taxa de acerto em ${nomeDoTema(caiu.tema_id)} no setor ${nomeDoSetor(caiu.setor_id)} caiu de ${caiu.antes}% para ${caiu.depois}%.`,
    );
  }
  return frases;
}

/** Seta da célula: ▲ melhorou, ▼ piorou, – empate dentro da margem. */
export function seta(delta: number): "▲" | "▼" | "–" {
  if (delta >= VARIACAO_MINIMA) return "▲";
  if (delta <= -VARIACAO_MINIMA) return "▼";
  return "–";
}
