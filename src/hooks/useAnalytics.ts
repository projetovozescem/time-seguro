import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LETRAS,
  pontuacaoTotal,
  type EventoCalendario,
  type Letra,
  type Pergunta,
  type Turma,
} from "@/lib/vozes";

/*
 * Os agregados do painel são calculados no cliente e não pela RPC
 * `taxa_acerto_por_pergunta`: o documento pede que as métricas combinem
 * `respostas_alunos` com `quiz_tv_respostas` e exibam a alternativa errada mais
 * escolhida, coisas que a função do banco não entrega. O volume é de campanha
 * escolar (centenas de linhas), então agregar em memória é seguro.
 */

export interface RespostaAluno {
  id: string;
  turma_id: string | null;
  pergunta_id: string | null;
  alternativa_escolhida: string;
  acertou: boolean;
  tempo_resposta_ms: number | null;
  dispositivo: string | null;
  data: string | null;
  hora: string | null;
}

export interface QuizTV {
  id: string;
  turma_id: string | null;
  total_perguntas: number;
  acertos: number;
  erros: number;
  pontuacao: number;
  tempo_total_ms: number | null;
  data: string | null;
  created_at: string | null;
}

export interface QuizTVResposta {
  id: string;
  quiz_tv_id: string | null;
  turma_id: string | null;
  pergunta_id: string | null;
  alternativa_escolhida: string;
  acertou: boolean;
  tempo_resposta_ms: number | null;
  ordem: number;
}

export interface Compartilhamento {
  id: string;
  turma_id: string | null;
  plataforma: string | null;
  data: string | null;
  hora: string | null;
}

export interface AcessoQRCode {
  id: string;
  turma_id: string | null;
  acao: string;
  pontuou: boolean | null;
  dispositivo: string | null;
  data: string | null;
  hora: string | null;
}

/** Uma tentativa é qualquer resposta registrada, venha do celular ou da TV. */
export interface Tentativa {
  turma_id: string | null;
  pergunta_id: string | null;
  alternativa_escolhida: string;
  acertou: boolean;
  tempo_resposta_ms: number | null;
  data: string | null;
  hora: string | null;
  origem: "mobile" | "tv";
}

export interface LinhaTurma {
  turma: Turma;
  tentativas: number;
  acertos: number;
  erros: number;
  taxaAcerto: number | null;
  tempoMedioMs: number | null;
  acessos: number;
  compartilhamentos: number;
  pontos: number;
}

export interface LinhaPergunta {
  pergunta: Pergunta;
  exibida: number;
  acertos: number;
  erros: number;
  taxaAcerto: number | null;
  erradaMaisEscolhida: { letra: Letra; vezes: number } | null;
}

