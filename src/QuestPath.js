// QuestPath.js — Space Explorer story map mode
import MessageBus from './MessageBus.js';

const QuestPath = {
  timerInterval: null,
  timeLeft: 30,
  timerDuration: 30,
  currentNode: null,
  totalNodes: 0,
  score: 0,
  lives: 3,
  maxLives: 3,

  init() {
    MessageBus.on('game:start',       d => { if(d.mode==='QuestPath') this.onStart(d); });
    MessageBus.on('question:next',    d => { if(d.mode==='QuestPath') this.onNext(d); });
    MessageBus.on('answer:correct',   d => this.onCorrect(d));
    MessageBus.on('answer:wrong',     d => this.onWrong(d));
    MessageBus.on('option:highlight', d => this.highlightOptions(d));
  },

  onStart(data) {
    this.score    = data.state.score;
    this.lives    = data.state.lives;
    this.maxLives = data.state.config.mechanics.lives || 3;
    this.totalNodes = data.state.totalQuestions;
    this.timerDuration = data.question.timeLimit || 30;
    this.currentNode = data.question;
    this.renderMap(data.state, data.question, 0);
  },

  onNext(data) {
    this.score  = data.score;
    this.lives  = data.lives;
    this.timerDuration = data.question.timeLimit || 30;
    this.currentNode = data.question;
    this.renderMap(null, data.question, data.questionNumber - 1, data.score, data.lives, data.streak);
  },

  onCorrect(data) {
    this.stopTimer();
    this.score = data.score;
    this.setFeedback(`✦ Correct! +${data.pts} pts — Launching to next sector!`, 'correct');
  },

  onWrong(data) {
    this.stopTimer();
    this.lives = data.lives;
    this.setFeedback(
      data.timeout ? `✕ Time expired! Answer: ${data.correctAnswer}` : `✕ Wrong trajectory! Answer: ${data.correctAnswer}`,
      'wrong'
    );
  },

  renderMap(state, node, completedCount, score, lives, streak) {
    const s      = score  ?? state?.score  ?? 0;
    const l      = lives  ?? state?.lives  ?? this.maxLives;
    const str    = streak ?? 0;
    const total  = this.totalNodes;
    const config = state?.config || window._sagaConfig;

    document.getElementById('app').innerHTML = `
      <div class="game-wrap fade-in">

        <div class="hud">
          <div class="hud-left">
            <div class="hud-title">${config?.metadata?.title || 'Quest'}</div>
            <div class="hud-meta">QuestPath &middot; Space Explorer</div>
          </div>
          <div class="hud-center">
            <div class="score-label">SCORE</div>
            <div class="score-display" id="score-display">${s}</div>
          </div>
          <div class="hud-right">
            <div class="hearts" id="hearts-display">
              ${this.buildHearts(l, this.maxLives)}
            </div>
          </div>
        </div>

        <!-- Star map nodes -->
        <div class="qp-map">
          ${this.buildNodes(completedCount, total, node)}
        </div>

        <!-- Current node card -->
        <div class="qp-node-card" id="q-card">
          <div class="qp-node-header">
            <div class="qp-node-icon">🚀</div>
            <div>
              <div class="qp-node-title">${node.title}</div>
              <div class="qp-node-story">${node.story}</div>
            </div>
          </div>
          <div class="qp-divider"></div>
          <div class="q-meta">
            <span class="q-number">SECTOR ${completedCount+1} OF ${total}</span>
            <span class="qp-unlocks">Unlocks: ${node.unlocks}</span>
          </div>
          <div class="q-text" id="q-text">${node.question}</div>
          <div class="q-hint"><span class="hint-icon">◈</span>${node.hint||''}</div>
        </div>

        <div class="options-grid" id="options-grid">
          ${this.buildOptions(node)}
        </div>

        <div class="timer-section" style="margin-top:10px">
          <div class="timer-row">
            <div class="timer-track"><div class="timer-fill" id="timer-fill" style="width:100%;background:#00d4ff"></div></div>
            <span class="timer-num" id="timer-num" style="color:#00d4ff">${this.timerDuration}s</span>
          </div>
        </div>

        <div class="feedback-bar" id="feedback">Answer correctly to unlock the next sector.</div>
      </div>`;

    this.startTimer();
  },

  buildNodes(completed, total, current) {
    const icons = ['🌍','🛸','🌕','☄️','⭐'];
    let html = '<div class="qp-nodes">';
    for (let i = 0; i < total; i++) {
      const done    = i < completed;
      const active  = i === completed;
      const locked  = i > completed;
      html += `
        <div class="qp-node-dot ${done?'done':active?'active':'locked'}">
          <span class="qp-node-dot-icon">${done?'✓':icons[i]||'★'}</span>
        </div>
        ${i < total-1 ? `<div class="qp-node-line ${done?'done':''}"></div>` : ''}`;
    }
    html += '</div>';
    return html;
  },

  buildOptions(node) {
    return ['A','B','C','D'].map((k,i) => `
      <button class="opt-btn" id="opt-${i}" onclick="window.sagaSubmit('${node.options[i]?.replace(/'/g,"\\'")}',${i})">
        <span class="opt-key">${k}</span>
        <span class="opt-text">${node.options[i]||''}</span>
        <span class="opt-pts">+${node.points||10}</span>
      </button>`).join('');
  },

  buildHearts(lives, max) {
    let h='';
    for(let i=0;i<max;i++) h+=`<span class="heart${i>=lives?' lost':''}">♥</span>`;
    return h;
  },

  highlightOptions({ chosenIndex, correctIndex, isCorrect }) {
    document.querySelectorAll('.opt-btn').forEach(b=>b.disabled=true);
    if(chosenIndex>=0){const b=document.getElementById(`opt-${chosenIndex}`);if(b)b.classList.add(isCorrect?'correct':'wrong');}
    if(!isCorrect&&correctIndex>=0){const b=document.getElementById(`opt-${correctIndex}`);if(b)b.classList.add('correct');}
    for(let i=0;i<4;i++){if(i!==chosenIndex&&i!==correctIndex){const b=document.getElementById(`opt-${i}`);if(b)b.classList.add('dimmed');}}
  },

  setFeedback(msg, type) {
    const fb=document.getElementById('feedback');
    if(fb){fb.className=`feedback-bar ${type}`;fb.textContent=msg;}
  },

  startTimer() {
    this.stopTimer();
    this.timeLeft=this.timerDuration; this.updateTimerUI();
    this.timerInterval=setInterval(()=>{
      this.timeLeft--; this.updateTimerUI();
      if(this.timeLeft<=0){this.stopTimer();MessageBus.emit('answer:submit',{answer:'__timeout__',optionIndex:-1});}
    },1000);
  },
  stopTimer(){if(this.timerInterval){clearInterval(this.timerInterval);this.timerInterval=null;}},
  updateTimerUI(){
    const f=document.getElementById('timer-fill'),n=document.getElementById('timer-num');
    const pct=(this.timeLeft/this.timerDuration)*100,c=pct>60?'#00d4ff':pct>30?'#ffd700':'#ff4466';
    if(f){f.style.width=pct+'%';f.style.background=c;}
    if(n){n.textContent=`${this.timeLeft}s`;n.style.color=c;}
  }
};

export default QuestPath;