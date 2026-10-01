// Transicoes puras do estado de jogo.
//
// Antes toda essa logica vivia dentro de closures de setGameState em
// useGame.js, o que a tornava impossivel de testar. Aqui cada funcao e
// (estado, payload) => novo estado, sem efeito colateral: nada de gravar
// historico, nada de escrever no Firestore. useGame.js so despacha.

import { sanitizeWord } from '../utils/wordGrid';

export const ELIMINACAO_POINTS = [2, 5, 10, 20, 40];

// BoardGame desenha as casas 0..totalSquares-1 e marca a ultima como bandeira.
export const CORRIDA_BOARD_SIZE = 30;
export const CORRIDA_FINISH = CORRIDA_BOARD_SIZE - 1;

const BETS_MODES = ['cassino', 'crash', 'lootbox', 'roleta', 'cassino_inst'];
const FRESH_LIFELINES = { fiftyfifty: true, skip: true, askTeam: true };

// Copia rasa de teams seguida de teams[i].score += x mutava o estado anterior.
// Com React.StrictMode o updater roda duas vezes e a pontuacao era somada em
// dobro. Este helper devolve sempre equipes novas.
export function withTeamScore(teams, index, updater) {
  return teams.map((t, i) => (i === index ? { ...t, score: updater(t.score) } : t));
}

export function nextPool(prev) {
  let newPool = [...(prev.poolIds || [])];
  newPool.shift();
  if (newPool.length === 0) {
    newPool = [...(prev.allQuestionIds || [])].sort(() => Math.random() - 0.5);
  }
  return { poolIds: newPool, currentQuestionId: newPool[0] };
}

// "Perde o proximo turno" era (currentTeamIndex + 2), que pulava a equipe
// SEGUINTE em vez da que caiu na casa — e com 2 equipes nao fazia nada.
export function advanceCorridaTeam(prev, pendingSkip) {
  const total = prev.teams.length;
  const pending = pendingSkip === undefined ? (prev.pendingSkipTeam ?? null) : pendingSkip;
  const nextIdx = (prev.currentTeamIndex + 1) % total;
  if (pending !== null && nextIdx === pending && total > 1) {
    return { currentTeamIndex: (nextIdx + 1) % total, pendingSkipTeam: null };
  }
  return { currentTeamIndex: nextIdx, pendingSkipTeam: pending };
}

// currentDuelPairIdx era fixado em 0 e nunca incrementado: so a primeira dupla
// jogava e as demais equipes nunca pontuavam.
export function nextDuelPair(prev) {
  const total = (prev.dueloPairs || []).length;
  if (total === 0) return 0;
  return ((prev.currentDuelPairIdx || 0) + 1) % total;
}

export function generateSpecialSquares(size) {
  const types = ['star', 'trap', 'bonus_question', 'stop'];
  const squares = [];
  const usedIndices = new Set([0, 1]);
  const count = Math.floor(size * 0.2);
  for (let i = 0; i < count; i++) {
    let idx;
    // size - 3 para nunca cair na casa final (a bandeira).
    do { idx = Math.floor(Math.random() * (size - 3)) + 2; } while (usedIndices.has(idx));
    usedIndices.add(idx);
    squares.push({ index: idx, type: types[Math.floor(Math.random() * types.length)] });
  }
  return squares;
}

// O Firestore nao aceita array aninhado, entao as duplas sao objetos { a, b }.
export function generateDueloPairs(teamCount) {
  const pairs = [];
  for (let i = 0; i < teamCount; i++) {
    for (let j = i + 1; j < teamCount; j++) {
      pairs.push({ a: i, b: j });
    }
  }
  return pairs.sort(() => Math.random() - 0.5);
}

export function randomBombDuration() {
  return Math.floor(Math.random() * 30) + 15;
}

