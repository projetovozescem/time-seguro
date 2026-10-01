/**
 * Tradução dos `motivo` devolvidos pelas RPCs para texto de interface.
 *
 * Fonte: a tabela de docs/TIME_05 §9 (app do colaborador), mais os erros de
 * exceção descritos em docs/TIME_02 §3 e docs/TIME_03 §5. Nenhuma mensagem é
 * inventada aqui: ao receber um `motivo` novo, acrescente-o ao doc primeiro.
 *
 * Linguagem de chão de fábrica: frase curta, sem termo em inglês, dizendo o que
 * a pessoa pode fazer a seguir.
 */
export const MENSAGENS: Record<string, string> = {
  // docs/TIME_05 §9
  credenciais_invalidas: "Matrícula ou PIN incorretos.",
  bloqueado: "Muitas tentativas. Tente de novo em 15 minutos ou fale com o técnico de SST.",
  pin_atual_incorreto: "PIN atual incorreto.",
  pin_fraco: "PIN fraco. Use 6 números sem repetir ou seguir sequência.",
  sem_campanha: "Nenhuma campanha ativa no momento.",
  pergunta_invalida: "Esta pergunta não está disponível hoje.",
  ja_respondida: "Você já respondeu esta pergunta hoje.",
  licao_invalida: "Lição não encontrada.",
  conteudo_nao_concluido: "Estude o conteúdo antes da avaliação.",
  limite_tentativas: "Você usou as 3 tentativas de hoje. Volte amanhã!",
  evento_invalido: "Evento não encontrado.",
  fora_do_horario: "O check-in deste evento não está aberto agora.",
  outro_setor: "Este evento é de outro setor.",
  codigo_expirado: "Código expirado. Escaneie de novo o QR da TV.",
  ja_fez_checkin: "Presença já confirmada! ✅",
  descricao_curta: "Conte um pouco mais (mínimo 10 letras).",
  limite_diario: "Você já enviou muitos relatos hoje. Fale direto com o técnico.",
  local_invalido: "Local não encontrado.",
  ranking_oculto: "O ranking será revelado no fim da campanha.",

  // docs/TIME_02 §3 "Tratamento de erros no front"
  sessao_invalida: "Sua sessão expirou. Entre de novo.",
  acesso_negado: "Você não tem permissão para esta ação.",

  // docs/TIME_03 §5 (Edge Function da foto do relato)
  upload_nao_permitido: "Não foi possível enviar a foto. O relato foi salvo sem ela.",
  dados_invalidos: "Faltou alguma informação. Confira os campos e tente de novo.",
  erro_interno: "Algo deu errado do nosso lado. Tente de novo em instantes.",
};

/** Mensagem genérica para `motivo` que ainda não está no dicionário. */
export const MENSAGEM_PADRAO = "Não foi possível concluir. Tente de novo.";

/**
 * Texto para um `motivo`. Nunca devolve string vazia nem o código cru — a
 * pessoa no chão de fábrica não deve ver `limite_tentativas` na tela.
 */
export function mensagem(motivo: string | null | undefined): string {
  if (!motivo) return MENSAGEM_PADRAO;
  return MENSAGENS[motivo] ?? MENSAGEM_PADRAO;
}

/**
 * Pendências que o `colaborador_login` devolve e que mandam o app para outra
 * tela em vez de mostrar erro (docs/TIME_03 §3).
 */
export const PENDENCIAS = {
  trocar_pin: "/app/novo-pin",
  aceitar_lgpd: "/app/termo",
} as const;

export type Pendencia = keyof typeof PENDENCIAS;

export function ehPendencia(motivo: string | null | undefined): motivo is Pendencia {
  return motivo === "trocar_pin" || motivo === "aceitar_lgpd";
}
