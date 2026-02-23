// ========================================
// Pomodoro Timer App
// ========================================

const CIRCUMFERENCE = 2 * Math.PI * 88; // ~553
const IDLING_DURATION = 60; // 1 minute
const SHORT_BREAK_DURATION = 60; // 1 minute
const AUTO_TRANSITION_DELAY = 5; // seconds

const State = {
  READY: 'ready',
  IDLING: 'idling',
  IDLING_DONE: 'idling_done',
  WORKING: 'working',
  SHORT_BREAK: 'short_break',
  BREAK: 'break',
};

class PomodoroApp {
  constructor() {
    this.state = State.READY;
    this.timerInterval = null;
    this.startTime = null;
    this.autoTransitionTimer = null;
    this.workStartTime = null;
    this.currentSessionWork = 0;

    this.settings = this.loadSettings();
    this.history = this.loadHistory();

    this.audioCtx = null;

    this.cacheElements();
    this.bindEvents();
    this.applySettings();
    this.render();
  }

  // ----------------------------------------
  // DOM
  // ----------------------------------------
  cacheElements() {
    this.phaseLabel = document.getElementById('phase-label');
    this.phaseSub = document.getElementById('phase-sub');
    this.timerTime = document.getElementById('timer-time');
    this.timerSub = document.getElementById('timer-sub');
    this.progressRing = document.getElementById('progress-ring');
    this.actions = document.getElementById('actions');
    this.navBtns = document.querySelectorAll('.nav-btn');
    this.views = document.querySelectorAll('.view');

    // Settings
    this.soundToggle = document.getElementById('sound-toggle');
    this.autoTransitionToggle = document.getElementById('auto-transition-toggle');
    this.btnResetHistory = document.getElementById('btn-reset-history');
  }

