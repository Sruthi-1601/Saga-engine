// main.js — SAGA Engine with AI Document Scanner
import MessageBus   from './MessageBus.js';
import ConfigParser  from './ConfigParser.js';
import GameRuntime   from './GameRuntime.js';
import NeuronRush    from './NeuronRush.js';
import QuestPath     from './QuestPath.js';
import MirrorMatch   from './MirrorMatch.js';
import AIScanner     from './AIScanner.js';
import BehaviourEngine from './BehaviourEngine.js';
import DungeonEscape  from './DungeonEscape.js';
import MazeRunner     from './MazeRunner.js';
import EnemySurvival  from './EnemySurvival.js';

window.MessageBus = MessageBus;

window.sagaSubmit    = (a, i) => MessageBus.emit('answer:submit', { answer: a, optionIndex: i });
window.sagaFlip      = (id)   => MirrorMatch.flip(id);
window.sagaGoHome    = ()     => renderHome(window._sagaConfig);
window.sagaGoModes   = (sub)  => renderModeSelect(window._sagaConfig, sub);
window.sagaStartGame     = (mode) => MessageBus.emit('game:begin', { mode: mode || 'NeuronRush' });
window.sagaStartGameMode = (mode) => MessageBus.emit('gamemode:start', { mode, config: window._sagaConfig });
window.sagaStartQuiz     = ()     => renderQuizMode(window._sagaConfig);
window.sagaQuizAnswer    = (i)    => handleQuizAnswer(i);

MessageBus.on('game:end',    (data) => renderEndScreen(data));
MessageBus.on('ai:scanning', (data) => updateScanStatus('scanning', data.fileName));
MessageBus.on('ai:done',     (data) => onAIDone(data.config));
MessageBus.on('ai:error',    (data) => updateScanStatus('error', data.message));

// ── SCREEN 1: Home ──────────────────────────────────────

function renderHome(config) {
  window._sagaConfig = config;
  window._activeSubject = null;
  const subjects = config.subjects;

  document.getElementById('app').innerHTML = `
    <div class="home-layout fade-in">

      <!-- LEFT SIDEBAR -->
      <aside class="home-sidebar">
        <div class="sidebar-brand">
          <div class="sidebar-logo">SAGA <span>ENGINE</span></div>
          <div class="sidebar-sub">Subject Adaptive Game Architecture</div>
        </div>

        <div class="sidebar-section">
          <div class="sidebar-label">BUILT BY</div>
          <div class="sidebar-team">Team Mitrujoy</div>
          <div class="sidebar-event">TaPTaP Hackathon 2026</div>
        </div>

        <div class="sidebar-section">
          <div class="sidebar-label">ENGINE STACK</div>
          <div class="sidebar-stack">
            <span class="stack-tag">Message Bus</span>
            <span class="stack-tag">Behaviour AI</span>
            <span class="stack-tag">6 Game Modes</span>
            <span class="stack-tag">NLP Scanner</span>
          </div>
        </div>

        <div class="sidebar-quote">
          Upload your notes.<br/>
          <em>Play your exam prep.</em>
        </div>
      </aside>

      <!-- MAIN CONTENT -->
      <main class="home-main">

        <!-- SCANNER PANEL -->
        <section class="scanner-panel">
          <div class="scanner-header">
            <div class="scanner-title">
              <span class="scanner-icon-wrap">🤖</span>
              <div>
                <div class="scanner-heading">AI Document Scanner</div>
                <div class="scanner-sub">Upload your study material — AI generates a full quiz &amp; game set instantly</div>
              </div>
            </div>
          </div>

          <!-- Document requirements note -->
          <div class="doc-requirements">
            <div class="doc-req-title">📋 For best results, your document should:</div>
            <ul class="doc-req-list">
              <li>Use clear statements like <strong>"X is Y"</strong>, <strong>"X causes Y"</strong>, or <strong>"X consists of Y"</strong></li>
              <li>Be at least <strong>1 full page</strong> of content (revision notes, textbook chapters, lecture slides)</li>
              <li>Be in <strong>English</strong> — PDFs, Word docs (.docx), or clear images</li>
              <li>Avoid scanned handwriting or heavily formatted tables — plain prose works best</li>
            </ul>
          </div>

          <div class="upload-zone" id="ai-upload-box"
               ondragover="event.preventDefault();this.classList.add('drag-over')"
               ondragleave="this.classList.remove('drag-over')"
               ondrop="event.preventDefault();this.classList.remove('drag-over');window.handleFileDrop(event)">
            <div class="upload-zone-inner">
              <div class="upload-formats">
                <span class="fmt-chip">📄 PDF</span>
                <span class="fmt-chip">📝 Word</span>
                <span class="fmt-chip">🖼️ Image</span>
              </div>
              <div class="upload-cta">Drop your file here or</div>
              <input type="file" id="ai-file-input"
                     accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                     style="display:none"
                     onchange="window.handleFileSelect(event)"/>
              <button class="upload-btn" onclick="document.getElementById('ai-file-input').click()">
                Browse File
              </button>
            </div>
          </div>

          <div class="ai-status" id="ai-status"></div>
        </section>

      </main>
    </div>`;
}