// ─── Respondente da vez (relatorio por aluno) ────────────────────────────────
//
// As perguntas sao respondidas pela equipe, entao creditar o acerto a todos os
// membros nao seria dado real. A cada turno a equipe aponta um respondente,
// em rodizio. Turma sem alunos cadastrados fica com responderId null e tudo
// funciona exatamente como antes, so por equipe.
export function rotateResponder(teams, teamIndex) {
  const team = teams[teamIndex];
  const members = team?.memberIds || [];
  if (members.length === 0) return { teams, currentResponderId: null };

  const pos = ((team.responderPos ?? -1) + 1) % members.length;
  const newTeams = teams.map((t, i) => (i === teamIndex ? { ...t, responderPos: pos } : t));
  return { teams: newTeams, currentResponderId: members[pos] };
}

/** Troca manualmente o respondente da equipe da vez. */
export function setResponder(prev, studentId) {
  const team = prev.teams[prev.currentTeamIndex];
  const pos = (team?.memberIds || []).indexOf(studentId);
  if (pos === -1) return prev;
  return {
    ...prev,
    teams: prev.teams.map((t, i) => (i === prev.currentTeamIndex ? { ...t, responderPos: pos } : t)),
    currentResponderId: studentId,
  };
}

/** Credita um acerto ou erro ao respondente da vez. */
export function creditResponder(prev, isCorrect, points = 0) {
  const id = prev.currentResponderId;
  if (!id) return prev.studentStats || {};
  const stats = { ...(prev.studentStats || {}) };
  const entry = stats[id] || { correct: 0, wrong: 0, points: 0 };
  stats[id] = {
    correct: entry.correct + (isCorrect ? 1 : 0),
    wrong: entry.wrong + (isCorrect ? 0 : 1),
    points: entry.points + (isCorrect ? points : 0),
  };
  return stats;
}

// ─── Estado inicial ──────────────────────────────────────────────────────────

/**
 * @param {{teams: {name:string, memberIds?: string[]}[], mode?: string,
 *   questions: import('../types.js').Question[],
 *   activeGame?: {targetScore?: number|string, scoreType?: string}|null,
 *   gameId?: string|null, classId?: string|null, now?: number}} config
 * @returns {import('../types.js').GameState}
 */
export function createInitialState({ teams, mode = 'cacapalavras', questions, activeGame, gameId, classId, now = Date.now() }) {
  let targetScore = 100;
  let scorePerQ = 10;
  let scoreType = 'total';

  if (activeGame) {
    // Um id de jogo velho apontando para questions vazio dava Infinity aqui.
    targetScore = Math.max(1, Number(activeGame.targetScore) || 1);
    scoreType = activeGame.scoreType;
    scorePerQ = scoreType === 'total' ? targetScore / questions.length : targetScore;
  }

  const shuffledIds = [...questions].sort(() => Math.random() - 0.5).map((q) => q.id);

  // Como o turno gira entre as equipes, exigir questions.length * targetScore
  // tornava a meta inalcancavel: nenhuma equipe responde todas as perguntas.
  const winGoal = scoreType === 'per_question'
    ? Math.ceil(questions.length / Math.max(1, teams.length)) * targetScore
    : targetScore;

  const initialTeams = teams.map((t, idx) => ({
    id: idx,
    name: t.name,
    score: BETS_MODES.includes(mode) ? 500 : 0,
    memberIds: t.memberIds || [],
    responderPos: -1,
    ...(mode === 'cassino_inst' ? { candies: 0, instStreak: 0 } : {}),
  }));

  const opening = rotateResponder(initialTeams, 0);

  return {
    status: 'playing',
    gameMode: mode,
    gameId,
    classId,
    startTime: now,
    targetScore,
    scorePerQ,
    scoreType,
    winGoal,
    paused: false,
    teams: opening.teams,
    currentTeamIndex: 0,
    currentResponderId: opening.currentResponderId,
    studentStats: {},
    usedQuestionIds: [],
    allQuestionIds: shuffledIds,
    poolIds: [...shuffledIds],
    currentQuestionId: shuffledIds[0],
    phase: mode === 'quiz_tempo' ? 'question'
         : mode === 'bomba' ? 'question'
         : mode === 'duelo' ? 'waiting_buzz'
         : 'quiz',
    // Quiz Tempo
    buzzedTeamIdx: null,
    buzzOrder: [],
    // Forca
    forcaGuessed: [],
    forcaWrong: [],
    // Eliminação
    eliminacaoLevel: 0,
    roundAccumulated: 0,
    lifelines: { ...FRESH_LIFELINES },
    removedOptions: [],
    // Corrida
    boardPositions: teams.map(() => 0),
    specialSquares: mode === 'corrida' ? generateSpecialSquares(CORRIDA_BOARD_SIZE) : [],
    pendingSkipTeam: null,
    questionStartTime: now,
    currentSpecial: null,
    // Bomba
    bombTeamIndex: 0,
    bombDuration: randomBombDuration(),
    bombStartTime: now,
    // Duelo
    dueloPairs: mode === 'duelo' ? generateDueloPairs(teams.length) : [],
    currentDuelPairIdx: 0,
    duelBuzzedTeam: null,
    stealFromTeam: null,
    // Cassino
    houseBalance: 0,
    spinCost: 50,
    lastSpinResult: null,
  };
}

