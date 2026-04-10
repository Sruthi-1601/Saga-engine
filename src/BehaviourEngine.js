// BehaviourEngine.js — SAGA Behaviour System
// Tracks player behaviour across ALL game modes via MessageBus.
// Emits behaviour:profile and behaviour:adapt events that game modules
// listen to and use to adjust difficulty, speed, hints, enemy aggression, etc.
//
// Behaviour signals tracked:
//   • accuracy       — correct / total answered
//   • avgResponseMs  — how fast the player answers
//   • streak         — current consecutive correct
//   • hesitationRate — how often player pauses > 5s before answering
//   • missRate       — how often they miss (timeout / missed platform / etc.)
//
// Behaviour levels:
//   'novice'    accuracy < 40%  or avgResponse > 8s
//   'learner'   accuracy 40-65%
//   'skilled'   accuracy 65-85%
//   'expert'    accuracy > 85%  and avgResponse < 4s

import MessageBus from './MessageBus.js';

const BehaviourEngine = {

  // ── internal state ────────────────────────────────────────────────────────
  session: {
    totalAnswered:   0,
    totalCorrect:    0,
    totalMissed:     0,
    responseTimes:   [],   // ms per answer
    hesitations:     0,    // answers where player took > 5s
    streak:          0,
    maxStreak:       0,
    lastQuestionAt:  null, // timestamp when question was shown
    modeHistory:     [],   // which modes played
    level:           'learner',
  },

  // ── computed profile (recalculated after each answer) ────────────────────
  profile: {
    level:           'learner',  // novice | learner | skilled | expert
    accuracy:        0,          // 0–1
    avgResponseMs:   0,          // ms
    hesitationRate:  0,          // 0–1
    missRate:        0,          // 0–1
    streak:          0,
    // Adaptation outputs — read by game modules
    adapt: {
      speedMultiplier:   1.0,   // enemy/bubble/platform speed scale
      hintVisible:       true,  // show/hide hints
      timerSeconds:      30,    // question timer
      enemyAggression:   0.5,   // 0–1 for EnemySurvival
      mazeComplexity:    0.5,   // 0–1 for MazeRunner
      dungeonTrapRate:   0.3,   // 0–1 for DungeonEscape
    }
  },

  init() {
    // Listen to answer events from quiz modes (GameRuntime)
    MessageBus.on('answer:correct', (d) => this._onCorrect(d));
    MessageBus.on('answer:wrong',   (d) => this._onWrong(d));

    // Listen to behaviour:action events from game modes
    MessageBus.on('behaviour:action', (d) => this._onAction(d));

    // When a new question appears, record timestamp
    MessageBus.on('game:start',    () => this._questionShown());
    MessageBus.on('question:next', () => this._questionShown());
    MessageBus.on('gamemode:start',() => this._questionShown());

    // Reset session on new game
    MessageBus.on('game:begin',    () => this._softReset());

    console.log('[BehaviourEngine] ready');
  },

  _questionShown() {
    this.session.lastQuestionAt = Date.now();
  },

  _softReset() {
    // Keep history but reset streak for new game
    this.session.streak = 0;
  },

  _onCorrect(data) {
    const responseMs = this._getResponseTime();
    this.session.totalAnswered++;
    this.session.totalCorrect++;
    this.session.streak = (data.streak || 0);
    this.session.maxStreak = Math.max(this.session.maxStreak, this.session.streak);
    if (responseMs !== null) {
      this.session.responseTimes.push(responseMs);
      if (responseMs > 5000) this.session.hesitations++;
    }
    this._recalculate();
  },

  _onWrong(data) {
    const responseMs = this._getResponseTime();
    this.session.totalAnswered++;
    this.session.streak = 0;
    if (data.timeout || data.missed) this.session.totalMissed++;
    if (responseMs !== null) {
      this.session.responseTimes.push(responseMs);
      if (responseMs > 5000) this.session.hesitations++;
    }
    this._recalculate();
  },

  // Game modes emit this for domain-specific signals
  // e.g. { type: 'platform_missed' } { type: 'enemy_hit' } { type: 'dungeon_trap' }
  _onAction(data) {
    if (data.type === 'missed' || data.type === 'platform_missed' ||
        data.type === 'bubble_missed' || data.type === 'dungeon_trap') {
      this.session.totalMissed++;
      this._recalculate();
    }
  },

  _getResponseTime() {
    if (!this.session.lastQuestionAt) return null;
    return Date.now() - this.session.lastQuestionAt;
  },

  _recalculate() {
    const s = this.session;
    const accuracy        = s.totalAnswered > 0 ? s.totalCorrect / s.totalAnswered : 0;
    const avgResponseMs   = s.responseTimes.length > 0
      ? s.responseTimes.reduce((a, b) => a + b, 0) / s.responseTimes.length
      : 5000;
    const hesitationRate  = s.totalAnswered > 0 ? s.hesitations / s.totalAnswered : 0;
    const missRate        = s.totalAnswered > 0 ? s.totalMissed / s.totalAnswered : 0;

    // Determine level
    let level;
    if      (accuracy > 0.85 && avgResponseMs < 4000) level = 'expert';
    else if (accuracy > 0.65)                          level = 'skilled';
    else if (accuracy > 0.40)                          level = 'learner';
    else                                               level = 'novice';

    // Build adaptation outputs
    const adapt = this._buildAdapt(level, accuracy, avgResponseMs, hesitationRate);

    this.profile = { level, accuracy, avgResponseMs, hesitationRate, missRate, streak: s.streak, adapt };

    MessageBus.emit('behaviour:update', { profile: this.profile });

    // Every 3 answers, emit a full adapt event so game modules can react
    if (s.totalAnswered % 3 === 0) {
      MessageBus.emit('behaviour:adapt', { profile: this.profile });
      console.log(`[BehaviourEngine] Level: ${level} | Accuracy: ${Math.round(accuracy*100)}% | AvgResponse: ${Math.round(avgResponseMs)}ms`);
    }
  },

  _buildAdapt(level, accuracy, avgResponseMs, hesitationRate) {
    // Speed multiplier — faster for experts, slower for novices
    const speedMultiplier = {
      novice:  0.6,
      learner: 0.85,
      skilled: 1.1,
      expert:  1.4,
    }[level];

    // Hints — shown for novice/learner, hidden for skilled/expert
    const hintVisible = level === 'novice' || level === 'learner';

    // Timer — more time for hesitators
    const timerSeconds = hesitationRate > 0.4 ? 40
      : level === 'novice'  ? 35
      : level === 'learner' ? 30
      : level === 'skilled' ? 25
      : 20;

    // Enemy aggression (EnemySurvival)
    const enemyAggression = { novice: 0.25, learner: 0.45, skilled: 0.70, expert: 0.95 }[level];

    // Maze complexity (MazeRunner)
    const mazeComplexity  = { novice: 0.25, learner: 0.45, skilled: 0.65, expert: 0.85 }[level];

    // Dungeon trap rate (DungeonEscape)
    const dungeonTrapRate = { novice: 0.15, learner: 0.30, skilled: 0.50, expert: 0.70 }[level];

    return { speedMultiplier, hintVisible, timerSeconds, enemyAggression, mazeComplexity, dungeonTrapRate };
  },

  // Public getter — game modules can call this any time
  getProfile() {
    return this.profile;
  },

  // Summary string for HUD display
  getLevelBadge() {
    const icons = { novice: '🌱', learner: '📚', skilled: '⚡', expert: '🔥' };
    return `${icons[this.profile.level]} ${this.profile.level.toUpperCase()}`;
  },
};

export default BehaviourEngine;