// ── FILE HANDLING ────────────────────────────────────────

window.handleFileSelect = async (event) => {
  const file = event.target.files[0];
  if (file) await processFile(file);
};

window.handleFileDrop = async (event) => {
  const file = event.dataTransfer.files[0];
  if (file) await processFile(file);
};

async function processFile(file) {
  // Validate file type
  const allowed = ['.pdf','.doc','.docx','.png','.jpg','.jpeg','.webp'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!allowed.includes(ext)) {
    updateScanStatus('error', 'Please upload a PDF, Word or Image file');
    return;
  }

  updateScanStatus('scanning', file.name);

  try {
    const config = await AIScanner.scanDocument(file);
    onAIDone(config);
  } catch (err) {
    updateScanStatus('error', err.message);
  }
}

function updateScanStatus(type, message) {
  const el = document.getElementById('ai-status');
  if (!el) return;

  if (type === 'scanning') {
    el.innerHTML = `
      <div class="ai-status-scanning">
        <div class="ai-spinner"></div>
        <div>
          <div class="ai-status-title">Reading document...</div>
          <div class="ai-status-sub">${message}</div>
        </div>
      </div>`;
  } else if (type === 'success') {
    el.innerHTML = `
      <div class="ai-status-success">
        <span>✅</span>
        <div>
          <div class="ai-status-title">Game generated!</div>
          <div class="ai-status-sub">${message}</div>
        </div>
      </div>`;
  } else if (type === 'error') {
    el.innerHTML = `
      <div class="ai-status-error">
        <span>⚠️</span>
        <div>
          <div class="ai-status-title">Something went wrong</div>
          <div class="ai-status-sub">${message}</div>
        </div>
      </div>`;
  }
}

function onAIDone(config) {
  window._sagaConfig = config;
  window._aiGenerated = true;

  // Inject into subjects as AI Generated
  if (!window._sagaConfig.subjects) {
    window._sagaConfig.subjects = {};
  }
  window._sagaConfig.subjects['AI Generated'] = {
    icon: '🤖',
    title: config.metadata.title,
    questions: config.content.questions,
    nodes: config.content.nodes,
    pairs: config.content.pairs
  };

  updateScanStatus('success', `${config.content.questions.length} questions generated from your document!`);

  // Auto navigate to mode select after 1.5 seconds
  setTimeout(() => {
    renderModeSelect(window._sagaConfig, 'AI Generated');
  }, 1500);
}

// ── SCREEN 2: Mode Selector ──────────────────────────────

