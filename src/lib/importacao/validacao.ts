import { normalizar, type Aviso, type PerguntaImportada } from "./tipos";

/**
 * Validação do lote de importação (docs/TIME_07 §1 e §6).
 *
 * Portado de `questionValidation.js` do Max Games, sem as regras de
 * palavra-chave (serviam ao caça-palavras) e com tema obrigatório.
 *
 * A separação importa: aviso BLOQUEANTE impede salvar; aviso de atenção só
 * informa. Quem decide o que fazer é o técnico, na tela de revisão.
 */

/** Avisos que impedem salvar (docs/TIME_07 §6, marcados 🔴). */
export const BLOQUEANTES: readonly Aviso[] = [
  "resposta_nao_detectada",
  "correta_fora_da_faixa",
  "poucas_alternativas",
  "tema_ausente",
  "tema_desconhecido",
] as const;

export function ehBloqueante(aviso: Aviso): boolean {
  return BLOQUEANTES.includes(aviso);
}

export function temPendencia(p: PerguntaImportada): boolean {
  return p.avisos.some(ehBloqueante);
}

/** Uma pergunta na tela de revisão: a leitura mais a decisão do técnico. */
export type ItemRevisao = PerguntaImportada & {
  /** Identificador só da tela; não vai para o banco. */
  chave: string;
  /** Resolvido a partir de `tema` contra os temas da empresa. */
  tema_id: string | null;
  /** Desmarcada não é salva. Duplicada do banco vem desmarcada. */
  selecionada: boolean;
};

export type TemaConhecido = { id: string; slug: string; nome: string };

/**
 * Resolve o tema lido do arquivo contra os temas do banco. Aceita slug ou nome,
 * ignorando acento e caixa — quem digita o TXT não tem como saber o slug exato.
 */
export function resolverTema(
  bruto: string | null,
  temas: readonly TemaConhecido[],
): TemaConhecido | null {
  if (!bruto) return null;
  const alvo = normalizar(bruto);
  return (
    temas.find((t) => normalizar(t.slug) === alvo) ??
    temas.find((t) => normalizar(t.nome) === alvo) ??
    // Último recurso: o nome do tema começa com o que foi digitado ("nr 35").
    temas.find((t) => normalizar(t.nome).startsWith(alvo)) ??
    null
  );
}

/**
 * Monta o lote de revisão: resolve temas, marca duplicadas e decide o que vem
 * selecionado.
 *
 * - duplicada DENTRO do lote: só a primeira sobrevive (docs/TIME_07 §6);
 * - duplicada no BANCO: sobrevive, mas vem desmarcada;
 * - com pendência bloqueante: vem marcada, para o técnico corrigir na tela —
 *   o botão de salvar é que fica travado.
 */
export function prepararRevisao(
  perguntas: readonly PerguntaImportada[],
  temas: readonly TemaConhecido[],
  enunciadosNoBanco: readonly string[] = [],
): ItemRevisao[] {
  const jaNoBanco = new Set(enunciadosNoBanco.map(normalizar));
  const vistosNoLote = new Set<string>();
  const itens: ItemRevisao[] = [];

  perguntas.forEach((p, i) => {
    const forma = normalizar(p.enunciado);

    // Duplicada no próprio lote: mantém a primeira e descarta as demais.
    if (forma && vistosNoLote.has(forma)) return;
    if (forma) vistosNoLote.add(forma);

    const tema = resolverTema(p.tema, temas);
    const avisos: Aviso[] = p.avisos.filter((a) => a !== "tema_desconhecido");

    if (p.tema && !tema) avisos.push("tema_desconhecido");

    const duplicadaNoBanco = forma.length > 0 && jaNoBanco.has(forma);
    if (duplicadaNoBanco) avisos.push("duplicada_no_banco");

    itens.push({
      ...p,
      avisos,
      chave: `${i}-${forma.slice(0, 24) || "vazia"}`,
      tema_id: tema?.id ?? null,
      selecionada: !duplicadaNoBanco,
    });
  });

  return itens;
}

export type Resumo = {
  total: number;
  selecionadas: number;
  comPendencia: number;
  duplicadasNoBanco: number;
  semExplicacao: number;
  /** Só libera o salvar quando há seleção e nenhuma selecionada tem pendência. */
  podeSalvar: boolean;
};

/** Contadores da barra fixa da tela de revisão (docs/TIME_07 §6). */
export function resumir(itens: readonly ItemRevisao[]): Resumo {
  const selecionadas = itens.filter((i) => i.selecionada);
  const comPendencia = selecionadas.filter(temPendencia);

  return {
    total: itens.length,
    selecionadas: selecionadas.length,
    comPendencia: comPendencia.length,
    duplicadasNoBanco: itens.filter((i) => i.avisos.includes("duplicada_no_banco")).length,
    semExplicacao: selecionadas.filter((i) => !i.explicacao?.trim()).length,
    podeSalvar: selecionadas.length > 0 && comPendencia.length === 0,
  };
}

/** Texto curto de cada aviso, para o card de revisão. */
export const TEXTO_DO_AVISO: Record<Aviso, string> = {
  resposta_nao_detectada: "Marque qual alternativa é a correta.",
  correta_fora_da_faixa: "A resposta indicada no arquivo não existe entre as alternativas.",
  poucas_alternativas: "Precisa de pelo menos 2 alternativas.",
  muitas_alternativas: "Mais de 5 alternativas: as extras foram descartadas.",
  enunciado_curto: "O enunciado está muito curto.",
  tema_ausente: "Escolha o tema.",
  tema_desconhecido: "O tema do arquivo não existe no banco. Escolha um da lista.",
  duplicada_no_arquivo: "Repetida no arquivo: só a primeira foi mantida.",
  duplicada_no_banco: "Já existe uma pergunta igual no banco.",
};

/** Linha pronta para o `insert` em `perguntas` (docs/TIME_07 §6 "Salvar"). */
export type LinhaParaSalvar = {
  empresa_id: string;
  tema_id: string;
  enunciado: string;
  alternativas: string[];
  correta: number;
  explicacao: string | null;
  dificuldade: number;
  origem: "importacao";
};

/**
 * Converte os itens selecionados em linhas do banco. Ignora o que tem pendência:
 * `resumir().podeSalvar` já deveria ter travado a tela, mas a função não confia
 * nisso — é a última barreira antes do `insert`.
 */
export function paraSalvar(itens: readonly ItemRevisao[], empresaId: string): LinhaParaSalvar[] {
  return itens
    .filter((i) => i.selecionada && !temPendencia(i) && i.tema_id && i.correta !== null)
    .map((i) => ({
      empresa_id: empresaId,
      tema_id: i.tema_id!,
      enunciado: i.enunciado.trim(),
      alternativas: i.alternativas.map((a) => a.trim()),
      correta: i.correta!,
      explicacao: i.explicacao?.trim() || null,
      dificuldade: i.dificuldade ?? 2,
      origem: "importacao",
    }));
}

/** Quebra o lote em blocos, porque o insert vai de 100 em 100 (docs/TIME_07 §6). */
export function emBlocos<T>(itens: readonly T[], tamanho = 100): T[][] {
  if (tamanho < 1) throw new Error("tamanho do bloco precisa ser pelo menos 1");
  const blocos: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    blocos.push(itens.slice(i, i + tamanho));
  }
  return blocos;
}