// ─── Compartilhado ───────────────────────────────────────────────────────────

export function togglePause(prev) {
  return { ...prev, paused: !prev.paused };
}

export function nextTurn(prev) {
  if (prev.status === 'finished') return prev;
  const nextIdx = (prev.currentTeamIndex + 1) % prev.teams.length;
  const turn = rotateResponder(prev.teams, nextIdx);
  return {
    ...prev, ...nextPool(prev),
    teams: turn.teams,
    currentTeamIndex: nextIdx,
    currentResponderId: turn.currentResponderId,
    phase: 'quiz',
    forcaGuessed: [], forcaWrong: [], removedOptions: [],
    // As ajudas eram globais e nunca reiniciadas: a equipe 1 gastava as tres e
    // as equipes 2-4 jogavam o resto da partida sem nenhuma.
    lifelines: { ...FRESH_LIFELINES },
  };
}

/** Avanca o turno mantendo o modo (usado por Eliminacao e Quiz Tempo). */
function passTurn(prev, extra = {}) {
  const nextIdx = (prev.currentTeamIndex + 1) % prev.teams.length;
  const turn = rotateResponder(prev.teams, nextIdx);
  return {
    ...prev, ...nextPool(prev), ...extra,
    teams: turn.teams,
    currentTeamIndex: nextIdx,
    currentResponderId: turn.currentResponderId,
  };
}

export function updateTeamScore(prev, teamIndex, delta) {
  if (!prev.teams[teamIndex]) return prev;
  return { ...prev, teams: withTeamScore(prev.teams, teamIndex, (s) => s + delta) };
}

export function addHouseBalance(prev, amount) {
  return { ...prev, houseBalance: (prev.houseBalance || 0) + amount };
}

// ─── Caça-Palavras ───────────────────────────────────────────────────────────

export function answerQuiz(prev, isCorrect) {
  if (!isCorrect) return nextTurn({ ...prev, studentStats: creditResponder(prev, false) });
  return { ...prev, phase: 'wordsearch' };
}

export function completeWordSearch(prev, timeLeft) {
  const raw = timeLeft >= 15 ? prev.scorePerQ : prev.scorePerQ / 2;
  // Inteiro: evita placares fracionados tipo "1.3" e garante ao menos 1 ponto.
  const points = Math.max(1, Math.round(raw));
  const teams = withTeamScore(prev.teams, prev.currentTeamIndex, (s) => s + points);
  const studentStats = creditResponder(prev, true, points);

  if (teams[prev.currentTeamIndex].score >= prev.winGoal) {
    return { ...prev, teams, studentStats, status: 'finished' };
  }
  return { ...prev, teams, studentStats, phase: 'turn_transition' };
}

