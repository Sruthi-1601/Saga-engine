// main.js — SAGA Engine with subject selector
import MessageBus  from './MessageBus.js';
import ConfigParser from './ConfigParser.js';
import GameRuntime  from './GameRuntime.js';
import NeuronRush   from './NeuronRush.js';
import QuestPath    from './QuestPath.js';
import MirrorMatch  from './MirrorMatch.js';

window.MessageBus = MessageBus;

window.sagaSubmit     = (a, i)    => MessageBus.emit('answer:submit', { answer: a, optionIndex: i });
window.sagaFlip       = (id)      => MirrorMatch.flip(id);
window.sagaGoHome     = ()        => renderSubjectSelect(window._sagaConfig);
window.sagaGoModes    = (subject) => renderModeSelect(window._sagaConfig, subject);
window.sagaStartGame  = (mode)    => MessageBus.emit('game:begin', { mode: mode || 'NeuronRush' });

MessageBus.on('game:end', (data) => renderEndScreen(data));

// ── SCREEN 1: Subject Selector ──────────────────────────

function renderSubjectSelect(config) {
  window._sagaConfig   = config;
  window._activeSubject = null;
  const subjects = config.subjects;

  document.getElementById('app').innerHTML = `
    <div class="home-wrap fade-in">
      <div class="home-header">
        <div class="home-eyebrow">TaPTaP Hackathon 2026</div>
        <div class="home-logo">SAGA <span>ENGINE</span></div>
        <div class="home-tagline">JSON-configured learning game engine</div>
        <div class="home-chips">
          <span class="home-chip">3 Game Modes</span>
          <span class="home-chip">5 Subjects</span>
          <span class="home-chip">Message Bus</span>
          <span class="home-chip">Adaptive Difficulty</span>
        </div>
      </div>

      <div class="modes-label">// Choose a Subject</div>
      <div class="subject-grid">
        ${Object.entries(subjects).map(([key, val]) => `
          <button class="subject-card" onclick="window.sagaGoModes('${key}')">
            <div class="subject-icon">${val.icon}</div>
            <div class="subject-info">
              <div class="subject-name">${key}</div>
              <div class="subject-desc">${val.questions.length} questions available</div>
            </div>
            <div class="subject-arrow">→</div>
          </button>`).join('')}
      </div>

      <div class="home-footer">
        Built by Team Mitrujoy &middot; Powered by SAGA Engine
      </div>
    </div>`;
}

// ── SCREEN 2: Mode Selector ─────────────────────────────

function renderModeSelect(config, subject) {
  window._activeSubject = subject;
  const subjectData = config.subjects[subject];

  // Inject selected subject data into config.content
  config.content.questions = subjectData.questions;
  config.content.nodes     = subjectData.nodes;
  config.content.pairs     = subjectData.pairs;
  config.metadata.title    = subjectData.title;
  config.metadata.subject  = subject;

  document.getElementById('app').innerHTML = `
    <div class="home-wrap fade-in">
      <div class="home-header">
        <div class="home-eyebrow">
          <button class="back-btn" onclick="window.sagaGoHome()">← Back</button>
        </div>
        <div class="home-logo">${subjectData.icon} <span>${subject}</span></div>
        <div class="home-tagline">${subjectData.title} &middot; ${subjectData.questions.length} questions</div>
        <div class="home-chips">
          <span class="home-chip">Lives: ${config.mechanics.lives}</span>
          <span class="home-chip">Adaptive Difficulty</span>
          <span class="home-chip">Streak Bonus</span>
        </div>
      </div>

      <div class="modes-label">// Select Game Mode</div>
      <div class="modes-grid">
        <button class="mode-card" onclick="window.sagaStartGame('NeuronRush')">
          <div class="mode-icon">⚡</div>
          <div class="mode-info">
            <div class="mode-name">NeuronRush</div>
            <div class="mode-desc">Rapid-fire timed Q&amp;A — beat the clock, build your streak</div>
          </div>
          <span class="mode-badge badge-ready">READY</span>
        </button>
        <button class="mode-card" onclick="window.sagaStartGame('QuestPath')">
          <div class="mode-icon">🚀</div>
          <div class="mode-info">
            <div class="mode-name">QuestPath</div>
            <div class="mode-desc">Space explorer — answer to unlock the next sector</div>
          </div>
          <span class="mode-badge badge-ready">READY</span>
        </button>
        <button class="mode-card" onclick="window.sagaStartGame('MirrorMatch')">
          <div class="mode-icon">🃏</div>
          <div class="mode-info">
            <div class="mode-name">MirrorMatch</div>
            <div class="mode-desc">Flip cards and match terms with definitions</div>
          </div>
          <span class="mode-badge badge-ready">READY</span>
        </button>
      </div>

      <div class="home-footer">
        Built by Team Mitrujoy &middot; Powered by SAGA Engine
      </div>
    </div>`;
}

// ── END SCREEN ──────────────────────────────────────────

function renderEndScreen(data) {
  MirrorMatch.stopClock && MirrorMatch.stopClock();
  const { reason, score, totalQuestions, questionsAnswered, mode } = data;
  const won = reason === 'completed';
  const subject = window._activeSubject || 'History';

  document.getElementById('app').innerHTML = `
    <div class="game-wrap">
      <div class="end-screen fade-in">
        ${won ? '<div class="particles" id="particles"></div>' : ''}
        <div class="end-eyebrow">SAGA ENGINE &middot; ${mode || 'NEURONRUSH'} &middot; ${subject.toUpperCase()}</div>
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
          <button class="btn-primary" onclick="window.sagaStartGame('${mode || 'NeuronRush'}')">
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

// ── BOOT ────────────────────────────────────────────────

async function boot() {
  GameRuntime.init();
  NeuronRush.init();
  QuestPath.init();
  MirrorMatch.init();

  try {
    const config = await ConfigParser.load('/saga-config.json');
    window._sagaConfig = config;
    renderSubjectSelect(config);
  } catch (e) {
    try {
      const config = await ConfigParser.load('./saga-config.json');
      window._sagaConfig = config;
      renderSubjectSelect(config);
    } catch (e2) {
      console.error('Failed to load config:', e2);
    }
  }
}

boot();