function renderModeSelect(config, subject) {
  window._activeSubject = subject;
  const subjectData = config.subjects[subject];

  config.content.questions = subjectData.questions;
  config.content.nodes     = subjectData.nodes;
  config.content.pairs     = subjectData.pairs;
  config.metadata.title    = subjectData.title || subject;
  config.metadata.subject  = subject;

  const isAI = subject === 'AI Generated';

  document.getElementById('app').innerHTML = `
    <div class="home-layout fade-in">

      <!-- LEFT SIDEBAR -->
      <aside class="home-sidebar">
        <div class="sidebar-brand">
          <div class="sidebar-logo">SAGA <span>ENGINE</span></div>
          <div class="sidebar-sub">Subject Adaptive Game Architecture</div>
        </div>
        <button class="back-btn sidebar-back" onclick="window.sagaGoHome()">← Back to home</button>

        <div class="sidebar-section">
          <div class="sidebar-label">SUBJECT</div>
          <div class="sidebar-subject-icon">${subjectData.icon}</div>
          <div class="sidebar-team">${subject}</div>
          <div class="sidebar-event">${subjectData.title || subject}</div>
        </div>

        <div class="sidebar-section">
          <div class="sidebar-label">SESSION INFO</div>
          <div class="sidebar-stat-row"><span>Questions</span><strong>${subjectData.questions.length}</strong></div>
          <div class="sidebar-stat-row"><span>Lives</span><strong>${config.mechanics.lives}</strong></div>
          <div class="sidebar-stat-row"><span>Difficulty</span><strong>Adaptive</strong></div>
          <div class="sidebar-stat-row"><span>Streak bonus</span><strong>Yes</strong></div>
        </div>

        ${isAI ? '<div class="sidebar-ai-badge">🤖 AI Generated</div>' : ''}
      </aside>

      <!-- MAIN CONTENT -->
      <main class="home-main">
        <div class="modes-section-head">Select your mode</div>

      <!-- QUIZ MODES — study layer -->
      <div class="modes-label">// Quiz Mode — Study First</div>
      <div class="modes-grid">
        <button class="mode-card mode-pair-card" onclick="window.sagaStartGame('NeuronRush')">
          <div class="mode-icon">⚡</div>
          <div class="mode-info">
            <div class="mode-name">NeuronRush</div>
            <div class="mode-desc">Rapid-fire timed Q&amp;A — beat the clock, build your streak</div>
          </div>
          <span class="mode-badge badge-quiz">QUIZ</span>
        </button>
        <button class="mode-card mode-pair-card" onclick="window.sagaStartGame('QuestPath')">
          <div class="mode-icon">🗺️</div>
          <div class="mode-info">
            <div class="mode-name">QuestPath</div>
            <div class="mode-desc">Story map — answer to unlock each chapter node</div>
          </div>
          <span class="mode-badge badge-quiz">QUIZ</span>
        </button>
        <button class="mode-card mode-pair-card" onclick="window.sagaStartGame('MirrorMatch')">
          <div class="mode-icon">🃏</div>
          <div class="mode-info">
            <div class="mode-name">MirrorMatch</div>
            <div class="mode-desc">Flip cards, match terms with definitions</div>
          </div>
          <span class="mode-badge badge-quiz">QUIZ</span>
        </button>
      </div>

      <div class="divider-row" style="margin:18px 0">
        <div class="divider-line"></div>
        <span class="divider-text">same questions · more fun</span>
        <div class="divider-line"></div>
      </div>

      <!-- GAME MODES — canvas games with Behaviour System -->
      <div class="modes-label">// Game Mode — Play It <span class="behaviour-tag">🧠 Behaviour Adaptive</span></div>
      <div class="modes-grid">
        <button class="mode-card mode-game-card" onclick="window.sagaStartGameMode('DungeonEscape')">
          <div class="mode-icon">🏰</div>
          <div class="mode-info">
            <div class="mode-name">DungeonEscape</div>
            <div class="mode-desc">Answer correctly to open dungeon doors — wrong answers trigger traps</div>
          </div>
          <span class="mode-badge badge-game">GAME</span>
        </button>
        <button class="mode-card mode-game-card" onclick="window.sagaStartGameMode('MazeRunner')">
          <div class="mode-icon">🌀</div>
          <div class="mode-info">
            <div class="mode-name">MazeRunner</div>
            <div class="mode-desc">Navigate the maze — answer gate questions to unlock the path</div>
          </div>
          <span class="mode-badge badge-game">GAME</span>
        </button>
        <button class="mode-card mode-game-card" onclick="window.sagaStartGameMode('EnemySurvival')">
          <div class="mode-icon">👾</div>
          <div class="mode-info">
            <div class="mode-name">EnemySurvival</div>
            <div class="mode-desc">Enemies march toward you — shoot the correct answer to survive</div>
          </div>
          <span class="mode-badge badge-game">GAME</span>
        </button>
      </div>

        <div class="home-footer">
          Built by Team Mitrujoy &middot; Powered by SAGA Engine
          ${isAI ? '&middot; AI Scanner' : ''}
        </div>
      </main>
    </div>`;
}

