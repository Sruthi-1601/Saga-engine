// GameRuntime.js — Game State Machine

import MessageBus from './MessageBus.js';

const GameRuntime = {

  state: {
    status: 'idle',
    config: null,
    questions: [],
    currentIndex: 0,
    score: 0,
    lives: 3,
    streak: 0,
    totalQuestions: 0,
    mode: null,
  },

  init() {
    MessageBus.on('config:loaded', (config) => this.storeConfig(config));
    MessageBus.on('game:begin',    ()        => this.setup(this.state.config));
    MessageBus.on('answer:submit', (data)    => this.handleAnswer(data));
    MessageBus.on('game:restart',  ()        => this.setup(this.state.config));
  },

  storeConfig(config) {
    this.state.config = config;
  },

  setup(config) {
    this.state.config         = config;
    this.state.questions      = config.content.questions;
    this.state.totalQuestions = config.content.questions.length;
    this.state.lives          = config.mechanics.lives || 3;
    this.state.mode           = config.mode;
    this.state.status         = 'playing';
    this.state.score          = 0;
    this.state.currentIndex   = 0;
    this.state.streak         = 0;

    MessageBus.emit('game:start', {
      state: { ...this.state },
      question: this.current()
    });
  },

  current() {
    return this.state.questions[this.state.currentIndex];
  },

  handleAnswer(data) {
    const { answer, optionIndex } = data;
    const q            = this.current();
    const isCorrect    = answer === q.answer;
    const correctIndex = q.options.indexOf(q.answer);
    const pts          = q.points || 10;
    const multi        = this.state.config.mechanics.scoreMultiplier || 1;

    // Tell renderer which option to highlight + which is correct
    MessageBus.emit('option:highlight', {
      chosenIndex:  optionIndex,
      correctIndex: correctIndex,
      isCorrect:    isCorrect
    });

    if (isCorrect) {
      this.state.streak++;
      const bonus = (this.state.config.mechanics.streakBonus && this.state.streak > 2)
        ? Math.round(pts * multi)
        : pts;
      this.state.score += bonus;

      MessageBus.emit('answer:correct', {
        pts:    bonus,
        streak: this.state.streak,
        score:  this.state.score
      });

    } else {
      this.state.streak = 0;
      this.state.lives--;

      MessageBus.emit('answer:wrong', {
        correctAnswer: q.answer,
        lives:         this.state.lives,
        timeout:       answer === '__timeout__'
      });

      if (this.state.lives <= 0) {
        setTimeout(() => this.endGame('no_lives'), 1600);
        return;
      }
    }

    this.state.currentIndex++;

    if (this.state.currentIndex >= this.state.totalQuestions) {
      setTimeout(() => this.endGame('completed'), 1600);
      return;
    }

    setTimeout(() => {
      MessageBus.emit('question:next', {
        question:       this.current(),
        questionNumber: this.state.currentIndex + 1,
        totalQuestions: this.state.totalQuestions,
        score:          this.state.score,
        lives:          this.state.lives,
        streak:         this.state.streak
      });
    }, 1600);
  },

  endGame(reason) {
    this.state.status = 'ended';
    MessageBus.emit('game:end', {
      reason,
      score:             this.state.score,
      totalQuestions:    this.state.totalQuestions,
      questionsAnswered: this.state.currentIndex
    });
  }
};

export default GameRuntime;