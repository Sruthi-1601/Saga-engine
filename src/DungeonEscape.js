// DungeonEscape.js — SAGA Game Mode
// Player is trapped in a dungeon. Each correct answer opens the next door.
// Wrong answers trigger traps. BehaviourEngine controls trap rate & door speed.
// Canvas-based. Listens to: gamemode:start, behaviour:adapt

import MessageBus from './MessageBus.js';

const DungeonEscape = {
  gameLoop:      null,
  config:        null,
  questions:     [],
  questionIndex: 0,
  totalQuestions:0,
  score:         0,
  lives:         3,
  maxLives:      3,
  streak:        0,
  answered:      false,
  phase:         'question', // 'question' | 'escape' | 'trap'
  canvas:        null,
  ctx:           null,

  // Behaviour-driven state
  trapRate:      0.30,
  doorOpenSpeed: 3,

  // Animation state
  anim: {
    doorOpen:     0,     // 0–1
    playerX:      80,
    playerY:      0,
    trapX:        600,
    trapVisible:  false,
    particles:    [],
    shake:        0,
  },

  init() {
    MessageBus.on('gamemode:start', (d) => {
      if (d.mode === 'DungeonEscape') this.start(d);
    });
    MessageBus.on('behaviour:adapt', (d) => {
      this.trapRate     = d.profile.adapt.dungeonTrapRate;
      this.doorOpenSpeed = 3 + d.profile.adapt.speedMultiplier * 2;
    });
  },

  start(data) {
    this.config         = data.config;
    this.questions      = data.config.content.questions;
    this.totalQuestions = this.questions.length;
    this.score          = 0;
    this.lives          = data.config.mechanics.lives || 3;
    this.maxLives       = this.lives;
    this.streak         = 0;
    this.questionIndex  = 0;
    this.answered       = false;
    this.anim           = { doorOpen:0, playerX:80, playerY:0, trapX:700, trapVisible:false, particles:[], shake:0 };
    this.render();
    this.loadQuestion();
  },

  render() {
    document.getElementById('app').innerHTML = `
      <div class="gm-wrap fade-in">
        <div class="gm-hud">
          <div class="gm-hud-left">
            <div class="gm-title">🏰 DungeonEscape</div>
            <div class="gm-meta" id="gm-behaviour-badge">${this._badge()}</div>
          </div>
          <div class="gm-hud-center">
            <div class="score-label">SCORE</div>
            <div class="score-display" id="gm-score">0</div>
          </div>
          <div class="gm-hud-right">
            <div class="hearts" id="gm-hearts">${this._hearts()}</div>
          </div>
        </div>

        <div class="dungeon-question-panel" id="dungeon-qpanel">
          <div class="dungeon-q-label">⚠️ Answer to open the door</div>
          <div class="dungeon-question" id="dungeon-q"></div>
          <div class="dungeon-options" id="dungeon-opts"></div>
          <div class="dungeon-hint" id="dungeon-hint"></div>
        </div>

        <div class="dungeon-arena" id="dungeon-arena">
          <canvas id="dungeon-canvas"></canvas>
        </div>

        <div class="gm-feedback" id="gm-feedback"></div>
        <div class="gm-progress">
          <div class="gm-progress-fill" id="gm-progress-fill" style="width:0%"></div>
        </div>
      </div>`;

    this._setupCanvas();
  },

  _setupCanvas() {
    const arena  = document.getElementById('dungeon-arena');
    const canvas = document.getElementById('dungeon-canvas');
    canvas.width  = arena.offsetWidth  || 560;
    canvas.height = arena.offsetHeight || 200;
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.anim.playerY = canvas.height - 70;
  },

  loadQuestion() {
    if (this.questionIndex >= this.totalQuestions) { this.endGame('completed'); return; }
    const q        = this.questions[this.questionIndex];
    const profile  = this._getProfile();
    this.answered  = false;
    this.phase     = 'question';
    this.anim.doorOpen  = 0;
    this.anim.trapX     = (this.canvas?.width || 560) + 100;
    this.anim.trapVisible = false;
    this.anim.particles = [];

    // Progress bar
    const pf = document.getElementById('gm-progress-fill');
    if (pf) pf.style.width = Math.round((this.questionIndex / this.totalQuestions) * 100) + '%';

    // Question
    const qEl = document.getElementById('dungeon-q');
    if (qEl) qEl.textContent = q.question;

    // Hint visibility from behaviour
    const hintEl = document.getElementById('dungeon-hint');
    if (hintEl) {
      hintEl.textContent = profile.adapt.hintVisible ? `💡 ${q.hint || ''}` : '';
    }

    // Options
    const optsEl = document.getElementById('dungeon-opts');
    if (optsEl) {
      optsEl.innerHTML = q.options.map((opt, i) => `
        <button class="dungeon-opt" id="dopt-${i}" onclick="window.dungeonAnswer(${i})">
          <span class="dungeon-opt-key">${['A','B','C','D'][i]}</span>
          <span>${opt}</span>
        </button>`).join('');
    }

    window.dungeonAnswer = (i) => this._answer(i);
    this._startLoop();
  },

  _answer(optIdx) {
    if (this.answered) return;
    this.answered = true;
    const q     = this.questions[this.questionIndex];
    const opted = q.options[optIdx];
    const ok    = opted === q.answer;

    // Disable buttons
    q.options.forEach((_, i) => {
      const b = document.getElementById(`dopt-${i}`);
      if (!b) return;
      b.disabled = true;
      if (q.options[i] === q.answer) b.classList.add('dopt-correct');
      else if (i === optIdx && !ok) b.classList.add('dopt-wrong');
    });

    if (ok) {
      this.streak++;
      const pts = (this.config.mechanics.streakBonus && this.streak > 2)
        ? Math.round((q.points || 10) * 1.5) : (q.points || 10);
      this.score += pts;
      this._updateHUD();
      this._feedback(`✦ Door opening! +${pts} pts`, 'correct');
      this.phase = 'escape';
      MessageBus.emit('behaviour:action', { type: 'correct' });
    } else {
      this.streak = 0;
      this.lives--;
      this._updateHUD();
      this._feedback(`✕ Wrong! Trap triggered! Answer: ${q.answer}`, 'wrong');
      this.phase = 'trap';
      this.anim.trapVisible = true;
      this.anim.shake = 10;
      MessageBus.emit('behaviour:action', { type: 'dungeon_trap' });
      if (this.lives <= 0) { setTimeout(() => this.endGame('no_lives'), 1800); return; }
    }

    this.questionIndex++;
    setTimeout(() => { this._clearFeedback(); this.loadQuestion(); }, 1800);
  },

  _startLoop() {
    if (this.gameLoop) cancelAnimationFrame(this.gameLoop);
    this._loop();
  },

  _loop() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;

    // Shake offset
    const sx = this.anim.shake > 0 ? (Math.random() - 0.5) * this.anim.shake : 0;
    if (this.anim.shake > 0) this.anim.shake *= 0.8;

    ctx.save();
    ctx.translate(sx, 0);
    ctx.clearRect(-20, 0, W + 40, H);

    // Dungeon background
    ctx.fillStyle = '#0a0608';
    ctx.fillRect(-20, 0, W + 40, H);

    // Stone floor
    ctx.fillStyle = '#1a1015';
    ctx.fillRect(0, H - 30, W, 30);
    for (let x = 0; x < W; x += 50) {
      ctx.strokeStyle = '#2a1a20';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, H - 30, 50, 30);
    }

    // Stone walls (top)
    for (let x = 0; x < W; x += 50) {
      ctx.fillStyle = x % 100 === 0 ? '#1c1015' : '#18100f';
      ctx.fillRect(x, 0, 50, 28);
      ctx.strokeStyle = '#2a1a1a';
      ctx.strokeRect(x, 0, 50, 28);
    }

    // Torches
    [80, W - 80].forEach(tx => {
      ctx.fillStyle = '#5a3010';
      ctx.fillRect(tx - 4, H - 70, 8, 20);
      // Flame flicker
      const flicker = 0.8 + Math.random() * 0.4;
      ctx.beginPath();
      ctx.arc(tx, H - 72, 8 * flicker, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,${100 + Math.random()*80},0,0.9)`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(tx, H - 76, 4 * flicker, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,220,80,0.9)';
      ctx.fill();
    });

    // Door (right side)
    const doorX = W - 80, doorW = 60, doorH = 100;
    const doorY  = H - 30 - doorH;
    // Door frame
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(doorX - 6, doorY - 6, doorW + 12, doorH + 12);
    // Door opening (dark behind)
    ctx.fillStyle = '#000';
    ctx.fillRect(doorX, doorY, doorW, doorH);

    // Animated door panels opening
    if (this.phase === 'escape') {
      this.anim.doorOpen = Math.min(1, this.anim.doorOpen + 0.04);
    }
    const openAmount = this.anim.doorOpen * (doorW / 2);
    // Left door panel
    ctx.fillStyle = '#5a3820';
    ctx.fillRect(doorX, doorY, doorW / 2 - openAmount, doorH);
    ctx.strokeStyle = '#8a5830';
    ctx.lineWidth = 2;
    ctx.strokeRect(doorX, doorY, doorW / 2 - openAmount, doorH);
    // Right door panel
    ctx.fillRect(doorX + doorW / 2 + openAmount, doorY, doorW / 2 - openAmount, doorH);
    ctx.strokeRect(doorX + doorW / 2 + openAmount, doorY, doorW / 2 - openAmount, doorH);

    // Glow through open door
    if (this.anim.doorOpen > 0.1) {
      const grd = ctx.createRadialGradient(doorX + doorW/2, doorY + doorH/2, 0, doorX + doorW/2, doorY + doorH/2, 80);
      grd.addColorStop(0, `rgba(255,180,50,${this.anim.doorOpen * 0.4})`);
      grd.addColorStop(1, 'rgba(255,180,50,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(doorX - 40, doorY - 20, doorW + 80, doorH + 40);
    }

    // Player (adventurer emoji)
    const px = this.anim.playerX;
    if (this.phase === 'escape') {
      this.anim.playerX = Math.min(doorX + doorW/2 - 10, this.anim.playerX + this.doorOpenSpeed);
    }
    ctx.font = '32px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🧙', px, H - 32);

    // Trap (spike/fire rolling in from left on wrong answer)
    if (this.anim.trapVisible) {
      this.anim.trapX -= 6;
      if (this.anim.trapX < -60) this.anim.trapVisible = false;
      ctx.font = '36px serif';
      ctx.fillText('🔥', this.anim.trapX, H - 28);
    }

    // Particles on door open
    if (this.phase === 'escape' && this.anim.doorOpen > 0.3) {
      if (Math.random() < 0.3) {
        this.anim.particles.push({
          x: doorX + doorW/2, y: doorY + doorH/2,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4 - 2,
          life: 1, color: `hsl(${40 + Math.random()*20},100%,60%)`
        });
      }
      this.anim.particles = this.anim.particles.filter(p => p.life > 0.05);
      this.anim.particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.life *= 0.9;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    }

    ctx.restore();
    this.gameLoop = requestAnimationFrame(() => this._loop());
  },

  _getProfile() {
    try {
      const BE = window._behaviourEngine;
      return BE ? BE.getProfile() : { adapt: { hintVisible: true, speedMultiplier: 1 } };
    } catch (_) {
      return { adapt: { hintVisible: true, speedMultiplier: 1 } };
    }
  },

  _badge() {
    try { return window._behaviourEngine?.getLevelBadge() || '📚 LEARNER'; } catch(_) { return '📚 LEARNER'; }
  },

  _hearts() {
    let h = '';
    for (let i = 0; i < this.maxLives; i++)
      h += `<span class="heart${i >= this.lives ? ' lost' : ''}">♥</span>`;
    return h;
  },

  _updateHUD() {
    const s = document.getElementById('gm-score');
    const h = document.getElementById('gm-hearts');
    const b = document.getElementById('gm-behaviour-badge');
    if (s) { s.textContent = this.score; s.classList.add('bump'); setTimeout(() => s.classList.remove('bump'), 300); }
    if (h) h.innerHTML = this._hearts();
    if (b) b.textContent = this._badge();
  },

  _feedback(msg, type) {
    const fb = document.getElementById('gm-feedback');
    if (fb) { fb.textContent = msg; fb.className = `gm-feedback ${type}`; }
  },

  _clearFeedback() {
    const fb = document.getElementById('gm-feedback');
    if (fb) { fb.textContent = ''; fb.className = 'gm-feedback'; }
  },

  endGame(reason) {
    if (this.gameLoop) cancelAnimationFrame(this.gameLoop);
    MessageBus.emit('game:end', {
      reason, score: this.score, mode: 'DungeonEscape',
      totalQuestions: this.totalQuestions,
      questionsAnswered: this.questionIndex,
    });
  },
};

export default DungeonEscape;