export function failWordSearch(prev) {
  return { ...prev, phase: 'turn_transition', studentStats: creditResponder(prev, false) };
}

// ─── Quiz Tempo ──────────────────────────────────────────────────────────────

export function buzzTeam(prev, teamIdx) {
  if (prev.buzzedTeamIdx !== null) return prev;
  return {
    ...prev,
    buzzedTeamIdx: teamIdx,
    buzzOrder: [...(prev.buzzOrder || []), teamIdx],
    phase: 'answering',
  };
}

export function answerQuizTempo(prev, teamIdx, isCorrect) {
  const buzzPos = (prev.buzzOrder || []).indexOf(teamIdx);
  const pts = isCorrect ? (buzzPos === 0 ? 10 : buzzPos === 1 ? 5 : 2) : -2;
  const teams = withTeamScore(prev.teams, teamIdx, (s) => Math.max(0, s + pts));

  if (isCorrect || (prev.buzzOrder || []).length >= prev.teams.length) {
    if (teams.some((t) => t.score >= prev.winGoal)) {
      return { ...prev, teams, status: 'finished' };
    }
    return {
      ...prev, ...nextPool(prev), teams,
      phase: 'question', buzzedTeamIdx: null, buzzOrder: [],
    };
  }
  // Errou, mas as outras equipes ainda nao apertaram: volta para 'question'
  // para os botoes reaparecerem.
  return { ...prev, teams, phase: 'question', buzzedTeamIdx: null };
}

export function skipQuizTempo(prev) {
  return { ...prev, ...nextPool(prev), phase: 'question', buzzedTeamIdx: null, buzzOrder: [] };
}

// ─── Forca ───────────────────────────────────────────────────────────────────

export function answerForcaQuiz(prev, isCorrect) {
  if (!isCorrect) return nextTurn({ ...prev, studentStats: creditResponder(prev, false) });
  return { ...prev, phase: 'forca', forcaGuessed: [], forcaWrong: [] };
}

export function guessForcaLetter(prev, letter, question) {
  if (!question) return prev;
  // sanitizeWord evita o TypeError quando a pergunta nao tem palavra.
  const word = sanitizeWord(question.word);
  if (!word) return prev;

  const guessed = prev.forcaGuessed || [];
  const wrong = prev.forcaWrong || [];
  if (guessed.includes(letter) || wrong.includes(letter)) return prev;

  if (!word.includes(letter)) {
    const newWrong = [...wrong, letter];
    if (newWrong.length >= 6) {
      return {
        ...prev, forcaWrong: newWrong, phase: 'turn_transition',
        studentStats: creditResponder(prev, false),
      };
    }
    return { ...prev, forcaWrong: newWrong };
  }

  const newGuessed = [...guessed, letter];
  if (!word.split('').every((l) => newGuessed.includes(l))) {
    return { ...prev, forcaGuessed: newGuessed };
  }

  const mult = wrong.length <= 2 ? 1 : wrong.length <= 4 ? 0.66 : 0.33;
  // Inteiro, igual a completeWordSearch: a Forca ainda gerava placares "1.3".
  const pts = Math.max(1, Math.round(prev.scorePerQ * mult));
  const teams = withTeamScore(prev.teams, prev.currentTeamIndex, (s) => s + pts);
  const studentStats = creditResponder(prev, true, pts);

  if (teams[prev.currentTeamIndex].score >= prev.winGoal) {
    return { ...prev, teams, studentStats, status: 'finished', forcaGuessed: newGuessed };
  }
  return { ...prev, teams, studentStats, phase: 'turn_transition', forcaGuessed: newGuessed };
}

// ─── Eliminação ──────────────────────────────────────────────────────────────

