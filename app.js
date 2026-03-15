// ========================================
// Pomodoro Timer App
// ========================================

const CIRCUMFERENCE = 2 * Math.PI * 88; // ~553
const IDLING_DURATION = 60; // 1 minute
const SHORT_BREAK_DURATION = 60; // 1 minute
const AUTO_TRANSITION_DELAY = 5; // seconds
const IDLING_TICK_INTERVAL_MS = 100; // ms tick interval for idling/short-break
const AUDIO_VOLUME = 0.25; // beep volume
const MIN_SESSION_DURATION = 5; // seconds, ignore sessions shorter than this

// Action map for safe PiP button delegation (replaces new Function / eval)
const PIP_ACTIONS = {
  start: 'onStart',
  continue: 'onContinue',
  shortBreak: 'onShortBreak',
  break: 'onBreak',
  endBreak: 'onEndBreak',
};

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
    this.pipWindow = null;

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

    // PiP
    this.pipBtn = document.getElementById('pip-btn');
    if ('documentPictureInPicture' in window) {
      this.pipBtn.classList.add('supported');
    }

    // Export/Import
    this.btnExport = document.getElementById('btn-export');
    this.btnImport = document.getElementById('btn-import');
    this.importFile = document.getElementById('import-file');

    // Screen reader announcement region
    this.phaseAnnounce = document.getElementById('phase-announce');
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

    // Action delegation for data-action buttons (main document)
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const method = PIP_ACTIONS[btn.dataset.action];
      if (method && typeof this[method] === 'function') {
        this[method]();
      }
    });

    // PiP
    this.pipBtn.addEventListener('click', () => this.openPiP());

    // Export/Import
    this.btnExport.addEventListener('click', () => this.exportHistory());
    this.btnImport.addEventListener('click', () => this.importFile.click());
    this.importFile.addEventListener('change', (e) => this.importHistory(e));

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ignore when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.handleKeySpace();
      } else if (e.code === 'KeyR' && !e.shiftKey) {
        e.preventDefault();
        this.handleKeyReset();
      } else if (e.code === 'KeyS' && !e.shiftKey) {
        e.preventDefault();
        this.handleKeySkip();
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
      <button class="btn btn-primary" data-action="start">スタート</button>
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
    this.timerInterval = setInterval(() => this.tick(), IDLING_TICK_INTERVAL_MS);
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
        <button class="btn btn-idling" data-action="continue">続行</button>
        <button class="btn btn-secondary" data-action="shortBreak">1分休憩</button>
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
        <button class="btn btn-idling" data-action="continue">続行</button>
        <button class="btn btn-secondary" data-action="shortBreak">1分休憩</button>
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
      <button class="btn btn-break" data-action="break">休憩する</button>
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
    this.timerInterval = setInterval(() => this.tick(), IDLING_TICK_INTERVAL_MS);
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
      <button class="btn btn-break" data-action="endBreak">休憩終了</button>
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

    // Announce phase change to screen readers
    if (this.phaseAnnounce) {
      this.phaseAnnounce.textContent = `${label}${sub ? ' - ' + sub : ''}`;
    }

    if (this.pipWindow && !this.pipWindow.closed) {
      const doc = this.pipWindow.document;
      const el = doc.getElementById('pip-phase');
      if (el) {
        el.textContent = label;
        el.className = `pip-phase phase-${phase}`;
      }
    }
  }

  setTimerDisplay(text) {
    this.timerTime.textContent = text;

    if (this.pipWindow && !this.pipWindow.closed) {
      const el = this.pipWindow.document.getElementById('pip-time');
      if (el) el.textContent = text;
    }
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

    if (this.pipWindow && !this.pipWindow.closed) {
      const el = this.pipWindow.document.getElementById('pip-actions');
      if (el) el.innerHTML = html;
    }
  }

  render() {
    this.enterReady();
  }

  // ----------------------------------------
  // Picture-in-Picture
  // ----------------------------------------
  async openPiP() {
    if (!('documentPictureInPicture' in window)) return;

    // Close existing PiP window
    if (this.pipWindow && !this.pipWindow.closed) {
      this.pipWindow.close();
      this.pipWindow = null;
      return;
    }

    try {
      this.pipWindow = await documentPictureInPicture.requestWindow({
        width: 300,
        height: 200,
      });

      const pipDoc = this.pipWindow.document;

      // Inject styles
      const style = pipDoc.createElement('style');
      style.textContent = `
        :root {
          --color-idling: #f59e0b;
          --color-working: #ef4444;
          --color-break: #06b6d4;
          --color-ready: #6366f1;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #0f0f1a;
          color: #e8e8ec;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          gap: 12px;
          overflow: hidden;
          user-select: none;
        }
        .pip-phase {
          font-size: 14px;
          font-weight: 700;
        }
        .phase-ready { color: var(--color-ready); }
        .phase-idling { color: var(--color-idling); }
        .phase-working { color: var(--color-working); }
        .phase-break { color: var(--color-break); }
        .pip-time {
          font-size: 48px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          letter-spacing: -1px;
        }
        .pip-actions {
          display: flex;
          gap: 8px;
          justify-content: center;
          flex-wrap: wrap;
          min-height: 36px;
          align-items: center;
        }
        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          color: white;
          white-space: nowrap;
        }
        .btn:active { transform: scale(0.96); }
        .btn-primary { background: var(--color-ready); }
        .btn-idling { background: var(--color-idling); }
        .btn-working { background: var(--color-working); }
        .btn-break { background: var(--color-break); }
        .btn-secondary {
          background: #1a1a2e;
          color: #e8e8ec;
          border: 1px solid rgba(255,255,255,0.1);
        }
      `;
      pipDoc.head.appendChild(style);

      // Build content
      const currentPhase = this.phaseLabel.className.replace('phase-label ', '');
      pipDoc.body.innerHTML = `
        <div id="pip-phase" class="pip-phase ${currentPhase}">${this.phaseLabel.textContent}</div>
        <div id="pip-time" class="pip-time">${this.timerTime.textContent}</div>
        <div id="pip-actions" class="pip-actions">${this.actions.innerHTML}</div>
      `;

      // Wire up button clicks in PiP using safe data-action delegation
      pipDoc.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const method = PIP_ACTIONS[btn.dataset.action];
        if (method && typeof this[method] === 'function') {
          this[method]();
        }
      });

      // Cleanup on PiP close
      this.pipWindow.addEventListener('pagehide', () => {
        this.pipWindow = null;
      });
    } catch (e) {
      console.warn('PiP request failed:', e.message);
    }
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
      console.warn('Audio init failed:', e.message);
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
      gainNode.gain.setValueAtTime(AUDIO_VOLUME, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch (e) {
      console.warn('Audio playback failed:', e.message);
    }
  }

  // ----------------------------------------
  // Work tracking
  // ----------------------------------------
  saveCurrentWork() {
    if (this.state !== State.WORKING || !this.workStartTime) return;

    // Prevent double-save (beforeunload + transition both calling this)
    const workStart = this.workStartTime;
    if (this._lastSavedWorkStart === workStart) return;

    const duration = Math.floor((Date.now() - workStart) / 1000);
    if (duration < MIN_SESSION_DURATION) return;

    this._lastSavedWorkStart = workStart;
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
    const defaults = { sound: true, autoTransition: true };
    try {
      const saved = localStorage.getItem('pomodoro-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed !== 'object' || parsed === null ||
            typeof parsed.sound !== 'boolean' || typeof parsed.autoTransition !== 'boolean') {
          console.warn('Invalid settings data, resetting to defaults');
          return { ...defaults };
        }
        return { ...defaults, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load settings:', e.message);
    }
    return { ...defaults };
  }

  saveSettings() {
    try {
      localStorage.setItem('pomodoro-settings', JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Failed to save settings:', e.message);
    }
  }

  loadHistory() {
    try {
      const saved = localStorage.getItem('pomodoro-history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.sessions)) {
          console.warn('Invalid history data, resetting to defaults');
          return { sessions: [] };
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to load history:', e.message);
    }
    return { sessions: [] };
  }

  saveHistory() {
    try {
      localStorage.setItem('pomodoro-history', JSON.stringify(this.history));
    } catch (e) {
      console.warn('Failed to save history:', e.message);
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

    // Focus pattern analysis
    this.renderStatsSummary();
    this.renderTimeOfDayChart();
    this.renderDayOfWeekChart();
    this.renderBestTime();

    // Session list
    this.renderSessionList(todaySessions);
  }

  // ----------------------------------------
  // Focus Pattern Analysis
  // ----------------------------------------
  getTimeSlot(hour) {
    if (hour >= 5 && hour < 12) return 0;  // 朝 (5-11)
    if (hour >= 12 && hour < 14) return 1; // 昼 (12-13)
    if (hour >= 14 && hour < 18) return 2; // 午後 (14-17)
    return 3;                               // 夜 (18-4)
  }

  getTimeSlotLabel(index) {
    const labels = ['朝(5-11時)', '昼(12-13時)', '午後(14-17時)', '夜(18-4時)'];
    return labels[index];
  }

  getTimeOfDayData() {
    const slots = [
      { label: '朝(5-11時)', totalDuration: 0, count: 0 },
      { label: '昼(12-13時)', totalDuration: 0, count: 0 },
      { label: '午後(14-17時)', totalDuration: 0, count: 0 },
      { label: '夜(18-4時)', totalDuration: 0, count: 0 },
    ];

    for (const session of this.history.sessions) {
      if (!session.timestamp) continue;
      const hour = new Date(session.timestamp).getHours();
      const slotIndex = this.getTimeSlot(hour);
      slots[slotIndex].totalDuration += session.duration;
      slots[slotIndex].count += 1;
    }

    return slots.map((slot) => ({
      label: slot.label,
      avgDuration: slot.count > 0 ? Math.round(slot.totalDuration / slot.count) : 0,
      count: slot.count,
    }));
  }

  getDayOfWeekData() {
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const days = dayNames.map((name) => ({
      label: name,
      totalDuration: 0,
      count: 0,
    }));

    for (const session of this.history.sessions) {
      if (!session.timestamp) continue;
      const dayIndex = new Date(session.timestamp).getDay();
      days[dayIndex].totalDuration += session.duration;
      days[dayIndex].count += 1;
    }

    return days.map((day) => ({
      label: day.label,
      avgDuration: day.count > 0 ? Math.round(day.totalDuration / day.count) : 0,
      count: day.count,
    }));
  }

  getStatsSummary() {
    const sessions = this.history.sessions;
    const totalSessions = sessions.length;

    if (totalSessions === 0) {
      return {
        totalSessions: 0,
        avgDuration: 0,
        maxDuration: 0,
        weekComparison: null,
      };
    }

    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
    const avgDuration = Math.round(totalDuration / totalSessions);
    const maxDuration = Math.max(...sessions.map((s) => s.duration));

    // This week vs last week
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = todayStart.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const thisWeekStart = new Date(todayStart);
    thisWeekStart.setDate(todayStart.getDate() - mondayOffset);
    const thisWeekStartMs = thisWeekStart.getTime();

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekStartMs = lastWeekStart.getTime();

    const thisWeekTotal = sessions
      .filter((s) => s.timestamp >= thisWeekStartMs)
      .reduce((sum, s) => sum + s.duration, 0);

    const lastWeekTotal = sessions
      .filter((s) => s.timestamp >= lastWeekStartMs && s.timestamp < thisWeekStartMs)
      .reduce((sum, s) => sum + s.duration, 0);

    let weekComparison = null;
    if (lastWeekTotal > 0) {
      const changePercent = Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100);
      weekComparison = { thisWeek: thisWeekTotal, lastWeek: lastWeekTotal, changePercent };
    } else if (thisWeekTotal > 0) {
      weekComparison = { thisWeek: thisWeekTotal, lastWeek: 0, changePercent: null };
    }

    return { totalSessions, avgDuration, maxDuration, weekComparison };
  }

  getBestTime() {
    const timeData = this.getTimeOfDayData();
    const dayData = this.getDayOfWeekData();

    const validTime = timeData.filter((t) => t.count >= 1);
    const validDay = dayData.filter((d) => d.count >= 1);

    if (validTime.length === 0 || validDay.length === 0) {
      return null;
    }

    const bestTimeSlot = validTime.reduce((best, cur) =>
      cur.avgDuration > best.avgDuration ? cur : best
    );

    const bestDay = validDay.reduce((best, cur) =>
      cur.avgDuration > best.avgDuration ? cur : best
    );

    return { timeSlot: bestTimeSlot, day: bestDay };
  }

  renderStatsSummary() {
    const stats = this.getStatsSummary();

    document.getElementById('total-sessions').textContent = stats.totalSessions;
    document.getElementById('avg-session-time').textContent =
      stats.avgDuration > 0 ? this.formatShortDuration(stats.avgDuration) : '0m';
    document.getElementById('max-session-time').textContent =
      stats.maxDuration > 0 ? this.formatShortDuration(stats.maxDuration) : '0m';

    const weekEl = document.getElementById('week-comparison');
    if (stats.weekComparison) {
      if (stats.weekComparison.changePercent !== null) {
        const sign = stats.weekComparison.changePercent >= 0 ? '+' : '';
        weekEl.textContent = `${sign}${stats.weekComparison.changePercent}%`;
        weekEl.className = `stat-value ${stats.weekComparison.changePercent >= 0 ? 'stat-positive' : 'stat-negative'}`;
      } else {
        weekEl.textContent = this.formatShortDuration(stats.weekComparison.thisWeek);
        weekEl.className = 'stat-value';
      }
    } else {
      weekEl.textContent = '--';
      weekEl.className = 'stat-value';
    }
  }

  renderTimeOfDayChart() {
    const chartEl = document.getElementById('time-of-day-chart');
    const data = this.getTimeOfDayData();
    const maxAvg = Math.max(...data.map((d) => d.avgDuration), 1);

    chartEl.innerHTML = data
      .map((slot) => {
        const heightPct = Math.max(1, (slot.avgDuration / maxAvg) * 100);
        const value = slot.avgDuration > 0 ? this.formatShortDuration(slot.avgDuration) : '';

        return `
        <div class="bar-item">
          <span class="bar-value">${value}</span>
          <div class="bar bar-pattern" style="height: ${heightPct}%"></div>
          <span class="bar-label">${slot.label}</span>
        </div>
      `;
      })
      .join('');
  }

  renderDayOfWeekChart() {
    const chartEl = document.getElementById('day-of-week-chart');
    const data = this.getDayOfWeekData();
    const maxAvg = Math.max(...data.map((d) => d.avgDuration), 1);

    chartEl.innerHTML = data
      .map((day) => {
        const heightPct = Math.max(1, (day.avgDuration / maxAvg) * 100);
        const value = day.avgDuration > 0 ? this.formatShortDuration(day.avgDuration) : '';

        return `
        <div class="bar-item">
          <span class="bar-value">${value}</span>
          <div class="bar bar-pattern" style="height: ${heightPct}%"></div>
          <span class="bar-label">${day.label}</span>
        </div>
      `;
      })
      .join('');
  }

  renderBestTime() {
    const msgEl = document.getElementById('best-time-message');
    const best = this.getBestTime();

    if (!best) {
      msgEl.textContent = 'データが不足しています。セッションを重ねると分析結果が表示されます。';
      return;
    }

    msgEl.textContent =
      `あなたのベストタイムは${best.day.label}曜日の${best.timeSlot.label}です！` +
      `（平均${this.formatShortDuration(best.timeSlot.avgDuration)}/セッション）`;
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

  // ----------------------------------------
  // Keyboard shortcuts
  // ----------------------------------------
  handleKeySpace() {
    switch (this.state) {
      case State.READY:
        this.onStart();
        break;
      case State.IDLING_DONE:
        this.onContinue();
        break;
    }
  }

  handleKeyReset() {
    this.transition(State.READY);
  }

  handleKeySkip() {
    switch (this.state) {
      case State.IDLING:
        this.transition(State.IDLING_DONE);
        break;
      case State.IDLING_DONE:
        this.onContinue();
        break;
      case State.WORKING:
        this.onBreak();
        break;
      case State.SHORT_BREAK:
        this.transition(State.IDLING);
        break;
      case State.BREAK:
        this.onEndBreak();
        break;
    }
  }

  // ----------------------------------------
  // Export / Import
  // ----------------------------------------
  exportHistory() {
    const data = JSON.stringify(this.history, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pomodoro-history-${this.getDateString(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  importHistory(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (!imported || !Array.isArray(imported.sessions)) {
          alert('無効なデータ形式です。');
          return;
        }

        // Merge: avoid duplicates by timestamp
        const existingTimestamps = new Set(
          this.history.sessions.map((s) => s.timestamp)
        );

        let addedCount = 0;
        let skippedCount = 0;
        for (const session of imported.sessions) {
          if (!session.timestamp || !session.duration || !session.date) {
            skippedCount++;
            continue;
          }
          if (!existingTimestamps.has(session.timestamp)) {
            this.history.sessions.push(session);
            existingTimestamps.add(session.timestamp);
            addedCount++;
          }
        }

        this.saveHistory();
        this.renderDashboard();
        const msg = `${addedCount}件のセッションをインポートしました。` +
          (skippedCount > 0 ? `\n${skippedCount}件は不正なデータのためスキップしました。` : '');
        alert(msg);
      } catch (err) {
        alert('JSONの解析に失敗しました: ' + err.message);
      }
    };
    reader.readAsText(file);

    // Reset file input so re-importing the same file triggers change
    event.target.value = '';
  }
}

// ========================================
// Initialize
// ========================================
const app = new PomodoroApp();
