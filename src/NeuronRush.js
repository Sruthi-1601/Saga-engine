// NeuronRush.js — Game Renderer

import MessageBus from './MessageBus.js';

const NeuronRush = {

  timerInterval: null,
  timeLeft: 30,
  timerDuration: 30,
  configData: null,

  init() {
    MessageBus.on('config:loaded',    (d) => this.onConfigLoaded(d));
    MessageBus.on('game:start',       (d) => this.onStart(d));
    MessageBus.on('question:next',    (d) => this.onNext(d));
    MessageBus.on('answer:correct',   (d) => this.onCorrect(d));
    MessageBus.on('answer:wrong',     (d) => this.onWrong(d));
    MessageBus.on('option:highlight', (d) => this.highlightOptions(d));
    MessageBus.on('game:end',         (d) => this.onEnd(d));
    MessageBus.on('config:error',     (d) => this.onError(d));
  },

  onConfigLoaded(config) {
    this.configData = config;
    this.renderHome(config);
  },

  onStart(data) {
    const { state, question } = data;
    this.timerDuration = question.timeLimit || state.config?.mechanics?.timerSeconds || 30;
    this.renderGame(state, question);
  },

  onNext(data) {
    const { question, questionNumber, totalQuestions, score, lives, streak } = data;
    this.timerDuration = question.timeLimit || 30;
    this.updateTopBar(score, lives, streak);
    this.updateProgress(questionNumber, totalQuestions);
    this.updateQuestion(question, questionNumber);
    this.clearFeedback();
    this.startTimer();
  },

  onCorrect(data) {
    this.stopTimer();
    const msg = data.streak > 2
      ? `Correct! +${data.pts} pts (streak x${data.streak})`
      : `Correct! +${data.pts} pts`;
    this.setFeedback(msg, 'correct');
  },

  onWrong(data) {
    this.stopTimer();
    const msg = data.timeout
      ? `Time's up! The answer was: ${data.correctAnswer}`
      : `Incorrect. The answer was: ${data.correctAnswer}`;
    this.setFeedback(msg, 'wrong');
  },

  onEnd(data) {
    this.stopTimer();
    this.renderEndScreen(data);
  },

  onError(data) {
    document.getElementById('app').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;
                  min-height:60vh;flex-direction:column;gap:12px;">
        <p style="font-size:15px;color:#d85a30;">Config error</p>
        <p style="font-size:13px;color:#6b6b68;">${data.message}</p>
      </div>`;
  },

  // ── HOME SCREEN ──────────────────────────────

  renderHome(config) {
    const { title, subject, grade, author } = config.metadata;
    document.getElementById('app').innerHTML = `
      <div class="home-wrap">
        <div class="home-header">
          <div class="home-eyebrow">SAGA Engine &middot; TaPTaP 2026</div>
          <div class="home-title">Select a <span>game mode</span></div>
          <div class="home-sub">${title} &middot; ${subject} &middot; Grade ${grade}</div>
        </div>

        <div class="subject-row">
          <span class="subject-chip">${config.content.questions.length} questions</span>
          <span class="subject-chip">Lives: ${config.mechanics.lives}</span>
          <span class="subject-chip">Adaptive difficulty</span>
          <span class="subject-chip">Streak bonus</span>
        </div>

        <div class="modes-label">Available modes</div>
        <div class="modes-grid">
          <button class="mode-card" onclick="window.sagaStartGame()">
            <div class="mode-icon">⚡</div>
            <div class="mode-info">
              <div class="mode-name">NeuronRush</div>
              <div class="mode-desc">Rapid-fire timed Q&amp;A — beat the clock, build your streak</div>
            </div>
            <span class="mode-badge badge-ready">Ready</span>
          </button>
          <button class="mode-card locked" onclick="window.sagaSelectMode('QuestPath')">
            <div class="mode-icon">🗺️</div>
            <div class="mode-info">
              <div class="mode-name">QuestPath</div>
              <div class="mode-desc">Story map — answer to unlock the next chapter node</div>
            </div>
            <span class="mode-badge badge-soon">Mar 21</span>
          </button>
          <button class="mode-card locked" onclick="window.sagaSelectMode('MirrorMatch')">
            <div class="mode-icon">🃏</div>
            <div class="mode-info">
              <div class="mode-name">MirrorMatch</div>
              <div class="mode-desc">Flip cards and match terms with definitions</div>
            </div>
            <span class="mode-badge badge-soon">Mar 21</span>
          </button>
        </div>

        <button class="start-btn" onclick="window.sagaStartGame()">
          Start NeuronRush
        </button>
        <div class="home-footer">Built by ${author} &middot; Powered by SAGA Engine</div>
      </div>`;
  },

  // ── GAME SCREEN ──────────────────────────────

  renderGame(state, question) {
    const qNum  = state.currentIndex + 1;
    const total = state.totalQuestions;

    document.getElementById('app').innerHTML = `
      <div class="game-wrap">

        <div class="top-bar">
          <div>
            <div class="game-title">${state.config.metadata.title}</div>
            <div class="game-meta">
              ${state.config.metadata.subject} &middot;
              Grade ${state.config.metadata.grade} &middot;
              NeuronRush
            </div>
          </div>
          <div class="stats-row">
            <span class="stat-chip" id="chip-score">${state.score} pts</span>
            <span class="stat-chip" id="chip-lives">${state.lives} ${state.lives === 1 ? 'life' : 'lives'}</span>
            <span class="stat-chip" id="chip-streak">streak</span>
          </div>
        </div>

        <div class="progress-row">
          <div class="progress-track">
            <div class="progress-fill" id="prog-fill"
                 style="width:${Math.round((qNum / total) * 100)}%"></div>
          </div>
          <span class="progress-label" id="prog-label">${qNum} of ${total}</span>
        </div>

        <div class="timer-wrap">
          <div class="timer-row">
            <div class="timer-track">
              <div class="timer-fill" id="timer-fill"
                   style="width:100%;background:#378add"></div>
            </div>
            <span class="timer-lbl" id="timer-label"
                  style="color:#378add">${this.timerDuration}s</span>
          </div>
          <div class="timer-meta">
            <span class="timer-tag">Time remaining</span>
          </div>
        </div>

        <div class="q-card">
          <div class="q-number" id="q-number">Question ${qNum} of ${total}</div>
          <div class="q-text"   id="q-text">${question.question}</div>
          <div class="q-hint"   id="q-hint">
            <span class="hint-label">Hint &mdash; </span>${question.hint || ''}
          </div>
        </div>

        <div class="options-grid" id="options-grid">
          ${this.buildOptions(question)}
        </div>

        <div class="feedback-bar" id="feedback">Choose the correct answer.</div>

      </div>`;

    this.startTimer();
  },

  buildOptions(question) {
    const keys = ['A', 'B', 'C', 'D'];
    return question.options.map((opt, i) => `
      <button class="opt-btn" id="opt-${i}"
              onclick="window.sagaSubmit('${opt.replace(/'/g, "\\'")}', ${i})">
        <span class="opt-key">${keys[i]}</span>
        <span class="opt-text">${opt}</span>
      </button>`).join('');
  },

  // Highlight chosen + correct + dim others
  highlightOptions(data) {
    const { chosenIndex, correctIndex, isCorrect } = data;

    document.querySelectorAll('.opt-btn').forEach(b => b.disabled = true);

    // Highlight chosen option
    if (chosenIndex >= 0) {
      const chosen = document.getElementById(`opt-${chosenIndex}`);
      if (chosen) chosen.classList.add(isCorrect ? 'correct' : 'wrong');
    }

    // Always show correct answer in green
    if (!isCorrect && correctIndex >= 0) {
      const correct = document.getElementById(`opt-${correctIndex}`);
      if (correct) correct.classList.add('correct');
    }

    // Dim all other options
    for (let i = 0; i < 4; i++) {
      if (i !== chosenIndex && i !== correctIndex) {
        const btn = document.getElementById(`opt-${i}`);
        if (btn) btn.classList.add('dimmed');
      }
    }
  },

  // Keep this for backward compat
  highlightOption(index, type) {
    const btn = document.getElementById(`opt-${index}`);
    if (btn) btn.classList.add(type);
  },

  updateTopBar(score, lives, streak) {
    const cs = document.getElementById('chip-score');
    const cl = document.getElementById('chip-lives');
    const ck = document.getElementById('chip-streak');
    if (cs) cs.textContent = `${score} pts`;
    if (cl) {
      cl.textContent = `${lives} ${lives === 1 ? 'life' : 'lives'}`;
      cl.className   = `stat-chip${lives < 2 ? ' warn' : ''}`;
    }
    if (ck) {
      ck.textContent = streak > 0 ? `x${streak} streak` : 'streak';
      ck.className   = `stat-chip${streak > 2 ? ' hot' : ''}`;
    }
  },

  updateProgress(qNum, total) {
    const fill  = document.getElementById('prog-fill');
    const label = document.getElementById('prog-label');
    if (fill)  fill.style.width  = Math.round((qNum / total) * 100) + '%';
    if (label) label.textContent = `${qNum} of ${total}`;
  },

  updateQuestion(question, qNum) {
    const qn = document.getElementById('q-number');
    const qt = document.getElementById('q-text');
    const qh = document.getElementById('q-hint');
    const og = document.getElementById('options-grid');
    if (qn) qn.textContent = `Question ${qNum}`;
    if (qt) qt.textContent = question.question;
    if (qh) qh.innerHTML   = `<span class="hint-label">Hint &mdash; </span>${question.hint || ''}`;
    if (og) og.innerHTML   = this.buildOptions(question);
  },

  setFeedback(message, type) {
    const fb = document.getElementById('feedback');
    if (!fb) return;
    fb.className   = `feedback-bar ${type}`;
    fb.textContent = message;
  },

  clearFeedback() {
    const fb = document.getElementById('feedback');
    if (fb) {
      fb.className   = 'feedback-bar';
      fb.textContent = 'Choose the correct answer.';
    }
  },

  // ── END SCREEN ───────────────────────────────

  renderEndScreen(data) {
    const { reason, score, totalQuestions, questionsAnswered } = data;
    const won = reason === 'completed';
    document.getElementById('app').innerHTML = `
      <div class="game-wrap">
        <div class="end-screen">
          <div class="end-eyebrow">SAGA Engine &middot; NeuronRush</div>
          <div class="end-heading">${won ? 'All done!' : 'Game over'}</div>
          <div class="end-sub">${won
            ? `You answered all ${totalQuestions} questions.`
            : `You reached question ${questionsAnswered} of ${totalQuestions}.`
          }</div>
          <div class="score-block">
            <span class="score-label">Final Score</span>
            <span class="score-value">${score}</span>
          </div>
          <div class="end-actions">
            <button class="btn-primary"
                    onclick="window.MessageBus.emit('game:restart')">
              Play again
            </button>
            <button class="btn-secondary"
                    onclick="window.sagaGoHome()">
              Change mode
            </button>
          </div>
          <div class="end-footer">
            Powered by SAGA Engine &middot; TaPTaP Hackathon 2026
          </div>
        </div>
      </div>`;
  },

  // ── TIMER ────────────────────────────────────

  startTimer() {
    this.stopTimer();
    this.timeLeft = this.timerDuration;
    this.updateTimerUI();
    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      this.updateTimerUI();
      if (this.timeLeft <= 0) {
        this.stopTimer();
        MessageBus.emit('answer:submit', { answer: '__timeout__', optionIndex: -1 });
      }
    }, 1000);
  },

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  updateTimerUI() {
    const fill  = document.getElementById('timer-fill');
    const label = document.getElementById('timer-label');
    const pct   = (this.timeLeft / this.timerDuration) * 100;
    const color = pct > 60 ? '#378add' : pct > 35 ? '#ef9f27' : '#e24b4a';
    if (fill) {
      fill.style.width      = pct + '%';
      fill.style.background = color;
    }
    if (label) {
      label.textContent = `${this.timeLeft}s`;
      label.style.color = color;
    }
  }
};

export default NeuronRush;