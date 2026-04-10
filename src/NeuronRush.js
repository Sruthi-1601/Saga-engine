// NeuronRush.js — Rapid fire quiz renderer
import MessageBus from './MessageBus.js';

const NeuronRush = {
  timerInterval: null,
  timeLeft: 30,
  timerDuration: 30,

  init() {
    MessageBus.on('game:start',       d => this.onStart(d));
    MessageBus.on('question:next',    d => { if(d.mode==='NeuronRush'||!d.mode) this.onNext(d); });
    MessageBus.on('answer:correct',   d => this.onCorrect(d));
    MessageBus.on('answer:wrong',     d => this.onWrong(d));
    MessageBus.on('option:highlight', d => this.highlightOptions(d));
  },

  onStart(data) {
    if (data.mode && data.mode !== 'NeuronRush') return;
    this.timerDuration = data.question.timeLimit || 30;
    this.render(data.state, data.question);
  },

  onNext(data) {
    this.timerDuration = data.question.timeLimit || 30;
    this.updateHUD(data.score, data.lives, data.streak,
                   data.questionNumber, data.totalQuestions);
    this.updateQuestion(data.question, data.questionNumber, data.totalQuestions);
    this.clearFeedback();
    this.startTimer();
  },

  onCorrect(data) {
    this.stopTimer();
    this.animateScore();
    this.setFeedback(
      data.streak > 2
        ? `✦ Correct! +${data.pts} pts — Streak x${data.streak}!`
        : `✦ Correct! +${data.pts} pts`,
      'correct'
    );
  },

  onWrong(data) {
    this.stopTimer();
    this.shakeCard();
    this.setFeedback(
      data.timeout
        ? `✕ Time's up! Answer: ${data.correctAnswer}`
        : `✕ Incorrect. Answer: ${data.correctAnswer}`,
      'wrong'
    );
  },

  render(state, question) {
    const qNum  = state.currentIndex + 1;
    const total = state.totalQuestions;
    document.getElementById('app').innerHTML = `
      <div class="game-wrap fade-in">
        <div class="hud">
          <div class="hud-left">
            <div class="hud-title">${state.config.metadata.title}</div>
            <div class="hud-meta">NeuronRush &middot; ${state.config.metadata.subject}</div>
          </div>
          <div class="hud-center">
            <div class="score-label">SCORE</div>
            <div class="score-display" id="score-display">${state.score}</div>
          </div>
          <div class="hud-right">
            <div class="hearts" id="hearts-display">
              ${this.buildHearts(state.lives, state.config.mechanics.lives||3)}
            </div>
          </div>
        </div>
        <div class="xp-section">
          <div class="xp-row">
            <span class="xp-label">XP</span>
            <div class="xp-track"><div class="xp-fill" id="xp-fill" style="width:${Math.round(qNum/total*100)}%"></div></div>
            <span class="xp-count" id="xp-count">${qNum}/${total}</span>
          </div>
        </div>
        <div class="timer-section">
          <div class="timer-row">
            <div class="timer-track"><div class="timer-fill" id="timer-fill" style="width:100%;background:#00d4ff"></div></div>
            <span class="timer-num" id="timer-num" style="color:#00d4ff">${this.timerDuration}s</span>
          </div>
          <div class="timer-meta">
            <span>TIME REMAINING</span>
            <div class="streak-badge" id="streak-badge">STREAK: 0</div>
          </div>
        </div>
        <div class="q-card" id="q-card">
          <div class="q-meta">
            <span class="q-number" id="q-number">QUESTION ${qNum} OF ${total}</span>
            <span class="q-diff ${this.diffClass(question.difficulty)}" id="q-diff">${(question.difficulty||'easy').toUpperCase()}</span>
          </div>
          <div class="q-text" id="q-text">${question.question}</div>
          <div class="q-hint" id="q-hint"><span class="hint-icon">◈</span>${question.hint||''}</div>
        </div>
        <div class="options-grid" id="options-grid">${this.buildOptions(question)}</div>
        <div class="feedback-bar" id="feedback">Choose the correct answer to proceed.</div>
      </div>`;
    this.startTimer();
  },

  buildOptions(q) {
    return ['A','B','C','D'].map((k,i) => `
      <button class="opt-btn" id="opt-${i}" onclick="window.sagaSubmit('${q.options[i]?.replace(/'/g,"\\'")}',${i})">
        <span class="opt-key">${k}</span>
        <span class="opt-text">${q.options[i]||''}</span>
        <span class="opt-pts">+${q.points||10}</span>
      </button>`).join('');
  },

  buildHearts(lives, max) {
    let h = '';
    for (let i=0;i<max;i++) h+=`<span class="heart${i>=lives?' lost':''}">♥</span>`;
    return h;
  },

  diffClass(d) {
    return d==='hard'?'diff-hard':d==='medium'?'diff-medium':'diff-easy';
  },

  highlightOptions({ chosenIndex, correctIndex, isCorrect }) {
    document.querySelectorAll('.opt-btn').forEach(b => b.disabled=true);
    if (chosenIndex>=0) {
      const b=document.getElementById(`opt-${chosenIndex}`);
      if(b) b.classList.add(isCorrect?'correct':'wrong');
    }
    if (!isCorrect && correctIndex>=0) {
      const b=document.getElementById(`opt-${correctIndex}`);
      if(b) b.classList.add('correct');
    }
    for(let i=0;i<4;i++){
      if(i!==chosenIndex&&i!==correctIndex){
        const b=document.getElementById(`opt-${i}`);
        if(b) b.classList.add('dimmed');
      }
    }
  },

  updateHUD(score, lives, streak, qNum, total) {
    const sd=document.getElementById('score-display');
    const hd=document.getElementById('hearts-display');
    const sb=document.getElementById('streak-badge');
    const xf=document.getElementById('xp-fill');
    const xc=document.getElementById('xp-count');
    const max = window._sagaConfig?.mechanics?.lives||3;
    if(sd) sd.textContent=score;
    if(hd) hd.innerHTML=this.buildHearts(lives,max);
    if(sb){ sb.textContent=`${streak>0?'🔥 ':''}STREAK: ${streak}`; sb.className=`streak-badge${streak>0?' active':''}`; }
    if(xf) xf.style.width=Math.round(qNum/total*100)+'%';
    if(xc) xc.textContent=`${qNum}/${total}`;
  },

  updateQuestion(q, qNum, total) {
    const qn=document.getElementById('q-number');
    const qt=document.getElementById('q-text');
    const qh=document.getElementById('q-hint');
    const qd=document.getElementById('q-diff');
    const og=document.getElementById('options-grid');
    if(qn) qn.textContent=`QUESTION ${qNum} OF ${total}`;
    if(qt) qt.textContent=q.question;
    if(qh) qh.innerHTML=`<span class="hint-icon">◈</span>${q.hint||''}`;
    if(qd){ qd.textContent=(q.difficulty||'easy').toUpperCase(); qd.className=`q-diff ${this.diffClass(q.difficulty)}`; }
    if(og) og.innerHTML=this.buildOptions(q);
  },

  setFeedback(msg, type) {
    const fb=document.getElementById('feedback');
    if(fb){ fb.className=`feedback-bar ${type}`; fb.textContent=msg; }
  },
  clearFeedback() {
    const fb=document.getElementById('feedback');
    if(fb){ fb.className='feedback-bar'; fb.textContent='Choose the correct answer to proceed.'; }
  },
  animateScore() {
    const sd=document.getElementById('score-display');
    if(sd){ sd.classList.remove('bump'); void sd.offsetWidth; sd.classList.add('bump'); }
  },
  shakeCard() {
    const c=document.getElementById('q-card');
    if(!c) return;
    c.style.transform='translateX(-6px)';
    setTimeout(()=>{c.style.transform='translateX(6px)';},80);
    setTimeout(()=>{c.style.transform='translateX(-4px)';},160);
    setTimeout(()=>{c.style.transform='translateX(0)';},240);
  },

  startTimer() {
    this.stopTimer();
    this.timeLeft=this.timerDuration; this.updateTimerUI();
    this.timerInterval=setInterval(()=>{
      this.timeLeft--; this.updateTimerUI();
      if(this.timeLeft<=0){ this.stopTimer(); MessageBus.emit('answer:submit',{answer:'__timeout__',optionIndex:-1}); }
    },1000);
  },
  stopTimer() { if(this.timerInterval){clearInterval(this.timerInterval);this.timerInterval=null;} },
  updateTimerUI() {
    const f=document.getElementById('timer-fill');
    const n=document.getElementById('timer-num');
    const pct=(this.timeLeft/this.timerDuration)*100;
    const c=pct>60?'#00d4ff':pct>30?'#ffd700':'#ff4466';
    if(f){f.style.width=pct+'%';f.style.background=c;}
    if(n){n.textContent=`${this.timeLeft}s`;n.style.color=c;}
  }
};

export default NeuronRush;