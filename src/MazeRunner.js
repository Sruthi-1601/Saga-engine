// MazeRunner.js — SAGA Game Mode
// Player navigates a maze. Each corridor has a question gate.
// Answer correctly to open the gate and move forward.
// BehaviourEngine controls maze complexity and corridor count.

import MessageBus from './MessageBus.js';

const MazeRunner = {
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

  // Maze state
  maze: {
    cols: 7, rows: 5,
    cells: [],       // 2D grid of { walls: {N,S,E,W}, visited }
    playerCol: 0, playerRow: 2,
    exitCol: 0, exitRow: 0,
    gateCol: 0, gateRow: 0,
    gateOpen: false,
    path: [],        // solved path for player to walk
  },

  anim: {
    playerX: 0, playerY: 0,  // pixel positions
    walking: false,
    walkTarget: { col:0, row:0 },
    flash: 0,
    shakeX: 0,
  },

  cellSize: 60,

  init() {
    MessageBus.on('gamemode:start', (d) => {
      if (d.mode === 'MazeRunner') this.start(d);
    });
    MessageBus.on('behaviour:adapt', (d) => {
      // More complex maze for skilled players
      const c = d.profile.adapt.mazeComplexity;
      this.maze.cols = Math.round(5 + c * 4);  // 5–9 cols
      this.maze.rows = Math.round(3 + c * 3);  // 3–6 rows
    });
    document.addEventListener('keydown', (e) => this._onKey(e));
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
    this.render();
    this._generateMaze();
    this._startLoop();
    this._showQuestion();
  },

  render() {
    document.getElementById('app').innerHTML = `
      <div class="gm-wrap fade-in">
        <div class="gm-hud">
          <div class="gm-hud-left">
            <div class="gm-title">🌀 MazeRunner</div>
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

        <div class="maze-question-panel" id="maze-qpanel" style="display:none">
          <div class="maze-q-label">🚪 Gate locked — answer to pass</div>
          <div class="maze-question" id="maze-q"></div>
          <div class="maze-options" id="maze-opts"></div>
          <div class="maze-hint" id="maze-hint"></div>
        </div>

        <div class="maze-arena" id="maze-arena">
          <canvas id="maze-canvas"></canvas>
        </div>

        <div class="maze-controls">
          <button class="maze-btn" onclick="window.mazeMove('W')">◀</button>
          <div style="display:flex;flex-direction:column;gap:4px">
            <button class="maze-btn" onclick="window.mazeMove('N')">▲</button>
            <button class="maze-btn" onclick="window.mazeMove('S')">▼</button>
          </div>
          <button class="maze-btn" onclick="window.mazeMove('E')">▶</button>
        </div>

        <div class="gm-feedback" id="gm-feedback"></div>
        <div class="gm-progress">
          <div class="gm-progress-fill" id="gm-progress-fill" style="width:0%"></div>
        </div>
      </div>`;

    window.mazeMove = (dir) => this._tryMove(dir);
    this._setupCanvas();
  },

  _setupCanvas() {
    const arena = document.getElementById('maze-arena');
    const canvas = document.getElementById('maze-canvas');
    const m = this.maze;
    this.cellSize = Math.min(60, Math.floor((arena.offsetWidth || 420) / m.cols));
    canvas.width  = m.cols * this.cellSize;
    canvas.height = m.rows * this.cellSize;
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
  },

  // ── Maze generation (recursive backtracker) ───────────────────────────────
  _generateMaze() {
    const m = this.maze;
    m.cells = Array.from({ length: m.rows }, () =>
      Array.from({ length: m.cols }, () => ({ walls: { N:true, S:true, E:true, W:true }, visited: false }))
    );

    // Start: left-middle, Exit: right-middle
    m.playerCol = 0; m.playerRow = Math.floor(m.rows / 2);
    m.exitCol   = m.cols - 1; m.exitRow = Math.floor(m.rows / 2);

    // Gate is 2/3 of the way to the exit
    m.gateCol = Math.floor(m.cols * 0.6); m.gateRow = m.exitRow;
    m.gateOpen = false;

    this._carve(m.playerCol, m.playerRow, m.cells);

    // Open entrance/exit walls
    m.cells[m.playerRow][0].walls.W         = false;
    m.cells[m.exitRow][m.exitCol].walls.E   = false;

    // Set pixel position of player
    this.anim.playerX = m.playerCol * this.cellSize + this.cellSize / 2;
    this.anim.playerY = m.playerRow * this.cellSize + this.cellSize / 2;
  },

  _carve(col, row, cells) {
    const m = this.maze;
    cells[row][col].visited = true;
    const dirs = this._shuffle(['N','S','E','W']);
    for (const dir of dirs) {
      const [nc, nr] = this._neighbor(col, row, dir);
      if (nc >= 0 && nc < m.cols && nr >= 0 && nr < m.rows && !cells[nr][nc].visited) {
        cells[row][col].walls[dir] = false;
        cells[nr][nc].walls[this._opp(dir)] = false;
        this._carve(nc, nr, cells);
      }
    }
  },

  _neighbor(col, row, dir) {
    return { N:[col,row-1], S:[col,row+1], E:[col+1,row], W:[col-1,row] }[dir];
  },
  _opp(dir) { return { N:'S', S:'N', E:'W', W:'E' }[dir]; },
  _shuffle(arr) { return arr.sort(() => Math.random() - 0.5); },

  // ── Player movement ───────────────────────────────────────────────────────
  _tryMove(dir) {
    if (this.anim.walking) return;
    const m = this.maze;
    const cell = m.cells[m.playerRow][m.playerCol];
    if (cell.walls[dir]) {
      // Hit a wall
      this.anim.shakeX = 8;
      return;
    }
    const [nc, nr] = this._neighbor(m.playerCol, m.playerRow, dir);

    // Check if moving onto gate cell
    if (!m.gateOpen && nc === m.gateCol && nr === m.gateRow) {
      this._showQuestion();
      return;
    }

    m.playerCol = nc; m.playerRow = nr;
    this.anim.walking = true;

    // Check exit
    if (nc === m.exitCol && nr === m.exitRow) {
      setTimeout(() => this._nextQuestion(), 600);
    }
  },

  _onKey(e) {
    const map = { ArrowUp:'N', ArrowDown:'S', ArrowLeft:'W', ArrowRight:'E', w:'N', s:'S', a:'W', d:'E' };
    if (map[e.key]) { e.preventDefault(); this._tryMove(map[e.key]); }
  },

  // ── Question panel ────────────────────────────────────────────────────────
  _showQuestion() {
    if (this.questionIndex >= this.totalQuestions) { this.endGame('completed'); return; }
    const q = this.questions[this.questionIndex];
    const profile = this._getProfile();

    const panel = document.getElementById('maze-qpanel');
    if (panel) panel.style.display = 'block';

    const qEl = document.getElementById('maze-q');
    if (qEl) qEl.textContent = q.question;

    const hint = document.getElementById('maze-hint');
    if (hint) hint.textContent = profile.adapt.hintVisible ? `💡 ${q.hint || ''}` : '';

    const opts = document.getElementById('maze-opts');
    if (opts) {
      opts.innerHTML = q.options.map((opt, i) => `
        <button class="dungeon-opt" id="mopt-${i}" onclick="window.mazeAnswer(${i})">
          <span class="dungeon-opt-key">${['A','B','C','D'][i]}</span>
          <span>${opt}</span>
        </button>`).join('');
    }

    this.answered = false;
    window.mazeAnswer = (i) => this._answer(i);

    const pf = document.getElementById('gm-progress-fill');
    if (pf) pf.style.width = Math.round((this.questionIndex / this.totalQuestions) * 100) + '%';
  },

  _answer(optIdx) {
    if (this.answered) return;
    this.answered = true;
    const q  = this.questions[this.questionIndex];
    const ok = q.options[optIdx] === q.answer;

    q.options.forEach((_, i) => {
      const b = document.getElementById(`mopt-${i}`);
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
      this._feedback(`✦ Gate open! +${pts} pts — head to the exit!`, 'correct');
      this.maze.gateOpen = true;
      this.anim.flash = 30;
      setTimeout(() => {
        const panel = document.getElementById('maze-qpanel');
        if (panel) panel.style.display = 'none';
        this._clearFeedback();
      }, 1200);
    } else {
      this.streak = 0;
      this.lives--;
      this._updateHUD();
      this._feedback(`✕ Wrong! The gate holds. Answer: ${q.answer}`, 'wrong');
      this.anim.shakeX = 12;
      if (this.lives <= 0) { setTimeout(() => this.endGame('no_lives'), 1600); return; }
      setTimeout(() => {
        this.answered = false;
        this._clearFeedback();
        // Re-enable buttons
        q.options.forEach((_, i) => {
          const b = document.getElementById(`mopt-${i}`);
          if (b) { b.disabled = false; b.className = 'dungeon-opt'; }
        });
      }, 1400);
    }
  },

  _nextQuestion() {
    this.questionIndex++;
    this.maze.gateOpen = false;
    this._generateMaze();
    this._showQuestion();
  },

  // ── Render loop ───────────────────────────────────────────────────────────
  _startLoop() {
    if (this.gameLoop) cancelAnimationFrame(this.gameLoop);
    this._loop();
  },

  _loop() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx, cs = this.cellSize, m = this.maze;

    // Shake
    const sx = this.anim.shakeX > 0 ? (Math.random() - 0.5) * this.anim.shakeX : 0;
    if (this.anim.shakeX > 0) this.anim.shakeX *= 0.75;

    ctx.save();
    ctx.translate(sx, 0);
    ctx.clearRect(-20, 0, this.canvas.width + 40, this.canvas.height);

    // Background
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(-20, 0, this.canvas.width + 40, this.canvas.height);

    // Draw cells
    for (let r = 0; r < m.rows; r++) {
      for (let c = 0; c < m.cols; c++) {
        const x = c * cs, y = r * cs;
        const cell = m.cells[r][c];

        // Floor
        const isGate   = c === m.gateCol && r === m.gateRow;
        const isExit   = c === m.exitCol  && r === m.exitRow;
        const isPlayer = c === m.playerCol && r === m.playerRow;

        if (isExit) {
          ctx.fillStyle = '#001a00';
        } else if (isGate) {
          ctx.fillStyle = m.gateOpen ? '#001a00' : '#1a0000';
        } else {
          ctx.fillStyle = '#111122';
        }
        ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);

        // Gate icon
        if (isGate) {
          ctx.font = `${cs * 0.5}px serif`;
          ctx.textAlign = 'center';
          ctx.fillText(m.gateOpen ? '🟢' : '🔒', x + cs / 2, y + cs / 2 + cs * 0.18);
        }

        // Exit icon
        if (isExit) {
          if (this.anim.flash > 0) { this.anim.flash--; }
          ctx.font = `${cs * 0.5}px serif`;
          ctx.textAlign = 'center';
          ctx.fillText('🚪', x + cs / 2, y + cs / 2 + cs * 0.18);
        }

        // Walls
        ctx.strokeStyle = '#4444aa';
        ctx.lineWidth = 2;
        if (cell.walls.N) { ctx.beginPath(); ctx.moveTo(x, y);      ctx.lineTo(x + cs, y);      ctx.stroke(); }
        if (cell.walls.S) { ctx.beginPath(); ctx.moveTo(x, y + cs); ctx.lineTo(x + cs, y + cs); ctx.stroke(); }
        if (cell.walls.W) { ctx.beginPath(); ctx.moveTo(x, y);      ctx.lineTo(x, y + cs);      ctx.stroke(); }
        if (cell.walls.E) { ctx.beginPath(); ctx.moveTo(x + cs, y); ctx.lineTo(x + cs, y + cs); ctx.stroke(); }
      }
    }

    // Animate player walking
    const targetX = m.playerCol * cs + cs / 2;
    const targetY = m.playerRow * cs + cs / 2;
    const dx = targetX - this.anim.playerX, dy = targetY - this.anim.playerY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > 2) {
      this.anim.playerX += dx * 0.2;
      this.anim.playerY += dy * 0.2;
    } else {
      this.anim.playerX = targetX;
      this.anim.playerY = targetY;
      this.anim.walking = false;
    }

    // Player glow
    const grd = ctx.createRadialGradient(this.anim.playerX, this.anim.playerY, 0, this.anim.playerX, this.anim.playerY, cs * 0.7);
    grd.addColorStop(0, 'rgba(0,212,255,0.15)');
    grd.addColorStop(1, 'rgba(0,212,255,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(this.anim.playerX, this.anim.playerY, cs * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Player emoji
    ctx.font = `${cs * 0.55}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText('🏃', this.anim.playerX, this.anim.playerY + cs * 0.2);

    ctx.restore();
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
      reason, score: this.score, mode: 'MazeRunner',
      totalQuestions: this.totalQuestions,
      questionsAnswered: this.questionIndex,
    });
  },
};

export default MazeRunner;