export function answerEliminacao(prev, isCorrect) {
  if (!isCorrect) {
    return passTurn(prev, {
      phase: 'eliminated', eliminacaoLevel: 0, roundAccumulated: 0, removedOptions: [],
      lifelines: { ...FRESH_LIFELINES },
      studentStats: creditResponder(prev, false),
    });
  }

  const earned = ELIMINACAO_POINTS[prev.eliminacaoLevel];
  const accumulated = (prev.roundAccumulated || 0) + earned;

  if (prev.eliminacaoLevel >= ELIMINACAO_POINTS.length - 1) {
    const teams = withTeamScore(prev.teams, prev.currentTeamIndex, (s) => s + accumulated);
    const studentStats = creditResponder(prev, true, accumulated);

    if (teams[prev.currentTeamIndex].score >= prev.winGoal) {
      return { ...prev, teams, studentStats, status: 'finished' };
    }
    // revealEarned/revealAccumulated preservam os numeros da rodada: level e
    // roundAccumulated sao zerados aqui e o painel mostrava "+2" e "0".
    return passTurn({ ...prev, teams, studentStats }, {
      phase: 'reveal', eliminacaoLevel: 0, roundAccumulated: 0, removedOptions: [],
      lifelines: { ...FRESH_LIFELINES },
      revealEarned: earned, revealAccumulated: accumulated, revealRoundOver: true,
    });
  }

  return {
    ...prev, ...nextPool(prev),
    phase: 'reveal',
    eliminacaoLevel: prev.eliminacaoLevel + 1,
    roundAccumulated: accumulated,
    revealEarned: earned, revealAccumulated: accumulated, revealRoundOver: false,
    studentStats: creditResponder(prev, true, earned),
  };
}

export function activateLifeline(prev, type, question) {
  if (!prev.lifelines?.[type]) return prev;
  const lifelines = { ...prev.lifelines, [type]: false };

  if (type === 'fiftyfifty') {
    if (!question) return { ...prev, lifelines };
    const wrongIndices = question.options
      .map((_, i) => i)
      .filter((i) => i !== question.correct);
    const removedOptions = wrongIndices.sort(() => Math.random() - 0.5).slice(0, 2);
    return { ...prev, lifelines, removedOptions };
  }

  if (type === 'skip') {
    return { ...prev, ...nextPool(prev), lifelines, phase: 'quiz', removedOptions: [] };
  }

  return { ...prev, lifelines, phase: 'ask_team_pause' };
}

export function resumeFromAskTeam(prev) {
  return { ...prev, phase: 'quiz' };
}

export function nextEliminacaoRound(prev) {
  return { ...prev, phase: 'quiz', removedOptions: [] };
}

// ─── Corrida ─────────────────────────────────────────────────────────────────

export function answerCorrida(prev, isCorrect, now = Date.now()) {
  const turn = advanceCorridaTeam(prev);
  const afterTurn = rotateResponder(prev.teams, turn.currentTeamIndex);

  if (!isCorrect) {
    return {
      ...prev, ...nextPool(prev), ...turn,
      teams: afterTurn.teams,
      currentResponderId: afterTurn.currentResponderId,
      studentStats: creditResponder(prev, false),
      phase: 'quiz', questionStartTime: now,
    };
  }

  const elapsed = (now - (prev.questionStartTime || now)) / 1000;
  const advance = elapsed < 10 ? 3 : elapsed < 20 ? 2 : 1;
  const boardPositions = [...prev.boardPositions];
  boardPositions[prev.currentTeamIndex] = Math.min(
    CORRIDA_FINISH, (boardPositions[prev.currentTeamIndex] || 0) + advance
  );
  const newPos = boardPositions[prev.currentTeamIndex];
  const studentStats = creditResponder(prev, true, advance);

  // O jogo declarava vitoria em pos >= 30, uma casa que nao existe: quem
  // chegava na bandeira (29) nao ganhava.
  if (newPos >= CORRIDA_FINISH) {
    return {
      ...prev, boardPositions, studentStats,
      teams: withTeamScore(prev.teams, prev.currentTeamIndex, () => 100),
      status: 'finished',
    };
  }

  const special = (prev.specialSquares || []).find((s) => s.index === newPos);
  if (special) {
    return { ...prev, boardPositions, studentStats, phase: 'special_event', currentSpecial: special };
  }

  return {
    ...prev, ...nextPool(prev), ...turn, boardPositions, studentStats,
    teams: afterTurn.teams,
    currentResponderId: afterTurn.currentResponderId,
    phase: 'quiz', questionStartTime: now,
  };
}

