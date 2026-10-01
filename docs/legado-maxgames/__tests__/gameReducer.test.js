import { describe, it, expect } from 'vitest';
import * as R from '../gameReducer.js';

const QUESTIONS = Array.from({ length: 6 }, (_, i) => ({
  id: `q${i + 1}`,
  q: `Pergunta ${i + 1}?`,
  options: ['A) um', 'B) dois', 'C) tres', 'D) quatro'],
  correct: 1,
  word: 'SEGURANCA',
}));

const TEAMS = [{ name: 'Alfa' }, { name: 'Beta' }, { name: 'Gama' }];

function start(overrides = {}) {
  const { mode = 'cacapalavras', teams = TEAMS, activeGame = null } = overrides;
  return R.createInitialState({
    teams, mode, questions: QUESTIONS, activeGame,
    gameId: 'jogo-1', classId: 'turma-1', now: 1_000_000,
  });
}

describe('createInitialState', () => {
  it('começa jogando, na primeira equipe, com o pool completo', () => {
    const s = start();
    expect(s.status).toBe('playing');
    expect(s.currentTeamIndex).toBe(0);
    expect(s.teams).toHaveLength(3);
    expect(s.allQuestionIds).toHaveLength(6);
    expect(s.currentQuestionId).toBe(s.poolIds[0]);
  });

  it('modos de aposta começam com saldo', () => {
    expect(start({ mode: 'cassino' }).teams[0].score).toBe(500);
    expect(start().teams[0].score).toBe(0);
  });

  it('targetScore inválido não vira Infinity nem meta zero', () => {
    // Um id de jogo velho apontando para um jogo sem perguntas dava Infinity e
    // vitoria instantanea; targetScore 0 encerrava na primeira pontuacao.
    const s = start({ activeGame: { targetScore: 0, scoreType: 'total', questions: [] } });
    expect(Number.isFinite(s.scorePerQ)).toBe(true);
    expect(s.winGoal).toBeGreaterThan(0);
  });

  it('per_question usa uma meta alcançável com o rodízio de turnos', () => {
    // Antes era questions.length * targetScore: como o turno gira entre as
    // equipes, nenhuma respondia todas e o jogo nunca terminava.
    const s = start({ activeGame: { targetScore: 10, scoreType: 'per_question' } });
    expect(s.winGoal).toBe(Math.ceil(6 / 3) * 10);
  });

  it('duelo gera duplas como objetos, não arrays aninhados', () => {
    // O Firestore rejeita array aninhado e o estado do Duelo nunca persistia.
    const s = start({ mode: 'duelo' });
    expect(s.dueloPairs.length).toBeGreaterThan(0);
    for (const pair of s.dueloPairs) {
      expect(Array.isArray(pair)).toBe(false);
      expect(pair).toHaveProperty('a');
      expect(pair).toHaveProperty('b');
    }
  });

  it('corrida nunca põe casa especial na bandeira', () => {
    for (let i = 0; i < 30; i++) {
      for (const sq of start({ mode: 'corrida' }).specialSquares) {
        expect(sq.index).toBeLessThan(R.CORRIDA_FINISH);
        expect(sq.index).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('nextTurn', () => {
  it('gira as equipes em rodízio e avança a pergunta', () => {
    let s = start();
    const first = s.currentQuestionId;
    s = R.nextTurn(s);
    expect(s.currentTeamIndex).toBe(1);
    expect(s.currentQuestionId).not.toBe(first);
    s = R.nextTurn(s);
    s = R.nextTurn(s);
    expect(s.currentTeamIndex).toBe(0);
  });

  it('reinicia as ajudas a cada equipe', () => {
    // As ajudas eram globais: a equipe 1 gastava as tres e as demais jogavam
    // a partida inteira sem nenhuma.
    let s = start({ mode: 'eliminacao' });
    s = R.activateLifeline(s, 'skip', QUESTIONS[0]);
    expect(s.lifelines.skip).toBe(false);
    s = R.nextTurn(s);
    expect(s.lifelines).toEqual({ fiftyfifty: true, skip: true, askTeam: true });
  });

  it('não faz nada com a partida encerrada', () => {
    const s = { ...start(), status: 'finished' };
    expect(R.nextTurn(s)).toBe(s);
  });

  it('reembaralha quando o pool acaba', () => {
    let s = start();
    for (let i = 0; i < 10; i++) s = R.nextTurn(s);
    expect(s.poolIds.length).toBeGreaterThan(0);
    expect(s.currentQuestionId).toBeTruthy();
  });
});

describe('pontuação e imutabilidade', () => {
  it('não muta o estado anterior ao pontuar', () => {
    // A copia rasa de teams seguida de teams[i].score += x mutava prev, e sob
    // StrictMode o updater roda duas vezes: pontuacao dobrada.
    const s = start();
    const before = s.teams[0].score;
    R.completeWordSearch(s, 30);
    R.completeWordSearch(s, 30);
    expect(s.teams[0].score).toBe(before);
  });

  it('aplicar a mesma transição duas vezes sobre o mesmo estado dá o mesmo resultado', () => {
    const s = start();
    expect(R.completeWordSearch(s, 30).teams[0].score)
      .toBe(R.completeWordSearch(s, 30).teams[0].score);
  });

  it('caça-palavras dá pontuação inteira e no mínimo 1', () => {
    const s = { ...start(), scorePerQ: 1.3 };
    const fast = R.completeWordSearch(s, 30);
    const slow = R.completeWordSearch(s, 5);
    expect(Number.isInteger(fast.teams[0].score)).toBe(true);
    expect(Number.isInteger(slow.teams[0].score)).toBe(true);
    expect(slow.teams[0].score).toBeGreaterThanOrEqual(1);
  });

  it('encerra a partida ao bater a meta', () => {
    const s = { ...start(), scorePerQ: 100, winGoal: 50 };
    expect(R.completeWordSearch(s, 30).status).toBe('finished');
  });
});

describe('Forca', () => {
  const word = { ...QUESTIONS[0], word: 'SOL' };

  it('ignora letra repetida e acumula erros', () => {
    let s = { ...start({ mode: 'forca' }), phase: 'forca' };
    s = R.guessForcaLetter(s, 'X', word);
    expect(s.forcaWrong).toEqual(['X']);
    expect(R.guessForcaLetter(s, 'X', word).forcaWrong).toEqual(['X']);
  });

  it('passa a vez depois de 6 erros', () => {
    let s = { ...start({ mode: 'forca' }), phase: 'forca' };
    for (const l of ['B', 'C', 'D', 'F', 'G', 'H']) s = R.guessForcaLetter(s, l, word);
    expect(s.phase).toBe('turn_transition');
  });

  it('pontua com número inteiro ao completar a palavra', () => {
    // O commit que arredondou a pontuacao deixou a Forca de fora e ela ainda
    // gerava placares como "1.3".
    let s = { ...start({ mode: 'forca' }), phase: 'forca', scorePerQ: 10 };
    s = R.guessForcaLetter(s, 'Z', word);
    s = R.guessForcaLetter(s, 'Y', word);
    s = R.guessForcaLetter(s, 'W', word);
    for (const l of ['S', 'O', 'L']) s = R.guessForcaLetter(s, l, word);
    expect(Number.isInteger(s.teams[0].score)).toBe(true);
    expect(s.phase).toBe('turn_transition');
  });

  it('pergunta sem palavra não derruba a rodada', () => {
    const s = { ...start({ mode: 'forca' }), phase: 'forca' };
    expect(R.guessForcaLetter(s, 'A', { ...QUESTIONS[0], word: '' })).toBe(s);
    expect(R.guessForcaLetter(s, 'A', undefined)).toBe(s);
  });
});

describe('Bomba', () => {
  it('avança a pergunta mesmo quando a equipe erra', () => {
    // No erro o estado voltava idêntico: o key de GameScreen nao mudava, a tela
    // nao remontava e todos os botoes ficavam desabilitados para sempre.
    const s = start({ mode: 'bomba' });
    const after = R.answerBomba(s, false);
    expect(after.currentQuestionId).not.toBe(s.currentQuestionId);
    expect(after).not.toBe(s);
  });

  it('acerto passa a bomba para a próxima equipe', () => {
    const s = start({ mode: 'bomba' });
    expect(R.answerBomba(s, true).bombTeamIndex).toBe(1);
    expect(R.answerBomba(s, false).bombTeamIndex).toBe(0);
  });

  it('explosão tira 5 pontos sem deixar negativo', () => {
    const s = { ...start({ mode: 'bomba' }), teams: [{ id: 0, name: 'A', score: 2 }] };
    expect(R.explodeBomba(s).teams[0].score).toBe(0);
  });
});

describe('Duelo', () => {
  it('alterna a dupla a cada rodada', () => {
    // currentDuelPairIdx era fixado em 0 e nunca incrementado: com 3 equipes
    // so a primeira dupla jogava e as demais nunca pontuavam.
    let s = start({ mode: 'duelo' });
    const total = s.dueloPairs.length;
    expect(total).toBe(3);
    const seen = new Set([s.currentDuelPairIdx]);
    for (let i = 0; i < total; i++) {
      s = R.answerDuelo(s, 0, true);
      seen.add(s.currentDuelPairIdx);
    }
    expect(seen.size).toBe(total);
  });

  it('roubo errado não encerra a partida', () => {
    // O teste de vitoria estava FORA do if (isCorrect).
    const s = { ...start({ mode: 'duelo' }), winGoal: 1, phase: 'steal' };
    expect(R.stealDuelo(s, 0, false).status).toBe('playing');
    expect(R.stealDuelo(s, 0, true).status).toBe('finished');
  });

  it('erro manda para a fase de roubo e desconta', () => {
    const s = { ...start({ mode: 'duelo' }), teams: [{ id: 0, name: 'A', score: 3 }] };
    const after = R.answerDuelo(s, 0, false);
    expect(after.phase).toBe('steal');
    expect(after.stealFromTeam).toBe(0);
    expect(after.teams[0].score).toBe(0);
  });

  it('ignora buzz duplo', () => {
    const s = R.buzzDuelo(start({ mode: 'duelo' }), 1);
    expect(R.buzzDuelo(s, 2)).toBe(s);
  });
});

describe('Corrida', () => {
  const base = () => ({ ...start({ mode: 'corrida' }), specialSquares: [] });

  it('vence ao chegar na bandeira desenhada no tabuleiro', () => {
    // Vencia so em pos >= 30, uma casa que o BoardGame nao desenha: quem
    // chegava na bandeira (29) nao ganhava.
    const s = { ...base(), boardPositions: [R.CORRIDA_FINISH - 1, 0, 0] };
    const after = R.answerCorrida(s, true, s.questionStartTime + 1000);
    expect(after.status).toBe('finished');
    expect(after.boardPositions[0]).toBe(R.CORRIDA_FINISH);
  });

  it('a casa PARE pula a equipe que caiu nela, não a seguinte', () => {
    const s = {
      ...base(),
      currentTeamIndex: 0,
      currentSpecial: { index: 5, type: 'stop' },
    };
    const after = R.resolveSpecial(s);
    expect(after.currentTeamIndex).toBe(1);
    expect(after.pendingSkipTeam).toBe(0);

    // A ordem e 0 -> 1 -> 2 -> (0 punida, pulada) -> 1
    const t2 = R.answerCorrida(after, false, after.questionStartTime + 1000);
    expect(t2.currentTeamIndex).toBe(2);
    expect(t2.pendingSkipTeam).toBe(0);

    const t3 = R.answerCorrida(t2, false, t2.questionStartTime + 1000);
    expect(t3.currentTeamIndex).toBe(1);
    expect(t3.pendingSkipTeam).toBe(null);
  });

  it('o desafio bônus mantém a mesma equipe', () => {
    const s = { ...base(), currentTeamIndex: 1, currentSpecial: { index: 5, type: 'bonus_question' } };
    const after = R.resolveSpecial(s);
    expect(after.currentTeamIndex).toBe(1);
    expect(after.currentSpecial).toBe(null);
  });

  it('responder rápido avança mais casas', () => {
    const s = base();
    const fast = R.answerCorrida(s, true, s.questionStartTime + 5000);
    const slow = R.answerCorrida(s, true, s.questionStartTime + 25000);
    expect(fast.boardPositions[0]).toBe(3);
    expect(slow.boardPositions[0]).toBe(1);
  });
});

describe('Cassino', () => {
  const bet = () => start({ mode: 'cassino' });

  it('não gira sem saldo', () => {
    const s = { ...bet(), teams: [{ id: 0, name: 'A', score: 10 }], spinCost: 50 };
    expect(R.spinCassino(s, { cassino: 100 })).toBe(s);
  });

  it('vitória paga 2.5x e a casa fica no prejuízo', () => {
    const s = bet();
    const after = R.spinCassino(s, { cassino: 100 }, () => 0);
    expect(after.teams[0].score).toBe(500 - 50 + 125);
    expect(after.houseBalance).toBe(50 - 125);
    expect(after.lastSpinResult.teamId).toBe(0);
    expect(new Set(after.lastSpinResult.emojis).size).toBe(1);
  });

  it('derrota nunca mostra três iguais', () => {
    const after = R.spinCassino(bet(), { cassino: 0 }, () => 0.99);
    expect(after.lastSpinResult.isWin).toBe(false);
    expect(new Set(after.lastSpinResult.emojis).size).toBeGreaterThan(1);
  });

  it('institucional dá um bombom a cada 2 vitórias seguidas', () => {
    let s = start({ mode: 'cassino_inst' });
    s = R.spinCassinoInstitucional(s, { cassino_inst: 100 }, () => 0);
    expect(s.teams[0].candies).toBe(0);
    expect(s.teams[0].instStreak).toBe(1);

    s = { ...s, currentTeamIndex: 0 };
    s = R.spinCassinoInstitucional(s, { cassino_inst: 100 }, () => 0);
    expect(s.teams[0].candies).toBe(1);
    expect(s.lastSpinResult.candyAwarded).toBe(true);
  });
});

describe('Eliminação', () => {
  const elim = () => start({ mode: 'eliminacao' });

  it('sobe de nível a cada acerto e acumula', () => {
    let s = elim();
    s = R.answerEliminacao(s, true);
    expect(s.eliminacaoLevel).toBe(1);
    expect(s.roundAccumulated).toBe(R.ELIMINACAO_POINTS[0]);
    s = R.answerEliminacao(s, true);
    expect(s.roundAccumulated).toBe(R.ELIMINACAO_POINTS[0] + R.ELIMINACAO_POINTS[1]);
  });

  it('o painel do último nível mostra os valores da rodada, não os zerados', () => {
    // level e roundAccumulated eram zerados no MESMO update que abria o
    // 'reveal', entao o painel exibia "+2 pts" e "Acumulado: 0".
    let s = elim();
    for (let i = 0; i < 4; i++) s = R.answerEliminacao(s, true);
    const total = R.ELIMINACAO_POINTS.reduce((a, b) => a + b, 0);
    s = R.answerEliminacao(s, true);

    expect(s.revealEarned).toBe(R.ELIMINACAO_POINTS[4]);
    expect(s.revealAccumulated).toBe(total);
    expect(s.revealRoundOver).toBe(true);
    expect(s.eliminacaoLevel).toBe(0);
    expect(s.currentTeamIndex).toBe(1);
  });

  it('erro elimina e passa a vez', () => {
    let s = R.answerEliminacao(elim(), true);
    s = R.answerEliminacao(s, false);
    expect(s.phase).toBe('eliminated');
    expect(s.eliminacaoLevel).toBe(0);
    expect(s.currentTeamIndex).toBe(1);
  });

  it('50/50 remove duas alternativas erradas', () => {
    const s = R.activateLifeline(elim(), 'fiftyfifty', QUESTIONS[0]);
    expect(s.removedOptions).toHaveLength(2);
    expect(s.removedOptions).not.toContain(QUESTIONS[0].correct);
    expect(s.lifelines.fiftyfifty).toBe(false);
  });

  it('ajuda já usada não faz nada', () => {
    const s = R.activateLifeline(elim(), 'skip', QUESTIONS[0]);
    expect(R.activateLifeline(s, 'skip', QUESTIONS[0])).toBe(s);
  });
});

describe('Quiz por Tempo', () => {
  const qt = () => start({ mode: 'quiz_tempo' });

  it('pontua conforme a ordem do buzzer', () => {
    let s = qt();
    s = R.buzzTeam(s, 2);
    expect(R.answerQuizTempo(s, 2, true).teams[2].score).toBe(10);

    s = R.buzzTeam({ ...s, buzzedTeamIdx: null }, 0);
    expect(R.answerQuizTempo(s, 0, true).teams[0].score).toBe(5);
  });

  it('erro desconta sem deixar negativo e devolve o buzzer', () => {
    let s = R.buzzTeam(qt(), 1);
    s = R.answerQuizTempo(s, 1, false);
    expect(s.teams[1].score).toBe(0);
    expect(s.phase).toBe('question');
    expect(s.buzzedTeamIdx).toBe(null);
  });

  it('ignora buzz duplo', () => {
    const s = R.buzzTeam(qt(), 0);
    expect(R.buzzTeam(s, 1)).toBe(s);
  });
});

describe('Respondente da vez (relatório por aluno)', () => {
  const withStudents = () => R.createInitialState({
    teams: [
      { name: 'Alfa', memberIds: ['a1', 'a2'] },
      { name: 'Beta', memberIds: ['b1'] },
    ],
    mode: 'cacapalavras', questions: QUESTIONS, activeGame: null,
    gameId: 'g', classId: 'c', now: 1,
  });

  it('turma sem alunos continua funcionando só por equipe', () => {
    const s = start();
    expect(s.currentResponderId).toBe(null);
    expect(R.completeWordSearch(s, 30).studentStats).toEqual({});
  });

  it('faz rodízio entre os membros da equipe', () => {
    let s = withStudents();
    expect(s.currentResponderId).toBe('a1');
    s = R.nextTurn(s);
    expect(s.currentResponderId).toBe('b1');
    s = R.nextTurn(s);
    expect(s.currentResponderId).toBe('a2');
  });

  it('credita acerto e erro ao respondente', () => {
    let s = withStudents();
    s = R.completeWordSearch(s, 30);
    expect(s.studentStats.a1.correct).toBe(1);
    expect(s.studentStats.a1.points).toBeGreaterThan(0);

    s = R.failWordSearch(s);
    expect(s.studentStats.a1.wrong).toBe(1);
  });

  it('permite trocar o respondente manualmente', () => {
    const s = R.setResponder(withStudents(), 'a2');
    expect(s.currentResponderId).toBe('a2');
    // Aluno de outra equipe e ignorado
    expect(R.setResponder(s, 'b1')).toBe(s);
  });
});