// ── END SCREEN ───────────────────────────────────────────

function renderEndScreen(data) {
  MirrorMatch.stopClock && MirrorMatch.stopClock();
  const { reason, score, totalQuestions, questionsAnswered, mode } = data;
  const won = reason === 'completed';
  const subject = window._activeSubject || 'History';

  document.getElementById('app').innerHTML = `
    <div class="game-wrap">
      <div class="end-screen fade-in">
        ${won ? '<div class="particles" id="particles"></div>' : ''}
        <div class="end-eyebrow">SAGA ENGINE &middot; ${mode||'NEURONRUSH'} &middot; ${subject.toUpperCase()}</div>
        <div class="end-heading">${won ? 'MISSION COMPLETE' : 'GAME OVER'}</div>
        <div class="end-sub">${won
          ? `You completed all ${totalQuestions} challenges!`
          : `You reached ${questionsAnswered} of ${totalQuestions}.`
        }</div>
        <div class="score-reveal">
          <span class="score-reveal-label">FINAL SCORE</span>
          <span class="score-reveal-value">${score}</span>
          <span class="score-reveal-sub">${won ? '✦ Perfect Run' : `${questionsAnswered}/${totalQuestions} completed`}</span>
        </div>
        <div class="end-actions">
          <button class="btn-primary" onclick="window.sagaStartGame('${mode||'NeuronRush'}')">
            [ PLAY AGAIN ]
          </button>
          <button class="btn-secondary" onclick="window.sagaGoModes('${subject}')">
            [ CHANGE MODE ]
          </button>
          <button class="btn-secondary" onclick="window.sagaGoHome()">
            [ CHANGE SUBJECT ]
          </button>
        </div>
        <div class="end-footer">
          Powered by SAGA Engine &middot; Team Mitrujoy &middot; TaPTaP 2026
        </div>
      </div>
    </div>`;
  if (won) spawnParticles();
}

function spawnParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  const colors = ['#00d4ff','#ffd700','#00ff88','#aa44ff','#ff4466','#ff8800'];
  for (let i = 0; i < 60; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.cssText = `
      left:${Math.random()*100}%;top:${Math.random()*-50}px;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      width:${Math.random()*6+4}px;height:${Math.random()*6+4}px;
      animation-duration:${Math.random()*2+1.5}s;
      animation-delay:${Math.random()*1.5}s;`;
    container.appendChild(p);
  }
}


// ── QUIZ MODE (linear, no pressure) ──────────────────────
// Shares the same questions as game modes — study-first UX.

let _quizState = { questions:[], index:0, score:0, answers:[] };

function renderQuizMode(config) {
  const questions = config.content.questions;
  const subject   = window._activeSubject || 'Quiz';
  _quizState = { questions, index:0, score:0, answers:[] };

  document.getElementById('app').innerHTML = `
    <div class="home-wrap fade-in">
      <div class="home-header">
        <div class="home-eyebrow">
          <button class="back-btn" onclick="window.sagaGoModes(window._activeSubject||'History')">← Back</button>
          <span class="ai-badge">📝 Quiz Mode</span>
        </div>
        <div class="home-logo">📝 <span>Quiz</span></div>
        <div class="home-tagline">${subject} · ${questions.length} questions · no timer · no lives</div>
      </div>
      <div id="quiz-body"></div>
    </div>`;
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const { questions, index } = _quizState;
  if (index >= questions.length) { renderQuizSummary(); return; }
  const q = questions[index];
  const progress = Math.round(((index) / questions.length) * 100);

  document.getElementById('quiz-body').innerHTML = `
    <div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${progress}%"></div></div>
    <div class="quiz-counter">${index+1} / ${questions.length}</div>
    <div class="quiz-card fade-in">
      <div class="quiz-question">${q.question}</div>
      <div class="quiz-options" id="quiz-options">
        ${q.options.map((opt, i) => `
          <button class="quiz-option" id="qopt-${i}" onclick="window.sagaQuizAnswer(${i})">
            <span class="quiz-opt-label">${String.fromCharCode(65+i)}</span>
            <span class="quiz-opt-text">${opt}</span>
          </button>`).join('')}
      </div>
      <div class="quiz-hint" id="quiz-hint">💡 ${q.hint || ''}</div>
      <div class="quiz-feedback" id="quiz-feedback"></div>
      <button class="btn-secondary quiz-next" id="quiz-next" style="display:none"
              onclick="window._quizNext()">Next Question →</button>
    </div>`;
}