export function resolveSpecial(prev, now = Date.now()) {
  const special = prev.currentSpecial;
  const boardPositions = [...prev.boardPositions];
  const i = prev.currentTeamIndex;

  if (special?.type === 'star') boardPositions[i] = Math.min(CORRIDA_FINISH, boardPositions[i] + 2);
  if (special?.type === 'trap') boardPositions[i] = Math.max(0, boardPositions[i] - 2);

  // "Desafio Bonus": a mesma equipe responde outra pergunta. Este tipo nao
  // tinha tratamento nenhum e a casa ficava sem efeito.
  if (special?.type === 'bonus_question') {
    return {
      ...prev, ...nextPool(prev), boardPositions,
      phase: 'quiz', currentSpecial: null, questionStartTime: now,
    };
  }

  const turn = advanceCorridaTeam(prev, special?.type === 'stop' ? i : undefined);
  const afterTurn = rotateResponder(prev.teams, turn.currentTeamIndex);
  return {
    ...prev, ...nextPool(prev), ...turn, boardPositions,
    teams: afterTurn.teams,
    currentResponderId: afterTurn.currentResponderId,
    phase: 'quiz', currentSpecial: null, questionStartTime: now,
  };
}

// ─── Bomba ───────────────────────────────────────────────────────────────────

export function answerBomba(prev, isCorrect) {
  // No erro o retorno era { ...prev, phase: 'question' }, que nao mudava nada:
  // o key de GameScreen continuava igual, a tela nao remontava, selectedIdx
  // seguia preenchido e todos os botoes ficavam disabled. Avancar a pergunta
  // nos dois casos resolve.
  const base = { ...prev, ...nextPool(prev), phase: 'question' };
  if (!isCorrect) return base;
  return { ...base, bombTeamIndex: (prev.bombTeamIndex + 1) % prev.teams.length };
}

export function explodeBomba(prev, now = Date.now()) {
  return {
    ...prev, ...nextPool(prev),
    teams: withTeamScore(prev.teams, prev.bombTeamIndex, (s) => Math.max(0, s - 5)),
    phase: 'explosion',
    bombDuration: randomBombDuration(),
    bombStartTime: now,
  };
}

export function nextBombaRound(prev, now = Date.now()) {
  return {
    ...prev,
    bombTeamIndex: (prev.bombTeamIndex + 1) % prev.teams.length,
    phase: 'question',
    bombStartTime: now,
  };
}

// ─── Duelo ───────────────────────────────────────────────────────────────────

export function buzzDuelo(prev, teamIdx) {
  if (prev.duelBuzzedTeam !== null) return prev;
  return { ...prev, duelBuzzedTeam: teamIdx, phase: 'answering' };
}

export function answerDuelo(prev, teamIdx, isCorrect) {
  if (!isCorrect) {
    return {
      ...prev,
      teams: withTeamScore(prev.teams, teamIdx, (s) => Math.max(0, s - 5)),
      duelBuzzedTeam: null, phase: 'steal', stealFromTeam: teamIdx,
    };
  }

  const teams = withTeamScore(prev.teams, teamIdx, (s) => s + 10);
  if (teams[teamIdx].score >= prev.winGoal) {
    return { ...prev, teams, status: 'finished' };
  }
  return {
    ...prev, ...nextPool(prev), teams,
    duelBuzzedTeam: null, phase: 'waiting_buzz',
    currentDuelPairIdx: nextDuelPair(prev),
  };
}

