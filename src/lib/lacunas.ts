/**
 * Mapa de lacunas (docs/TIME_09 §1.2) — o diferencial do produto: mostra qual
 * setor não domina qual tema, para o técnico escolher o próximo treinamento com
 * dado em vez de palpite.
 *
 * Duas decisões de leitura que importam:
 * 1. Abaixo de `MINIMO_RESPOSTAS` a célula é "dados insuficientes", não "ruim".
 *    Um setor com 3 respostas e 1 acerto não tem 33% de domínio; tem 3 respostas.
 * 2. A célula mostra o NÚMERO além da cor, porque cor sozinha exclui quem tem
 *    daltonismo (docs/TIME_10 §2).
 */

export type Faixa = "domina" | "atencao" | "lacuna" | "insuficiente";

/** Abaixo disso não se conclui nada da taxa (docs/TIME_09 §1.2). */
export const MINIMO_RESPOSTAS = 10;

export const FAIXAS: Record<Faixa, { rotulo: string; cor: string; leitura: string }> = {
  domina: {
    rotulo: "≥ 80%",
    cor: "bg-verde text-white",
    leitura: "Domina o tema",
  },
  atencao: {
    rotulo: "60–79%",
    cor: "bg-amarelo text-texto",
    leitura: "Atenção",
  },
  lacuna: {
    rotulo: "< 60%",
    cor: "bg-vermelho text-white",
    leitura: "Lacuna: priorizar treinamento",
  },
  insuficiente: {
    rotulo: `< ${MINIMO_RESPOSTAS} respostas`,
    // Listrado para não ser confundido com uma faixa de desempenho.
    cor: "bg-muted text-texto-suave bg-[repeating-linear-gradient(45deg,transparent_0_6px,rgba(0,0,0,0.06)_6px_12px)]",
    leitura: "Dados insuficientes",
  },
};

/**
 * Faixa de uma célula. `taxa` é 0–1, como a view devolve.
 *
 * A ordem das comparações importa: contagem insuficiente vence a taxa, senão um
 * setor com 2 respostas e 2 acertos apareceria como "domina".
 */
export function faixaDaCelula(tentativas: number, taxa: number): Faixa {
  if (tentativas < MINIMO_RESPOSTAS) return "insuficiente";
  if (taxa >= 0.8) return "domina";
  if (taxa >= 0.6) return "atencao";
  return "lacuna";
}

/** Taxa em percentual inteiro, para a célula mostrar junto da cor. */
export function percentual(taxa: number): number {
  return Math.round(taxa * 100);
}

/**
 * Taxa 0–1 a partir das contagens. As views `v_lacunas` e `v_desempenho_pergunta`
 * devolvem `taxa_acerto` em 0–100 (`round(100.0 * ...)`), mas a tela e a faixa
 * pensam em 0–1: usar a coluna crua deixava todo mapa verde e mostrava "10000%".
 * Por isso a taxa é sempre refeita aqui, das contagens.
 */
export function taxaDe(acertos: number, tentativas: number): number {
  return tentativas > 0 ? acertos / tentativas : 0;
}

/** Linha de uma view com `taxa_acerto` já corrigida para 0–1. */
export function comTaxaCorrigida<
  T extends { acertos: number; tentativas: number; taxa_acerto: number },
>(linha: T): T {
  return { ...linha, taxa_acerto: taxaDe(Number(linha.acertos), Number(linha.tentativas)) };
}

export type LinhaLacuna = {
  setor_id: string;
  tema_id: string;
  tentativas: number;
  acertos: number;
  taxa_acerto: number;
};

export type Celula = {
  setor_id: string;
  tema_id: string;
  tentativas: number;
  acertos: number;
  taxa: number;
  faixa: Faixa;
};

/**
 * Matriz setor × tema. Combinação sem dado nenhum vira célula vazia (tentativas
 * 0, faixa "insuficiente") — a ausência também é informação: ninguém daquele
 * setor respondeu nada daquele tema.
 */
export function montarMatriz(
  linhas: readonly LinhaLacuna[],
  setores: readonly string[],
  temas: readonly string[],
): Map<string, Celula> {
  const porChave = new Map<string, LinhaLacuna>();
  for (const l of linhas) porChave.set(`${l.setor_id}|${l.tema_id}`, l);

  const matriz = new Map<string, Celula>();
  for (const setor_id of setores) {
    for (const tema_id of temas) {
      const chave = `${setor_id}|${tema_id}`;
      const l = porChave.get(chave);
      const tentativas = l?.tentativas ?? 0;
      const taxa = Number(l?.taxa_acerto ?? 0);
      matriz.set(chave, {
        setor_id,
        tema_id,
        tentativas,
        acertos: l?.acertos ?? 0,
        taxa,
        faixa: faixaDaCelula(tentativas, taxa),
      });
    }
  }
  return matriz;
}

/** Quantas células do mapa caem em cada faixa — alimenta a legenda. */
export function contarPorFaixa(matriz: ReadonlyMap<string, Celula>): Record<Faixa, number> {
  const contagem: Record<Faixa, number> = { domina: 0, atencao: 0, lacuna: 0, insuficiente: 0 };
  for (const c of matriz.values()) contagem[c.faixa] += 1;
  return contagem;
}

/**
 * As lacunas de verdade, da pior para a melhor — é a lista que responde "o que
 * treinar primeiro". Ignora as células sem dado suficiente.
 */
export function prioridadeDeTreinamento(matriz: Map<string, Celula>): Celula[] {
  return [...matriz.values()]
    .filter((c) => c.faixa === "lacuna" || c.faixa === "atencao")
    .sort((a, b) => a.taxa - b.taxa);
}

/** Temas com pior desempenho, para o "Focar nas lacunas" do Modo TV. */
export function temasPorPiorDesempenho(matriz: Map<string, Celula>): string[] {
  const porTema = new Map<string, { tentativas: number; acertos: number }>();
  for (const c of matriz.values()) {
    if (c.tentativas === 0) continue;
    const atual = porTema.get(c.tema_id) ?? { tentativas: 0, acertos: 0 };
    atual.tentativas += c.tentativas;
    atual.acertos += c.acertos;
    porTema.set(c.tema_id, atual);
  }

  return [...porTema.entries()]
    .sort((a, b) => a[1].acertos / a[1].tentativas - b[1].acertos / b[1].tentativas)
    .map(([tema]) => tema);
}