  bindEvents() {
    // Navigation
    this.navBtns.forEach((btn) => {
      btn.addEventListener('click', () => this.switchView(btn.dataset.view));
    });

    // Settings
    this.soundToggle.addEventListener('change', () => {
      this.settings.sound = this.soundToggle.checked;
      this.saveSettings();
    });

    this.autoTransitionToggle.addEventListener('change', () => {
      this.settings.autoTransition = this.autoTransitionToggle.checked;
      this.saveSettings();
    });

    this.btnResetHistory.addEventListener('click', () => {
      if (confirm('すべての作業履歴を削除しますか？')) {
        this.history = { sessions: [] };
        this.saveHistory();
        this.renderDashboard();
      }
    });

    // Save work on page unload
    window.addEventListener('beforeunload', () => {
      this.saveCurrentWork();
    });

    // Handle visibility change for timer accuracy
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.timerInterval) {
        this.tick();
      }
    });
  }

  applySettings() {
    this.soundToggle.checked = this.settings.sound;
    this.autoTransitionToggle.checked = this.settings.autoTransition;
  }

  // ----------------------------------------
  // View switching
  // ----------------------------------------
  switchView(viewName) {
    this.navBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    this.views.forEach((view) => {
      view.classList.toggle('active', view.id === `${viewName}-view`);
    });

    if (viewName === 'dashboard') {
      this.renderDashboard();
    }

    // Initialize ads in the newly visible view
    this.pushAds(viewName);
  }

  pushAds(viewName) {
    if (viewName === 'timer') return;
    try {
      const view = document.getElementById(`${viewName}-view`);
      const ins = view && view.querySelector('.adsbygoogle');
      if (ins && !ins.dataset.adsbygoogleStatus) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (e) {
      // Ad blocker or not loaded
    }
  }

  // ----------------------------------------
  // State Machine
  // ----------------------------------------
  transition(newState) {
    const prevState = this.state;

    // Save work when leaving working state
    if (prevState === State.WORKING) {
      this.saveCurrentWork();
    }

    this.clearTimers();
    this.state = newState;

    switch (newState) {
      case State.READY:
        this.enterReady();
        break;
      case State.IDLING:
        this.enterIdling();
        break;
      case State.IDLING_DONE:
        this.enterIdlingDone();
        break;
      case State.WORKING:
        this.enterWorking();
        break;
      case State.SHORT_BREAK:
        this.enterShortBreak();
        break;
      case State.BREAK:
        this.enterBreak();
        break;
    }
  }

  // ----------------------------------------
  // State: READY
  // ----------------------------------------
  enterReady() {
    this.setPhase('準備完了', 'スタートボタンを押して始めよう', 'ready');
    this.setTimerDisplay('1:00');
    this.setTimerSub('');
    this.setProgress(0, 'var(--color-ready)');
    this.progressRing.classList.remove('pulse');

    this.setActions(`
      <button class="btn btn-primary" onclick="app.onStart()">スタート</button>
    `);
  }

  // ----------------------------------------
  // State: IDLING
  // ----------------------------------------
  enterIdling() {
    this.initAudio();
    this.setPhase('アイドリング', '1分だけ頑張ろう！', 'idling');
    this.setTimerSub('');
    this.setProgress(0, 'var(--color-idling)');
    this.progressRing.classList.remove('pulse');
    this.setActions('');

    this.startTime = Date.now();
    this.timerInterval = setInterval(() => this.tick(), 100);
  }

  // ----------------------------------------
  // State: IDLING_DONE
  // ----------------------------------------
  enterIdlingDone() {
    this.playBeep(880, 0.12);
    setTimeout(() => this.playBeep(1100, 0.12), 150);

    this.setPhase('アイドリング完了', '', 'idling');
    this.setTimerDisplay('0:00');
    this.setProgress(1, 'var(--color-idling)');

    if (this.settings.autoTransition) {
      this.autoTransitionCountdown = AUTO_TRANSITION_DELAY;
      this.phaseSub.textContent = `${this.autoTransitionCountdown}秒後に自動で作業に移行`;

      this.setActions(`
        <button class="btn btn-idling" onclick="app.onContinue()">続行</button>
        <button class="btn btn-secondary" onclick="app.onShortBreak()">1分休憩</button>
      `);

      this.autoTransitionTimer = setInterval(() => {
        this.autoTransitionCountdown--;
        if (this.autoTransitionCountdown <= 0) {
          this.transition(State.WORKING);
        } else {
          this.phaseSub.textContent = `${this.autoTransitionCountdown}秒後に自動で作業に移行`;
        }
      }, 1000);
    } else {
      this.setActions(`
        <button class="btn btn-idling" onclick="app.onContinue()">続行</button>
        <button class="btn btn-secondary" onclick="app.onShortBreak()">1分休憩</button>
      `);
    }
  }

  // ----------------------------------------
  // State: WORKING
  // ----------------------------------------
  enterWorking() {
    this.setPhase('作業中', '集中！疲れたら休憩ボタンを押そう', 'working');
    this.setTimerSub('');
    this.setProgress(1, 'var(--color-working)');
    this.progressRing.classList.add('pulse');

    this.workStartTime = Date.now();
    this.startTime = Date.now();

    this.setActions(`
      <button class="btn btn-break" onclick="app.onBreak()">休憩する</button>
    `);

    this.timerInterval = setInterval(() => this.tick(), 1000);
  }

  // ----------------------------------------
  // State: SHORT_BREAK
  // ----------------------------------------
  enterShortBreak() {
    this.setPhase('小休憩', 'リフレッシュ...', 'break');
    this.setTimerSub('');
    this.setProgress(1, 'var(--color-break)');
    this.progressRing.classList.remove('pulse');
    this.setActions('');

    this.startTime = Date.now();
    this.timerInterval = setInterval(() => this.tick(), 100);
  }

  // ----------------------------------------
  // State: BREAK
  // ----------------------------------------
  enterBreak() {
    this.setPhase('休憩中', 'ゆっくり休もう', 'break');
    this.setTimerSub('');
    this.setProgress(0, 'var(--color-break)');
    this.progressRing.classList.remove('pulse');

    this.startTime = Date.now();

    this.setActions(`
      <button class="btn btn-break" onclick="app.onEndBreak()">休憩終了</button>
    `);

    this.timerInterval = setInterval(() => this.tick(), 1000);
  }

  // ----------------------------------------
  // Timer tick
  // ----------------------------------------
  tick() {
    if (!this.startTime) return;
    const elapsed = (Date.now() - this.startTime) / 1000;

    switch (this.state) {
      case State.IDLING: {
        const remaining = Math.max(0, IDLING_DURATION - elapsed);
        const progress = Math.min(1, elapsed / IDLING_DURATION);
        this.setTimerDisplay(this.formatTime(Math.ceil(remaining)));
        this.setProgress(progress, 'var(--color-idling)');

        if (remaining <= 0) {
          this.transition(State.IDLING_DONE);
        }
        break;
      }

      case State.WORKING: {
        this.setTimerDisplay(this.formatTime(Math.floor(elapsed)));
        break;
      }

      case State.SHORT_BREAK: {
        const remaining = Math.max(0, SHORT_BREAK_DURATION - elapsed);
        const progress = 1 - Math.min(1, elapsed / SHORT_BREAK_DURATION);
        this.setTimerDisplay(this.formatTime(Math.ceil(remaining)));
        this.setProgress(progress, 'var(--color-break)');

        if (remaining <= 0) {
          this.playBeep(660, 0.1);
          this.transition(State.IDLING);
        }
        break;
      }

      case State.BREAK: {
        this.setTimerDisplay(this.formatTime(Math.floor(elapsed)));
        break;
      }
    }
  }

  // ----------------------------------------
  // User actions
  // ----------------------------------------
  onStart() {
    this.initAudio();
    this.transition(State.IDLING);
  }

  onContinue() {
    this.transition(State.WORKING);
  }

  onShortBreak() {
    this.transition(State.SHORT_BREAK);
  }

  onBreak() {
    this.transition(State.BREAK);
  }

  onEndBreak() {
    this.transition(State.IDLING);
  }

  // ----------------------------------------
  // UI Helpers
  // ----------------------------------------
  setPhase(label, sub, phase) {
    this.phaseLabel.textContent = label;
    this.phaseLabel.className = `phase-label phase-${phase}`;
    this.phaseSub.textContent = sub;
  }

  setTimerDisplay(text) {
    this.timerTime.textContent = text;
  }

  setTimerSub(text) {
    this.timerSub.textContent = text;
  }

  setProgress(fraction, color) {
    const offset = CIRCUMFERENCE * (1 - fraction);
    this.progressRing.style.strokeDashoffset = offset;
    this.progressRing.style.stroke = color;
  }

  setActions(html) {
    this.actions.innerHTML = html;
  }

  render() {
    this.enterReady();
  }

  // ----------------------------------------
  // Timer management
  // ----------------------------------------
  clearTimers() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.autoTransitionTimer) {
      clearInterval(this.autoTransitionTimer);
      this.autoTransitionTimer = null;
    }
    this.startTime = null;
  }

  // ----------------------------------------
  // Audio
  // ----------------------------------------
  initAudio() {
    if (this.audioCtx) return;
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      // Audio not supported
    }
  }

  playBeep(frequency = 800, duration = 0.15) {
    if (!this.settings.sound || !this.audioCtx) return;

    try {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const oscillator = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      const now = this.audioCtx.currentTime;
      gainNode.gain.setValueAtTime(0.25, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch (e) {
      // Ignore audio errors
    }
  }

  // ----------------------------------------
  // Work tracking
  // ----------------------------------------
  saveCurrentWork() {
    if (this.state !== State.WORKING || !this.workStartTime) return;

    const duration = Math.floor((Date.now() - this.workStartTime) / 1000);
    if (duration < 5) return; // Ignore very short sessions

    this.addWorkSession(duration);
    this.workStartTime = null;
  }

  addWorkSession(duration) {
    const now = new Date();
    const session = {
      date: this.getDateString(now),
      duration: duration,
      timestamp: now.getTime(),
    };

    this.history.sessions.push(session);
    this.saveHistory();
  }

  // ----------------------------------------
  // Persistence
  // ----------------------------------------
  loadSettings() {
    try {
      const saved = localStorage.getItem('pomodoro-settings');
      if (saved) {
        return { sound: true, autoTransition: true, ...JSON.parse(saved) };
      }
    } catch (e) {
      // Ignore
    }
    return { sound: true, autoTransition: true };
  }

  saveSettings() {
    try {
      localStorage.setItem('pomodoro-settings', JSON.stringify(this.settings));
    } catch (e) {
      // Ignore
    }
  }

  loadHistory() {
    try {
      const saved = localStorage.getItem('pomodoro-history');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      // Ignore
    }
    return { sessions: [] };
  }

  saveHistory() {
    try {
      localStorage.setItem('pomodoro-history', JSON.stringify(this.history));
    } catch (e) {
      // Ignore
    }
  }

  // ----------------------------------------
  // Dashboard
  // ----------------------------------------
  renderDashboard() {
    const today = this.getDateString(new Date());

    // Today's stats
    const todaySessions = this.history.sessions.filter((s) => s.date === today);
    const todayTotal = todaySessions.reduce((sum, s) => sum + s.duration, 0);
    const totalAll = this.history.sessions.reduce((sum, s) => sum + s.duration, 0);

    document.getElementById('today-time').textContent = this.formatDuration(todayTotal);
    document.getElementById('today-sessions').textContent = todaySessions.length;
    document.getElementById('total-time').textContent = this.formatDuration(totalAll);

    // Bar chart
    this.renderBarChart(today);

    // Session list
    this.renderSessionList(todaySessions);
  }

  renderBarChart(today) {
    const chartEl = document.getElementById('bar-chart');
    const weekData = this.getWeeklyData();
    const maxDuration = Math.max(...weekData.map((d) => d.duration), 1);

    chartEl.innerHTML = weekData
      .map((day) => {
        const heightPct = Math.max(1, (day.duration / maxDuration) * 100);
        const isToday = day.date === today;
        const value = day.duration > 0 ? this.formatShortDuration(day.duration) : '';

        return `
        <div class="bar-item">
          <span class="bar-value">${value}</span>
          <div class="bar ${isToday ? 'today' : ''}" style="height: ${heightPct}%"></div>
          <span class="bar-label ${isToday ? 'today-label' : ''}">${day.label}</span>
        </div>
      `;
      })
      .join('');
  }

  renderSessionList(sessions) {
    const listEl = document.getElementById('session-list');

    if (sessions.length === 0) {
      listEl.innerHTML = '<div class="no-sessions">まだセッションがありません</div>';
      return;
    }

    // Show most recent first
    const sorted = [...sessions].sort((a, b) => b.timestamp - a.timestamp);

    listEl.innerHTML = sorted
      .map((s) => {
        const time = new Date(s.timestamp);
        const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;

        return `
        <div class="session-item">
          <span class="session-time">${timeStr}</span>
          <span class="session-duration">${this.formatDuration(s.duration)}</span>
        </div>
      `;
      })
      .join('');
  }

  getWeeklyData() {
    const days = [];
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = this.getDateString(date);
      const dayTotal = this.history.sessions
        .filter((s) => s.date === dateStr)
        .reduce((sum, s) => sum + s.duration, 0);

      days.push({
        date: dateStr,
        label: `${date.getMonth() + 1}/${date.getDate()}(${dayNames[date.getDay()]})`,
        duration: dayTotal,
      });
    }
    return days;
  }

  // ----------------------------------------
  // Formatters
  // ----------------------------------------
  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  formatDuration(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  formatShortDuration(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    if (h > 0) return `${h}h${m}m`;
    return `${m}m`;
  }

  getDateString(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}

// ========================================
// Initialize
// ========================================
const app = new PomodoroApp();
