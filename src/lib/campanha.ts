/**
 * Configuração de pontos por campanha (docs/TIME_08 §1).
 *
 * Cada valor pode ser sobrescrito em `campanhas.config`. As chaves e os padrões
 * aqui foram conferidos **contra o SQL**, não só contra o documento: o banco lê
 * por `_cfg(campanha, 'chave', padrao)` nas migrations 0002 e 0003. Mudar um
 * nome aqui sem mudar lá faz a tela mentir.
 */

export type Pilar = "conhecimento" | "relatos" | "engajamento";

export type ChaveConfig =
  | "pontos_acerto_diario"
  | "pontos_licao_conteudo"
  | "pontos_licao_aprovada"
  | "pontos_licao_nota_maxima"
  | "tentativas_avaliacao_dia"
  | "pontos_relato_baixa"
  | "pontos_relato_media"
  | "pontos_relato_alta"
  | "pontos_relato_resolvido"
  | "max_relatos_pontuados_semana"
  | "pontos_presenca"
  | "pontos_streak_7"
  | "pontos_streak_15"
  | "pontos_streak_30"
  | "streak_ignora_fds";

export type DefinicaoConfig = {
  chave: ChaveConfig;
  rotulo: string;
  padrao: number | boolean;
  pilar: Pilar;
  /** O que o número significa, em uma linha, para o acordeão. */
  ajuda: string;
};

/** Na ordem das tabelas de docs/TIME_08 §1. */
export const CONFIG_CAMPANHA: readonly DefinicaoConfig[] = [
  {
    chave: "pontos_acerto_diario",
    rotulo: "Acerto no quiz diário",
    padrao: 10,
    pilar: "conhecimento",
    ajuda: "Por pergunta certa. O teto do dia é este valor × perguntas por dia.",
  },
  {
    chave: "pontos_licao_conteudo",
    rotulo: "Lição: conteúdo concluído",
    padrao: 20,
    pilar: "conhecimento",
    ajuda: "Uma vez por lição, ao tocar em “Terminei de estudar”.",
  },
  {
    chave: "pontos_licao_aprovada",
    rotulo: "Lição: avaliação aprovada",
    padrao: 30,
    pilar: "conhecimento",
    ajuda: "Uma vez por lição, na primeira aprovação.",
  },
  {
    chave: "pontos_licao_nota_maxima",
    rotulo: "Lição: nota 100 (bônus)",
    padrao: 10,
    pilar: "conhecimento",
    ajuda: "Somado ao da aprovação quando a nota é cheia.",
  },
  {
    chave: "tentativas_avaliacao_dia",
    rotulo: "Tentativas de avaliação por dia",
    padrao: 3,
    pilar: "conhecimento",
    ajuda: "Limite anti-fraude: esgotado, só volta amanhã.",
  },
  {
    chave: "pontos_relato_baixa",
    rotulo: "Relato validado — gravidade baixa",
    padrao: 30,
    pilar: "relatos",
    ajuda: "Só pontua depois de o técnico validar.",
  },
  {
    chave: "pontos_relato_media",
    rotulo: "Relato validado — gravidade média",
    padrao: 40,
    pilar: "relatos",
    ajuda: "Só pontua depois de o técnico validar.",
  },
  {
    chave: "pontos_relato_alta",
    rotulo: "Relato validado — gravidade alta",
    padrao: 50,
    pilar: "relatos",
    ajuda: "Só pontua depois de o técnico validar.",
  },
  {
    chave: "pontos_relato_resolvido",
    rotulo: "Relato resolvido (bônus)",
    padrao: 10,
    pilar: "relatos",
    ajuda: "Uma vez por relato, quando o risco é corrigido.",
  },
  {
    chave: "max_relatos_pontuados_semana",
    rotulo: "Relatos pontuados por semana",
    padrao: 5,
    pilar: "relatos",
    ajuda: "Acima disso o relato é tratado, mas não pontua.",
  },
  {
    chave: "pontos_presenca",
    rotulo: "Presença diária",
    padrao: 2,
    pilar: "engajamento",
    ajuda: "Uma vez por dia, e só com ação real — abrir o app não conta.",
  },
  {
    chave: "pontos_streak_7",
    rotulo: "Sequência de 7 dias",
    padrao: 20,
    pilar: "engajamento",
    ajuda: "Uma vez por campanha.",
  },
  {
    chave: "pontos_streak_15",
    rotulo: "Sequência de 15 dias",
    padrao: 50,
    pilar: "engajamento",
    ajuda: "Uma vez por campanha.",
  },
  {
    chave: "pontos_streak_30",
    rotulo: "Sequência de 30 dias",
    padrao: 100,
    pilar: "engajamento",
    ajuda: "Uma vez por campanha.",
  },
  {
    chave: "streak_ignora_fds",
    rotulo: "Fim de semana não quebra a sequência",
    padrao: true,
    pilar: "engajamento",
    ajuda: "Sábado e domingo sem atividade não zeram a sequência.",
  },
] as const;

