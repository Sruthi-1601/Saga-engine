// MirrorMatch.js — Card flip matching game
import MessageBus from './MessageBus.js';

const MirrorMatch = {
  pairs: [],
  cards: [],
  flipped: [],
  matched: [],
  score: 0,
  moves: 0,
  lockBoard: false,
  startTime: null,
  timerInterval: null,

  init() {
    MessageBus.on('mirror:start', d => this.onStart(d));
  },

  onStart(data) {
    this.pairs   = data.pairs;
    this.score   = 0;
    this.moves   = 0;
    this.matched = [];
    this.flipped = [];
    this.lockBoard = false;
    this.startTime = Date.now();
    this.cards = this.buildCards(data.pairs);
    this.render(data.config);
    this.startClock();
  },

  buildCards(pairs) {
    const cards = [];
    pairs.forEach((p, i) => {
      cards.push({ id: `t${i}`, type: 'term',       text: p.term,       pairId: i });
      cards.push({ id: `d${i}`, type: 'definition', text: p.definition, pairId: i });
    });
    // Shuffle
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  },

  render(config) {
    document.getElementById('app').innerHTML = `
      <div class="game-wrap fade-in">

        <div class="hud">
          <div class="hud-left">
            <div class="hud-title">${config?.metadata?.title || 'MirrorMatch'}</div>
            <div class="hud-meta">MirrorMatch &middot; Vocabulary</div>
          </div>
          <div class="hud-center">
            <div class="score-label">SCORE</div>
            <div class="score-display" id="mm-score">0</div>
          </div>
          <div class="hud-right">
            <div style="text-align:right">
              <div class="score-label">MOVES</div>
              <div class="score-display" id="mm-moves" style="font-size:20px;color:#aa44ff">0</div>
            </div>
          </div>
        </div>

        <div class="mm-info">
          <span class="mm-badge" id="mm-matched">0/${this.pairs.length} matched</span>
          <span class="mm-timer" id="mm-clock">00:00</span>
        </div>

        <div class="mm-grid" id="mm-grid">
          ${this.cards.map(card => `
            <div class="mm-card" id="card-${card.id}" data-id="${card.id}" onclick="window.sagaFlip('${card.id}')">
              <div class="mm-card-inner">
                <div class="mm-card-front">
                  <span class="mm-card-icon">${card.type==='term'?'◆':'◇'}</span>
                </div>
                <div class="mm-card-back ${card.type}">
                  <span class="mm-card-text">${card.text}</span>
                </div>
              </div>
            </div>`).join('')}
        </div>

        <div class="feedback-bar" id="mm-feedback">
          Flip cards to match terms with their definitions.
        </div>

      </div>`;
  },

  flip(cardId) {
    if (this.lockBoard) return;
    if (this.matched.includes(cardId)) return;
    if (this.flipped.includes(cardId)) return;
    if (this.flipped.length >= 2) return;

    const cardEl = document.getElementById(`card-${cardId}`);
    if (!cardEl) return;
    cardEl.classList.add('flipped');
    this.flipped.push(cardId);

    if (this.flipped.length === 2) {
      this.moves++;
      const mm = document.getElementById('mm-moves');
      if (mm) mm.textContent = this.moves;
      this.checkMatch();
    }
  },

  checkMatch() {
    this.lockBoard = true;
    const [id1, id2] = this.flipped;
    const c1 = this.cards.find(c => c.id === id1);
    const c2 = this.cards.find(c => c.id === id2);

    if (c1.pairId === c2.pairId && c1.type !== c2.type) {
      // Match!
      this.score += 20;
      this.matched.push(id1, id2);
      const fb = document.getElementById('mm-feedback');
      if (fb) { fb.className = 'feedback-bar correct'; fb.textContent = `✦ Match! "${c1.type==='term'?c1.text:c2.text}" = correct!`; }

      document.getElementById(`card-${id1}`)?.classList.add('matched');
      document.getElementById(`card-${id2}`)?.classList.add('matched');

      const sm = document.getElementById('mm-score');
      const mt = document.getElementById('mm-matched');
      if (sm) sm.textContent = this.score;
      if (mt) mt.textContent = `${this.matched.length/2}/${this.pairs.length} matched`;

      this.flipped = [];
      this.lockBoard = false;

      if (this.matched.length === this.cards.length) {
        this.stopClock();
        setTimeout(() => MessageBus.emit('match:complete', { score: this.score }), 800);
      }
    } else {
      // No match
      const fb = document.getElementById('mm-feedback');
      if (fb) { fb.className = 'feedback-bar wrong'; fb.textContent = `✕ Not a match — try again!`; }
      setTimeout(() => {
        document.getElementById(`card-${id1}`)?.classList.remove('flipped');
        document.getElementById(`card-${id2}`)?.classList.remove('flipped');
        this.flipped = [];
        this.lockBoard = false;
        const fb2 = document.getElementById('mm-feedback');
        if (fb2) { fb2.className = 'feedback-bar'; fb2.textContent = 'Flip cards to match terms with their definitions.'; }
      }, 1000);
    }
  },

  startClock() {
    this.stopClock();
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const m = String(Math.floor(elapsed/60)).padStart(2,'0');
      const s = String(elapsed%60).padStart(2,'0');
      const el = document.getElementById('mm-clock');
      if (el) el.textContent = `${m}:${s}`;
    }, 1000);
  },

  stopClock() {
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
  }
};

export default MirrorMatch;