function handleQuizAnswer(optionIndex) {
  const q = _quizState.questions[_quizState.index];
  const chosen = q.options[optionIndex];
  const isCorrect = chosen === q.answer;
  const pts = isCorrect ? (q.points || 10) : 0;
  _quizState.score += pts;
  _quizState.answers.push({ question: q.question, chosen, correct: q.answer, isCorrect });

  q.options.forEach((_, i) => {
    const btn = document.getElementById('qopt-' + i);
    if (!btn) return;
    btn.disabled = true;
    if (q.options[i] === q.answer) btn.classList.add('quiz-correct');
    else if (i === optionIndex && !isCorrect) btn.classList.add('quiz-wrong');
  });

  const fb = document.getElementById('quiz-feedback');
  if (fb) fb.innerHTML = isCorrect
    ? `<span class="quiz-fb-correct">✅ Correct! +${pts} pts</span>`
    : `<span class="quiz-fb-wrong">❌ Wrong. Answer: <strong>${q.answer}</strong></span>`;

  const nxt = document.getElementById('quiz-next');
  if (nxt) nxt.style.display = 'block';
}

window._quizNext = function() {
  _quizState.index++;
  renderQuizQuestion();
};

function renderQuizSummary() {
  const { questions, score, answers } = _quizState;
  const maxScore = questions.reduce((s, q) => s + (q.points || 10), 0);
  const pct      = Math.round((score / maxScore) * 100);
  const subject  = window._activeSubject || 'Quiz';

  document.getElementById('quiz-body').innerHTML = `
    <div class="end-screen fade-in" style="padding:0">
      <div class="end-eyebrow">QUIZ COMPLETE · ${subject.toUpperCase()}</div>
      <div class="end-heading" style="font-size:2rem">📝 Results</div>
      <div class="score-reveal">
        <span class="score-reveal-label">SCORE</span>
        <span class="score-reveal-value">${score}</span>
        <span class="score-reveal-sub">${pct}% · ${answers.filter(a=>a.isCorrect).length}/${questions.length} correct</span>
      </div>
      <div class="quiz-summary-list">
        ${answers.map((a,i) => `
          <div class="quiz-summary-item ${a.isCorrect ? 'qs-correct' : 'qs-wrong'}">
            <span class="qs-num">Q${i+1}</span>
            <span class="qs-q">${a.question}</span>
            <span class="qs-result">${a.isCorrect ? '✅' : '❌ → ' + a.correct}</span>
          </div>`).join('')}
      </div>
      <div class="end-actions" style="margin-top:24px">
        <button class="btn-primary" onclick="window.sagaStartQuiz()">[ RETRY QUIZ ]</button>
        <button class="btn-secondary" onclick="window.sagaGoModes(window._activeSubject||'History')">[ GAME MODES ]</button>
        <button class="btn-secondary" onclick="window.sagaGoHome()">[ HOME ]</button>
      </div>
    </div>`;
}


// ── BOOT ─────────────────────────────────────────────────

async function boot() {
  GameRuntime.init();
  NeuronRush.init();
  QuestPath.init();
  MirrorMatch.init();
  AIScanner.init();
  BehaviourEngine.init();
  window._behaviourEngine = BehaviourEngine;
  DungeonEscape.init();
  MazeRunner.init();
  EnemySurvival.init();

  try {
    const config = await ConfigParser.load('/saga-config.json');
    window._sagaConfig = config;
    renderHome(config);
  } catch (e) {
    try {
      const config = await ConfigParser.load('./saga-config.json');
      window._sagaConfig = config;
      renderHome(config);
    } catch (e2) {
      console.error('Failed to load config:', e2);
    }
  }
}

boot();