export const ROTULO_DO_PILAR: Record<Pilar, string> = {
  conhecimento: "🧠 Conhecimento",
  relatos: "📢 Relatos",
  engajamento: "🔥 Engajamento",
};

export type Config = Record<string, number | boolean>;

/** Valor em vigor: o da campanha, ou o padrão. Mesma conta que o `_cfg` do banco. */
export function valorEmVigor(
  config: Config | null | undefined,
  def: DefinicaoConfig,
): number | boolean {
  const bruto = config?.[def.chave];
  if (bruto === undefined || bruto === null) return def.padrao;
  if (typeof def.padrao === "boolean") return Boolean(bruto);
  const n = Number(bruto);
  return Number.isFinite(n) ? n : def.padrao;
}

/**
 * Monta o `config` para gravar: só guarda o que difere do padrão.
 *
 * Aceita `unknown` porque o formulário guarda string enquanto a pessoa digita,
 * e campo em branco tem de virar "usar o padrão", não zero.
 *
 * Guardar tudo congelaria os valores da campanha, e uma mudança futura de padrão
 * no documento não chegaria às campanhas antigas sem migração de dados.
 */
export function configParaGravar(valores: Record<string, unknown>): Config {
  const limpo: Config = {};
  for (const def of CONFIG_CAMPANHA) {
    const valor = valores[def.chave];
    if (valor === undefined || valor === null || valor === "") continue;
    if (typeof def.padrao === "boolean") {
      if (Boolean(valor) !== def.padrao) limpo[def.chave] = Boolean(valor);
      continue;
    }
    const n = Number(valor);
    if (Number.isFinite(n) && n !== def.padrao) limpo[def.chave] = n;
  }
  return limpo;
}

export type Status = "rascunho" | "ativa" | "encerrada";

export const ROTULO_DO_STATUS: Record<Status, string> = {
  rascunho: "Em breve",
  ativa: "Ativa",
  encerrada: "Encerrada",
};

/** Cor do chip de status (docs/TIME_04 §4: cinza / verde / azul). */
export const COR_DO_STATUS: Record<Status, string> = {
  rascunho: "bg-muted text-texto-suave",
  encerrada: "bg-marinho/10 text-marinho",
  ativa: "bg-verde/15 text-verde",
};

export type CampanhaForm = {
  nome: string;
  descricao: string;
  inicio: string;
  fim: string;
  temas: string[];
  perguntas_por_dia: number;
  premiacao: string;
  ranking_visivel: boolean;
};

/**
 * Regras do formulário (docs/TIME_04 §4). Devolve as mensagens; lista vazia
 * significa que pode salvar.
 *
 * O banco também garante parte disso (só uma campanha ativa por empresa, pelo
 * menos um tema para ativar). Aqui é só para o técnico não descobrir o problema
 * por mensagem de erro do Postgres.
 */
export function validarCampanha(f: CampanhaForm): string[] {
  const erros: string[] = [];
  if (f.nome.trim().length < 3) erros.push("Dê um nome à campanha.");
  if (!f.inicio) erros.push("Informe a data de início.");
  if (!f.fim) erros.push("Informe a data de fim.");
  if (f.inicio && f.fim && f.fim < f.inicio) {
    erros.push("O fim não pode ser antes do início.");
  }
  if (f.temas.length === 0) erros.push("Escolha pelo menos um tema.");
  if (
    !Number.isInteger(f.perguntas_por_dia) ||
    f.perguntas_por_dia < 1 ||
    f.perguntas_por_dia > 20
  ) {
    erros.push("Perguntas por dia: use um número de 1 a 20.");
  }
  return erros;
}

/** Teto de pontos do quiz por dia, para o técnico ver o efeito da escolha. */
export function tetoDiarioDoQuiz(perguntasPorDia: number, pontosPorAcerto: number): number {
  return Math.max(perguntasPorDia, 0) * Math.max(pontosPorAcerto, 0);
}