function media(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

function taxa(acertos: number, total: number): number | null {
  return total === 0 ? null : (acertos / total) * 100;
}

type TabelaFato =
  "respostas_alunos" | "quiz_tv" | "quiz_tv_respostas" | "compartilhamentos" | "acessos_qrcode";

/*
 * Lista vazia compartilhada. Um "?? []" literal devolveria um array novo a cada
 * render, invalidando todos os useMemo abaixo enquanto as queries carregam.
 */
const VAZIO: never[] = [];

async function buscarTabela<T>(tabela: TabelaFato): Promise<T[]> {
  const { data, error } = await supabase.from(tabela).select("*");
  if (error) throw error;
  return (data ?? []) as T[];
}

/** Carrega todas as tabelas de fatos e devolve os agregados do painel. */
export function useAnalytics() {
  const turmasQ = useQuery({
    queryKey: ["turmas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("turmas").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as Turma[];
    },
  });

  const perguntasQ = useQuery({
    queryKey: ["perguntas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("perguntas").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as Pergunta[];
    },
  });

  const eventosQ = useQuery({
    queryKey: ["eventos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("eventos_calendario").select("*").order("data");
      if (error) throw error;
      return (data ?? []) as EventoCalendario[];
    },
  });

  const respostasQ = useQuery({
    queryKey: ["respostas-alunos"],
    queryFn: () => buscarTabela<RespostaAluno>("respostas_alunos"),
  });

  const quizzesQ = useQuery({
    queryKey: ["quiz-tv"],
    queryFn: () => buscarTabela<QuizTV>("quiz_tv"),
  });

  const quizRespostasQ = useQuery({
    queryKey: ["quiz-tv-respostas"],
    queryFn: () => buscarTabela<QuizTVResposta>("quiz_tv_respostas"),
  });

  const compartilhamentosQ = useQuery({
    queryKey: ["compartilhamentos"],
    queryFn: () => buscarTabela<Compartilhamento>("compartilhamentos"),
  });

  const acessosQ = useQuery({
    queryKey: ["acessos-qrcode"],
    queryFn: () => buscarTabela<AcessoQRCode>("acessos_qrcode"),
  });

  const turmas = turmasQ.data ?? (VAZIO as Turma[]);
  const perguntas = perguntasQ.data ?? (VAZIO as Pergunta[]);
  const eventos = eventosQ.data ?? (VAZIO as EventoCalendario[]);
  const respostas = respostasQ.data ?? (VAZIO as RespostaAluno[]);
  const quizzes = quizzesQ.data ?? (VAZIO as QuizTV[]);
  const quizRespostas = quizRespostasQ.data ?? (VAZIO as QuizTVResposta[]);
  const compartilhamentos = compartilhamentosQ.data ?? (VAZIO as Compartilhamento[]);
  const acessos = acessosQ.data ?? (VAZIO as AcessoQRCode[]);

  const carregando =
    turmasQ.isLoading ||
    perguntasQ.isLoading ||
    eventosQ.isLoading ||
    respostasQ.isLoading ||
    quizzesQ.isLoading ||
    quizRespostasQ.isLoading ||
    compartilhamentosQ.isLoading ||
    acessosQ.isLoading;

  const erro =
    turmasQ.error ??
    perguntasQ.error ??
    eventosQ.error ??
    respostasQ.error ??
    quizzesQ.error ??
    quizRespostasQ.error ??
    compartilhamentosQ.error ??
    acessosQ.error ??
    null;

  /** Respostas do celular e da TV unificadas — a base de quase todas as métricas. */
  const tentativas = useMemo<Tentativa[]>(() => {
    const porQuiz = new Map(quizzes.map((q) => [q.id, q]));
    const doMobile: Tentativa[] = respostas.map((r) => ({
      turma_id: r.turma_id,
      pergunta_id: r.pergunta_id,
      alternativa_escolhida: r.alternativa_escolhida,
      acertou: r.acertou,
      tempo_resposta_ms: r.tempo_resposta_ms,
      data: r.data,
      hora: r.hora,
      origem: "mobile",
    }));
    const daTV: Tentativa[] = quizRespostas.map((r) => ({
      turma_id: r.turma_id,
      pergunta_id: r.pergunta_id,
      alternativa_escolhida: r.alternativa_escolhida,
      acertou: r.acertou,
      tempo_resposta_ms: r.tempo_resposta_ms,
      // quiz_tv_respostas não guarda data própria; herda a da sessão.
      data: r.quiz_tv_id ? (porQuiz.get(r.quiz_tv_id)?.data ?? null) : null,
      hora: null,
      origem: "tv",
    }));
    return [...doMobile, ...daTV];
  }, [respostas, quizRespostas, quizzes]);

  const totais = useMemo(() => {
    const total = tentativas.length;
    const acertos = tentativas.filter((t) => t.acertou).length;
    return {
      tentativas: total,
      acertos,
      erros: total - acertos,
      taxaAcerto: taxa(acertos, total),
      acessos: acessos.filter((a) => a.acao === "acesso").length,
      compartilhamentos: compartilhamentos.length,
      sessoesTV: quizzes.length,
    };
  }, [tentativas, acessos, compartilhamentos, quizzes]);

  /** Seção 1 — desempenho por turma. */
  const porTurma = useMemo<LinhaTurma[]>(() => {
    return turmas.map((turma) => {
      const minhas = tentativas.filter((t) => t.turma_id === turma.id);
      const acertos = minhas.filter((t) => t.acertou).length;
      const tempos = minhas.map((t) => t.tempo_resposta_ms ?? 0).filter((ms) => ms > 0);
      return {
        turma,
        tentativas: minhas.length,
        acertos,
        erros: minhas.length - acertos,
        taxaAcerto: taxa(acertos, minhas.length),
        tempoMedioMs: media(tempos),
        acessos: acessos.filter((a) => a.turma_id === turma.id && a.acao === "acesso").length,
        compartilhamentos: compartilhamentos.filter((c) => c.turma_id === turma.id).length,
        pontos: pontuacaoTotal(turma),
      };
    });
  }, [turmas, tentativas, acessos, compartilhamentos]);

  /** Seção 2 — desempenho por pergunta, com a alternativa errada mais escolhida. */
  const porPergunta = useMemo<LinhaPergunta[]>(() => {
    return perguntas.map((pergunta) => {
      const minhas = tentativas.filter((t) => t.pergunta_id === pergunta.id);
      const acertos = minhas.filter((t) => t.acertou).length;

      const contagem = new Map<Letra, number>();
      for (const t of minhas) {
        if (t.acertou) continue;
        const letra = t.alternativa_escolhida?.toUpperCase() as Letra;
        if (!LETRAS.includes(letra)) continue;
        contagem.set(letra, (contagem.get(letra) ?? 0) + 1);
      }
      let errada: { letra: Letra; vezes: number } | null = null;
      for (const [letra, vezes] of contagem) {
        if (!errada || vezes > errada.vezes) errada = { letra, vezes };
      }

      return {
        pergunta,
        exibida: minhas.length,
        acertos,
        erros: minhas.length - acertos,
        taxaAcerto: taxa(acertos, minhas.length),
        erradaMaisEscolhida: errada,
      };
    });
  }, [perguntas, tentativas]);

  /** Seção 3 — série diária de acertos e erros (opcionalmente de uma turma). */
  function evolucaoDiaria(turmaId?: string | null) {
    const base = turmaId ? tentativas.filter((t) => t.turma_id === turmaId) : tentativas;
    const dias = new Map<string, { acertos: number; erros: number }>();
    for (const t of base) {
      if (!t.data) continue;
      const dia = t.data.slice(0, 10);
      const atual = dias.get(dia) ?? { acertos: 0, erros: 0 };
      if (t.acertou) atual.acertos += 1;
      else atual.erros += 1;
      dias.set(dia, atual);
    }
    return [...dias.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, v]) => ({
        dia,
        acertos: v.acertos,
        erros: v.erros,
        total: v.acertos + v.erros,
        taxaAcerto: taxa(v.acertos, v.acertos + v.erros) ?? 0,
      }));
  }

  /** Seção 4 — distribuição por faixa de horário (7h às 22h). */
  const horarioPico = useMemo(() => {
    const faixas = new Map<number, number>();
    const registrar = (hora: string | null | undefined) => {
      if (!hora) return;
      const h = Number(hora.slice(0, 2));
      if (Number.isNaN(h)) return;
      faixas.set(h, (faixas.get(h) ?? 0) + 1);
    };
    respostas.forEach((r) => registrar(r.hora));
    acessos.forEach((a) => registrar(a.hora));

    const linhas = Array.from({ length: 16 }, (_, i) => {
      const hora = i + 7;
      return { hora, rotulo: `${hora}h`, total: faixas.get(hora) ?? 0 };
    });
    const pico = linhas.reduce((melhor, l) => (l.total > melhor.total ? l : melhor), {
      hora: 0,
      rotulo: "—",
      total: 0,
    });
    return { linhas, pico: pico.total > 0 ? pico : null };
  }, [respostas, acessos]);

  /** Seção 5 — funil acesso → resposta → acerto → compartilhamento. */
  const funil = useMemo(() => {
    const etapas = [
      { etapa: "Acessos via QR Code", valor: totais.acessos },
      { etapa: "Responderam o quiz", valor: respostas.length },
      { etapa: "Acertaram", valor: respostas.filter((r) => r.acertou).length },
      { etapa: "Compartilharam", valor: compartilhamentos.length },
    ];
    return etapas.map((e, i) => {
      const anterior = i === 0 ? null : etapas[i - 1]!.valor;
      return {
        ...e,
        conversao: anterior && anterior > 0 ? (e.valor / anterior) * 100 : null,
      };
    });
  }, [totais.acessos, respostas, compartilhamentos]);

  /** Seção 7 — de onde vêm os pontos de cada fonte. */
  const comparativoFontes = useMemo(() => {
    const soma = (campo: keyof Turma) =>
      turmas.reduce((s, t) => s + ((t[campo] as number | null) ?? 0), 0);
    return [
      { fonte: "QR Code", pontos: soma("pontuacao_qrcode") },
      { fonte: "Quiz TV", pontos: soma("pontuacao_quiz_tv") },
      { fonte: "Compartilhamento", pontos: soma("pontuacao_compartilhamento") },
    ];
  }, [turmas]);

  /** Cards de resumo do dashboard: pergunta campeã e pergunta mais difícil. */
  const destaquesPerguntas = useMemo(() => {
    const comDados = porPergunta.filter((p) => p.exibida > 0 && p.taxaAcerto !== null);
    if (comDados.length === 0) return { maisAcertada: null, maisErrada: null };
    const ordenadas = [...comDados].sort((a, b) => (b.taxaAcerto ?? 0) - (a.taxaAcerto ?? 0));
    return {
      maisAcertada: ordenadas[0] ?? null,
      maisErrada: ordenadas[ordenadas.length - 1] ?? null,
    };
  }, [porPergunta]);

  const nomeDaTurma = useMemo(() => {
    const mapa = new Map(turmas.map((t) => [t.id, t.nome]));
    return (id: string | null) => (id ? (mapa.get(id) ?? "—") : "—");
  }, [turmas]);

  return {
    carregando,
    erro,
    turmas,
    perguntas,
    eventos,
    respostas,
    quizzes,
    quizRespostas,
    compartilhamentos,
    acessos,
    tentativas,
    totais,
    porTurma,
    porPergunta,
    evolucaoDiaria,
    horarioPico,
    funil,
    comparativoFontes,
    destaquesPerguntas,
    nomeDaTurma,
  };
}

export type Analytics = ReturnType<typeof useAnalytics>;
