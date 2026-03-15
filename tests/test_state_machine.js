'use strict';

const assert = require('assert');

// Reproduce the State enum from app.js
const State = {
  READY: 'ready',
  IDLING: 'idling',
  IDLING_DONE: 'idling_done',
  WORKING: 'working',
  SHORT_BREAK: 'short_break',
  BREAK: 'break',
};

// Minimal mock for PomodoroApp to test state transitions
function createMockApp() {
  return {
    state: State.READY,
    timerInterval: null,
    startTime: null,
    autoTransitionTimer: null,
    workStartTime: null,
    currentSessionWork: 0,
    settings: { sound: true, autoTransition: false },
    history: { sessions: [] },
    _lastSavedWorkStart: null,
    _enterCalled: null,

    // Stub DOM/audio methods
    setPhase() {},
    setTimerDisplay() {},
    setTimerSub() {},
    setProgress() {},
    setActions() {},
    playBeep() {},
    initAudio() {},
    saveCurrentWork() {},
    progressRing: { classList: { add() {}, remove() {} } },

    clearTimers() {
      this.timerInterval = null;
      this.autoTransitionTimer = null;
      this.startTime = null;
    },

    enterReady() { this._enterCalled = State.READY; },
    enterIdling() { this._enterCalled = State.IDLING; this.startTime = Date.now(); },
    enterIdlingDone() { this._enterCalled = State.IDLING_DONE; },
    enterWorking() {
      this._enterCalled = State.WORKING;
      this.workStartTime = Date.now();
      this.startTime = Date.now();
    },
    enterShortBreak() { this._enterCalled = State.SHORT_BREAK; this.startTime = Date.now(); },
    enterBreak() { this._enterCalled = State.BREAK; this.startTime = Date.now(); },

    // The real transition logic from app.js
    transition(newState) {
      const prevState = this.state;
      if (prevState === State.WORKING) {
        this.saveCurrentWork();
      }
      this.clearTimers();
      this.state = newState;

      switch (newState) {
        case State.READY: this.enterReady(); break;
        case State.IDLING: this.enterIdling(); break;
        case State.IDLING_DONE: this.enterIdlingDone(); break;
        case State.WORKING: this.enterWorking(); break;
        case State.SHORT_BREAK: this.enterShortBreak(); break;
        case State.BREAK: this.enterBreak(); break;
      }
    },

    // User action methods from app.js
    onStart() { this.initAudio(); this.transition(State.IDLING); },
    onContinue() { this.transition(State.WORKING); },
    onShortBreak() { this.transition(State.SHORT_BREAK); },
    onBreak() { this.transition(State.BREAK); },
    onEndBreak() { this.transition(State.IDLING); },
  };
}

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// --- Tests ---

test('READY -> IDLING transition via onStart', () => {
  const app = createMockApp();
  assert.strictEqual(app.state, State.READY);
  app.onStart();
  assert.strictEqual(app.state, State.IDLING);
  assert.strictEqual(app._enterCalled, State.IDLING);
});

test('IDLING_DONE -> WORKING transition via onContinue', () => {
  const app = createMockApp();
  app.state = State.IDLING_DONE;
  app.onContinue();
  assert.strictEqual(app.state, State.WORKING);
  assert.strictEqual(app._enterCalled, State.WORKING);
});

test('WORKING -> SHORT_BREAK transition via onShortBreak', () => {
  const app = createMockApp();
  app.state = State.WORKING;
  app.onShortBreak();
  assert.strictEqual(app.state, State.SHORT_BREAK);
  assert.strictEqual(app._enterCalled, State.SHORT_BREAK);
});

test('SHORT_BREAK -> IDLING transition (short break ends, goes back to idling)', () => {
  const app = createMockApp();
  app.state = State.SHORT_BREAK;
  // Simulate short break timer ending: transition to IDLING
  app.transition(State.IDLING);
  assert.strictEqual(app.state, State.IDLING);
  assert.strictEqual(app._enterCalled, State.IDLING);
});

test('WORKING -> BREAK transition via onBreak', () => {
  const app = createMockApp();
  app.state = State.WORKING;
  app.onBreak();
  assert.strictEqual(app.state, State.BREAK);
  assert.strictEqual(app._enterCalled, State.BREAK);
});

test('BREAK -> IDLING transition via onEndBreak', () => {
  const app = createMockApp();
  app.state = State.BREAK;
  app.onEndBreak();
  assert.strictEqual(app.state, State.IDLING);
  assert.strictEqual(app._enterCalled, State.IDLING);
});

test('State enum values are correct strings', () => {
  assert.strictEqual(State.READY, 'ready');
  assert.strictEqual(State.IDLING, 'idling');
  assert.strictEqual(State.IDLING_DONE, 'idling_done');
  assert.strictEqual(State.WORKING, 'working');
  assert.strictEqual(State.SHORT_BREAK, 'short_break');
  assert.strictEqual(State.BREAK, 'break');
});

test('Transition clears timers', () => {
  const app = createMockApp();
  app.timerInterval = 123;
  app.autoTransitionTimer = 456;
  app.startTime = Date.now();
  app.transition(State.READY);
  // clearTimers sets these to null before enterReady
  assert.strictEqual(app.timerInterval, null);
  assert.strictEqual(app.autoTransitionTimer, null);
});

test('Transition from WORKING calls saveCurrentWork', () => {
  const app = createMockApp();
  let saveCalled = false;
  app.saveCurrentWork = () => { saveCalled = true; };
  app.state = State.WORKING;
  app.transition(State.BREAK);
  assert.strictEqual(saveCalled, true);
});

test('Transition from non-WORKING does not call saveCurrentWork', () => {
  const app = createMockApp();
  let saveCalled = false;
  app.saveCurrentWork = () => { saveCalled = true; };
  app.state = State.IDLING;
  app.transition(State.IDLING_DONE);
  assert.strictEqual(saveCalled, false);
});

module.exports = tests;