export function stealDuelo(prev, stealTeamIdx, isCorrect) {
  const teams = isCorrect
    ? withTeamScore(prev.teams, stealTeamIdx, (s) => s + 7)
    : prev.teams;

  // O teste de vitoria ficava FORA do if: um roubo ERRADO podia encerrar o jogo.
  if (isCorrect && teams[stealTeamIdx].score >= prev.winGoal) {
    return { ...prev, teams, status: 'finished' };
  }
  return {
    ...prev, ...nextPool(prev), teams,
    phase: 'waiting_buzz', duelBuzzedTeam: null, stealFromTeam: null,
    currentDuelPairIdx: nextDuelPair(prev),
  };
}

// ─── Cassino ─────────────────────────────────────────────────────────────────

function spinReels(emojis, isWin, rng) {
  if (isWin) {
    const winEmoji = emojis[Math.floor(rng() * emojis.length)];
    return [winEmoji, winEmoji, winEmoji];
  }
  const reels = [
    emojis[Math.floor(rng() * emojis.length)],
    emojis[Math.floor(rng() * emojis.length)],
    emojis[Math.floor(rng() * emojis.length)],
  ];
  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    reels[2] = emojis[(emojis.indexOf(reels[2]) + 1) % emojis.length];
  }
  return reels;
}

export function spinCassino(prev, odds, rng = Math.random) {
  const currentTeam = prev.teams[prev.currentTeamIndex];
  if (!currentTeam || currentTeam.score < prev.spinCost) return prev;

  const cost = prev.spinCost;
  const isWin = rng() * 100 < (odds?.cassino ?? 20);
  const prize = isWin ? cost * 2.5 : 0;

  return {
    ...prev,
    teams: withTeamScore(prev.teams, prev.currentTeamIndex, () => currentTeam.score - cost + prize),
    // A Casa fica com as perdas e paga os premios.
    houseBalance: (prev.houseBalance || 0) + cost - prize,
    lastSpinResult: {
      emojis: spinReels(['🍎', '🍌', '🍉'], isWin, rng),
      isWin, prize, teamId: currentTeam.id,
    },
    currentTeamIndex: (prev.currentTeamIndex + 1) % prev.teams.length,
    phase: 'spin_result',
  };
}

export function spinCassinoInstitucional(prev, odds, rng = Math.random) {
  const currentTeam = prev.teams[prev.currentTeamIndex];
  if (!currentTeam || currentTeam.score < prev.spinCost) return prev;

  const cost = prev.spinCost;
  const isWin = rng() * 100 < (odds?.cassino_inst ?? 20);
  const prize = isWin ? cost * 2.5 : 0;

  const team = { ...currentTeam, score: currentTeam.score - cost + prize };
  const prevStreak = currentTeam.instStreak || 0;
  const prevCandies = currentTeam.candies || 0;
  let candyAwarded = false;
  let candyReturned = false;

  // A cada 2 vitorias seguidas ganha 1 bombom; ao perder, devolve 1 se tiver.
  if (isWin) {
    const newStreak = prevStreak + 1;
    if (newStreak % 2 === 0) {
      team.candies = prevCandies + 1;
      team.instStreak = 0;
      candyAwarded = true;
    } else {
      team.instStreak = newStreak;
    }
  } else {
    team.instStreak = 0;
    if (prevCandies > 0) {
      team.candies = prevCandies - 1;
      candyReturned = true;
    }
  }

  return {
    ...prev,
    teams: prev.teams.map((t, i) => (i === prev.currentTeamIndex ? team : t)),
    houseBalance: (prev.houseBalance || 0) + cost - prize,
    lastSpinResult: {
      emojis: spinReels(['⛑️', '🔧', '🚛', '🦺'], isWin, rng),
      isWin, prize, teamId: currentTeam.id, candyAwarded, candyReturned,
    },
    currentTeamIndex: (prev.currentTeamIndex + 1) % prev.teams.length,
    phase: 'spin_result',
  };
}

export function nextCassinoTurn(prev) {
  return { ...prev, phase: 'quiz', lastSpinResult: null };
}
