export interface Turma {
  id: string;
  nome: string;
  serie: string;
  qr_code_url: string | null;
  quantidade_alunos: number | null;
  pontuacao_qrcode: number | null;
  pontuacao_quiz_tv: number | null;
  pontuacao_compartilhamento: number | null;
  status: string | null;
  created_at: string | null;
}

export interface Pergunta {
  id: string;
  enunciado: string;
  alternativa_a: string;
  alternativa_b: string;
  alternativa_c: string;
  alternativa_d: string;
  resposta_correta: string;
  status: string | null;
  created_at: string | null;
}

export interface EventoCalendario {
  id: string;
  titulo: string;
  data: string;
  horario: string | null;
  descricao: string | null;
  tipo: string;
  turma_id: string | null;
  status: string | null;
  created_at: string | null;
}

export type Letra = "A" | "B" | "C" | "D";
export const LETRAS: Letra[] = ["A", "B", "C", "D"];

export function alternativaTexto(p: Pergunta, letra: Letra): string {
  switch (letra) {
    case "A":
      return p.alternativa_a;
    case "B":
      return p.alternativa_b;
    case "C":
      return p.alternativa_c;
    case "D":
      return p.alternativa_d;
  }
}

export function pontuacaoTotal(t: Turma): number {
  return (
    (t.pontuacao_qrcode ?? 0) + (t.pontuacao_quiz_tv ?? 0) + (t.pontuacao_compartilhamento ?? 0)
  );
}

export function hojeISO(): string {
  const agora = new Date();
  const fuso = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
  return fuso.toISOString().slice(0, 10);
}

export function urlDaTurma(turmaId: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/aluno/${turmaId}`;
}

export function detectarDispositivo(): "mobile" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "mobile" : "desktop";
}

/** Cada acerto no Quiz TV vale 10 pontos para a turma. */
export const PONTOS_POR_ACERTO_TV = 10;

export const TOTAL_PERGUNTAS_TV = 15;

/**
 * Dias em que as perguntas diárias do celular ficam disponíveis. Fora dessas
 * datas, o quiz do líder da turma fica bloqueado — ver `diaDoJogoISO`.
 */
export const DIAS_QUIZ_MOBILE = ["2026-09-29"];

/** Sem limite: o líder responde todas as perguntas ativas no dia da campanha. */
export const PERGUNTAS_POR_DIA_MOBILE = Number.POSITIVE_INFINITY;

/** Aparelhos distintos que podem pontuar por turma: 1 líder + até 9 alunos. */
export const LIMITE_PARTICIPANTES_TURMA = 10;

/**
 * Primeiro dia em que o app do aluno mostra a tela de encerramento. O último dia
 * de perguntas é 29/09; a partir daqui os alunos aguardam a divulgação dos
 * pontos.
 */
export const FIM_DA_CAMPANHA = "2026-09-30";

/**
 * Se a campanha já acabou para o aluno. Usa o "dia do jogo" (fronteira das 6h),
 * não a meia-noite: assim as perguntas do dia 23 continuam valendo até as 6h do
 * dia 24, exatamente quando elas expiram, e só então entra a tela de
 * encerramento — sem uma janela de madrugada em que o aluno perde o que ainda
 * tinha direito de responder.
 */
export function campanhaEncerrada(): boolean {
  return diaDoJogoISO() >= FIM_DA_CAMPANHA;
}

/** Cada acerto nas perguntas diárias do celular vale 10 pontos para a turma. */
export const PONTOS_POR_ACERTO_MOBILE = 10;

/**
 * "Dia do jogo" para as perguntas diárias: igual ao dia local, mas as
 * perguntas só expiram às 6h da manhã seguinte, não à meia-noite — então entre
 * 00h e 06h ainda contamos como o dia anterior.
 */
export function diaDoJogoISO(): string {
  const agora = new Date();
  agora.setHours(agora.getHours() - 6);
  const fuso = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
  return fuso.toISOString().slice(0, 10);
}

/** Hash simples e determinístico de uma string, usado para semear o embaralhamento diário. */
function hashSemente(texto: string): number {
  let h = 0;
  for (const c of texto) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
  return h || 1;
}

/**
 * Embaralha com uma semente fixa (xorshift32), não com Math.random() — o
 * resultado precisa ser o mesmo em todo recarregamento da página no mesmo dia.
 */
function embaralharComSemente<T>(lista: T[], semente: number): T[] {
  const copia = [...lista];
  let estado = semente;
  const proximoAleatorio = () => {
    estado ^= estado << 13;
    estado ^= estado >>> 17;
    estado ^= estado << 5;
    estado >>>= 0;
    return estado / 0xffffffff;
  };
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(proximoAleatorio() * (i + 1));
    const troca = copia[i]!;
    copia[i] = copia[j]!;
    copia[j] = troca;
  }
  return copia;
}

/**
 * Todas as perguntas do dia de uma turma: cada turma tem seu próprio conjunto,
 * determinado por turmaId + dia, então recarregar a página no mesmo dia
 * sempre mostra as mesmas perguntas, na mesma ordem.
 */
export function perguntasDoDia(
  perguntas: Pergunta[],
  turmaId: string,
  diaISO: string,
  quantidade = PERGUNTAS_POR_DIA_MOBILE,
): Pergunta[] {
  if (perguntas.length === 0) return [];
  const semente = hashSemente(turmaId + diaISO);
  const embaralhadas = embaralharComSemente(perguntas, semente);
  return Number.isFinite(quantidade) ? embaralhadas.slice(0, quantidade) : embaralhadas;
}

/** Formata uma data ISO (YYYY-MM-DD) como dd/MM/yyyy, sem sofrer com fuso. */
export function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  if (!ano || !mes || !dia) return "—";
  return `${dia}/${mes}/${ano}`;
}

export interface TipoEvento {
  rotulo: string;
  emoji: string;
  cor: string;
}

export const TIPOS_EVENTO: Record<string, TipoEvento> = {
  palestra: { rotulo: "Palestra / roda de conversa", emoji: "🎤", cor: "var(--primary-dark)" },
  cartaz: { rotulo: "Cartazes e QR Code", emoji: "📌", cor: "var(--laranja)" },
  quiz: { rotulo: "Quiz ativo", emoji: "🎮", cor: "var(--sucesso)" },
  encerramento: { rotulo: "Encerramento", emoji: "🏆", cor: "var(--dourado)" },
  geral: { rotulo: "Geral", emoji: "💜", cor: "var(--accent)" },
};

const TIPO_PADRAO: TipoEvento = { rotulo: "Geral", emoji: "💜", cor: "var(--accent)" };

/** Traz o visual de um tipo de evento, caindo em "geral" quando o tipo é desconhecido. */
export function tipoEvento(tipo: string | null | undefined): TipoEvento {
  return (tipo && TIPOS_EVENTO[tipo]) || TIPO_PADRAO;
}
