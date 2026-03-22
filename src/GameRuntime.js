// GameRuntime.js — Supports NeuronRush, QuestPath, MirrorMatch
import MessageBus from './MessageBus.js';

const GameRuntime = {
  state: {
    status: 'idle', config: null, mode: null,
    questions: [], currentIndex: 0,
    score: 0, lives: 3, streak: 0, totalQuestions: 0,
  },

  init() {
    MessageBus.on('game:begin',     d  => this.setup(d.mode || 'NeuronRush'));
    MessageBus.on('answer:submit',  d  => this.handleAnswer(d));
    MessageBus.on('match:complete', d  => this.handleMatch(d));
    MessageBus.on('game:restart',   ()  => this.setup(this.state.mode));
  },

  setup(mode) {
    // Always grab latest config from window (updated by subject selector)
    const config = window._sagaConfig;
    if (!config) {
      console.error('[GameRuntime] No config found!');
      return;
    }

    const questions = mode === 'QuestPath'
      ? config.content.nodes
      : config.content.questions;

    if (!questions || questions.length === 0) {
      console.error('[GameRuntime] No questions found for mode:', mode);
      return;
    }

    Object.assign(this.state, {
      config, mode, status: 'playing',
      questions,
      totalQuestions: questions.length,
      lives:  config.mechanics.lives || 3,
      score:  0, currentIndex: 0, streak: 0,
    });

    if (mode === 'MirrorMatch') {
      MessageBus.emit('mirror:start', {
        pairs: config.content.pairs,
        config,
      });
      return;
    }

    MessageBus.emit('game:start', {
      state: { ...this.state },
      question: this.current(),
      mode,
    });
  },

  current() { return this.state.questions[this.state.currentIndex]; },

  handleAnswer({ answer, optionIndex }) {
    const q            = this.current();
    const isCorrect    = answer === q.answer;
    const correctIndex = q.options.indexOf(q.answer);
    const pts          = q.points || 10;
    const multi        = this.state.config.mechanics.scoreMultiplier || 1;

    MessageBus.emit('option:highlight', { chosenIndex: optionIndex, correctIndex, isCorrect });

    if (isCorrect) {
      this.state.streak++;
      const bonus = (this.state.config.mechanics.streakBonus && this.state.streak > 2)
        ? Math.round(pts * multi) : pts;
      this.state.score += bonus;
      MessageBus.emit('answer:correct', {
        pts: bonus, streak: this.state.streak, score: this.state.score
      });
    } else {
      this.state.streak = 0;
      this.state.lives--;
      MessageBus.emit('answer:wrong', {
        correctAnswer: q.answer, lives: this.state.lives,
        timeout: answer === '__timeout__'
      });
      if (this.state.lives <= 0) {
        setTimeout(() => this.end('no_lives'), 1600); return;
      }
    }

    this.state.currentIndex++;
    if (this.state.currentIndex >= this.state.totalQuestions) {
      setTimeout(() => this.end('completed'), 1600); return;
    }
    setTimeout(() => {
      MessageBus.emit('question:next', {
        question:       this.current(),
        questionNumber: this.state.currentIndex + 1,
        totalQuestions: this.state.totalQuestions,
        score:          this.state.score,
        lives:          this.state.lives,
        streak:         this.state.streak,
        mode:           this.state.mode,
      });
    }, 1600);
  },

  handleMatch({ score }) {
    this.state.score = score;
    setTimeout(() => this.end('completed'), 500);
  },

  end(reason) {
    this.state.status = 'ended';
    MessageBus.emit('game:end', {
      reason, score: this.state.score,
      totalQuestions: this.state.totalQuestions,
      questionsAnswered: this.state.currentIndex,
      mode: this.state.mode,
    });
  }
};

export default GameRuntime;
    });
  }
};

export default GameRuntime;
