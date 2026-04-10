// EnemySurvival.js — SAGA Game Mode
// Enemies march toward the player. Answer correctly to shoot them down.
// Wrong answer = enemy breaks through and costs a life.
// BehaviourEngine controls enemy speed, count, and aggression.

import MessageBus from './MessageBus.js';

const EnemySurvival = {
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
  canvas:        null,
  ctx:           null,

  // Behaviour-driven
  enemySpeed:     1.2,
  enemyCount:     3,
  spawnInterval:  null,

  // Game state
  enemies:    [],
  bullets:    [],
  explosions: [],
  playerX:    0,

  ENEMY_EMOJIS: ['👾','🤖','👺','😈','💀'],

  init() {
    MessageBus.on('gamemode:start', (d) => {
      if (d.mode === 'EnemySurvival') this.start(d);
    });
    MessageBus.on('behaviour:adapt', (d) => {
      this.enemySpeed = 0.8 + d.profile.adapt.enemyAggression * 2.5;
      this.enemyCount = Math.round(2 + d.profile.adapt.enemyAggression * 3);
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
    this.enemies        = [];
    this.bullets        = [];
    this.explosions     = [];
    this.render();
    this._loadQuestion();
    this._startLoop();
  },

  render() {
    document.getElementById('app').innerHTML = `
      <div class="gm-wrap fade-in">
        <div class="gm-hud">
          <div class="gm-hud-left">
            <div class="gm-title">👾 EnemySurvival</div>
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

        <div class="enemy-arena" id="enemy-arena">
          <canvas id="enemy-canvas"></canvas>
        </div>

        <div class="enemy-question-panel">
          <div class="enemy-q-label">🎯 Shoot the correct answer!</div>
          <div class="enemy-question" id="enemy-q"></div>
          <div class="enemy-options" id="enemy-opts"></div>
          <div class="enemy-hint" id="enemy-hint"></div>
        </div>

        <div class="gm-feedback" id="gm-feedback"></div>
        <div class="gm-progress">
          <div class="gm-progress-fill" id="gm-progress-fill" style="width:0%"></div>
        </div>
      </div>`;

    this._setupCanvas();
  },

  _setupCanvas() {
    const arena  = document.getElementById('enemy-arena');
    const canvas = document.getElementById('enemy-canvas');
    canvas.width  = arena.offsetWidth  || 560;
    canvas.height = arena.offsetHeight || 200;
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.playerX = canvas.width / 2;
  },

  _loadQuestion() {
    if (this.questionIndex >= this.totalQuestions) { this.endGame('completed'); return; }
    const q       = this.questions[this.questionIndex];
    const profile = this._getProfile();
    this.answered = false;
    this.enemies  = [];
    this.bullets  = [];

    const pf = document.getElementById('gm-progress-fill');
    if (pf) pf.style.width = Math.round((this.questionIndex / this.totalQuestions) * 100) + '%';

    const qEl = document.getElementById('enemy-q');
    if (qEl) qEl.textContent = q.question;

    const hint = document.getElementById('enemy-hint');
    if (hint) hint.textContent = profile.adapt.hintVisible ? `💡 ${q.hint || ''}` : '';

    // Spawn enemies — one per option, spread across top
    const W = this.canvas.width;
    q.options.forEach((opt, i) => {
      const spacing = W / (q.options.length + 1);
      this.enemies.push({
        x:      spacing * (i + 1),
        y:      20,
        vy:     this.enemySpeed * (0.8 + Math.random() * 0.4),
        text:   opt,
        correct: opt === q.answer,
        emoji:  this.ENEMY_EMOJIS[i % this.ENEMY_EMOJIS.length],
        hit:    false,
        letter: ['A','B','C','D'][i],
        wobble: Math.random() * Math.PI * 2,
      });
    });

    // Answer buttons
    const opts = document.getElementById('enemy-opts');
    if (opts) {
      opts.innerHTML = q.options.map((opt, i) => `
        <button class="enemy-opt" id="eopt-${i}" onclick="window.enemyShoot(${i})">
          <span class="dungeon-opt-key">${['A','B','C','D'][i]}</span>
          <span>${opt}</span>
        </button>`).join('');
    }

    window.enemyShoot = (i) => this._shoot(i);
  },

  _shoot(optIdx) {
    if (this.answered) return;
    const q    = this.questions[this.questionIndex];
    const opt  = q.options[optIdx];
    const ok   = opt === q.answer;

    this.answered = true;

    // Disable buttons immediately
    q.options.forEach((_, i) => {
      const b = document.getElementById(`eopt-${i}`);
      if (!b) return;
      b.disabled = true;
      if (q.options[i] === q.answer) b.classList.add('dopt-correct');
      else if (i === optIdx && !ok) b.classList.add('dopt-wrong');
    });

    // Find enemy to shoot
    const target = this.enemies.find(e => e.text === opt && !e.hit);
    if (target) {
      // Fire bullet
      this.bullets.push({ x: this.playerX, y: this.canvas.height - 30, tx: target.x, ty: target.y, speed: 12, hit: false });
    }

    if (ok) {
      this.streak++;
      const pts = (this.config.mechanics.streakBonus && this.streak > 2)
        ? Math.round((q.points || 10) * 1.5) : (q.points || 10);
      this.score += pts;
      this._updateHUD();
      this._feedback(`✦ Enemy eliminated! +${pts} pts`, 'correct');
      // Explode all wrong enemies
      setTimeout(() => {
        this.enemies.forEach(e => { if (!e.correct) this._explode(e.x, e.y, '#ff4466'); });
        this.enemies = [];
      }, 400);
    } else {
      this.streak = 0;
      this.lives--;
      this._updateHUD();
      this._feedback(`✕ Wrong target! Answer: ${q.answer}`, 'wrong');
      MessageBus.emit('behaviour:action', { type: 'enemy_hit' });
      if (this.lives <= 0) { setTimeout(() => this.endGame('no_lives'), 1600); return; }
    }

    this.questionIndex++;
    setTimeout(() => { this._clearFeedback(); this._loadQuestion(); }, 1600);
  },

  _explode(x, y, color) {
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      this.explosions.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color: color || `hsl(${Math.random()*60+10},100%,60%)`,
        r: 3 + Math.random() * 4,
      });
    }
  },

  _startLoop() {
    if (this.gameLoop) cancelAnimationFrame(this.gameLoop);
    this._loop();
  },

  _loop() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Space background
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 40; i++) {
      ctx.fillRect((i * 137) % W, (i * 89 + Date.now() * 0.005) % H, 1.5, 1.5);
    }

    // Ground line
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, H - 30); ctx.lineTo(W, H - 30); ctx.stroke();

    // Player (turret)
    ctx.font = '28px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🛸', this.playerX, H - 10);

    // Enemies
    this.enemies.forEach(e => {
      if (e.hit) return;
      e.y  += e.vy;
      e.wobble += 0.05;
      e.x  += Math.sin(e.wobble) * 0.8;

      // If enemy reaches player line — lose life (handled on wrong answer above)
      if (e.y > H - 30) { e.hit = true; return; }

      // Enemy glow
      const grd = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 30);
      grd.addColorStop(0, e.correct ? 'rgba(255,60,60,0.2)' : 'rgba(100,100,255,0.1)');
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(e.x, e.y, 30, 0, Math.PI * 2); ctx.fill();

      // Enemy emoji
      ctx.font = '26px serif';
      ctx.textAlign = 'center';
      ctx.fillText(e.emoji, e.x, e.y);

      // Label
      ctx.font = 'bold 9px Orbitron, monospace';
      ctx.fillStyle = e.correct ? '#ff6060' : '#aaaaff';
      ctx.fillText(e.letter, e.x, e.y + 18);
      ctx.font = '9px DM Sans, sans-serif';
      ctx.fillStyle = '#ffffff';
      const short = e.text.length > 14 ? e.text.slice(0, 12) + '…' : e.text;
      ctx.fillText(short, e.x, e.y + 30);
    });

    // Bullets
    this.bullets = this.bullets.filter(b => !b.hit);
    this.bullets.forEach(b => {
      const dx = b.tx - b.x, dy = b.ty - b.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < b.speed + 5) {
        b.hit = true;
        // Find and destroy target enemy
        const enemy = this.enemies.find(e => Math.abs(e.x - b.tx) < 20 && !e.hit);
        if (enemy) {
          enemy.hit = true;
          this._explode(enemy.x, enemy.y, enemy.correct ? '#00ff88' : '#ff4466');
        }
        return;
      }
      b.x += (dx / dist) * b.speed;
      b.y += (dy / dist) * b.speed;

      // Draw bullet
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd700';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x, b.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,215,0,0.3)';
      ctx.fill();
    });

    // Explosions
    this.explosions = this.explosions.filter(p => p.life > 0.05);
    this.explosions.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.life *= 0.88;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    this.gameLoop = requestAnimationFrame(() => this._loop());
  },

  _getProfile() {
    try { return window._behaviourEngine?.getProfile() || { adapt:{hintVisible:true} }; }
    catch(_) { return { adapt:{hintVisible:true} }; }
  },
  _badge() {
    try { return window._behaviourEngine?.getLevelBadge() || '📚 LEARNER'; } catch(_){ return '📚 LEARNER'; }
  },
  _hearts() {
    let h = '';
    for (let i = 0; i < this.maxLives; i++)
      h += `<span class="heart${i >= this.lives ? ' lost':''}">♥</span>`;
    return h;
  },
  _updateHUD() {
    const s = document.getElementById('gm-score');
    const h = document.getElementById('gm-hearts');
    const b = document.getElementById('gm-behaviour-badge');
    if (s) { s.textContent = this.score; }
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
      reason, score: this.score, mode: 'EnemySurvival',
      totalQuestions: this.totalQuestions,
      questionsAnswered: this.questionIndex,
    });
  },
};

export default EnemySurvival;