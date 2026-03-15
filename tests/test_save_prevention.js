'use strict';

const assert = require('assert');

const State = {
  READY: 'ready',
  IDLING: 'idling',
  IDLING_DONE: 'idling_done',
  WORKING: 'working',
  SHORT_BREAK: 'short_break',
  BREAK: 'break',
};

const MIN_SESSION_DURATION = 5;

function createMockApp() {
  return {
    state: State.WORKING,
    workStartTime: null,
    _lastSavedWorkStart: null,
    history: { sessions: [] },
    _addWorkSessionCalls: [],

    addWorkSession(duration) {
      this._addWorkSessionCalls.push(duration);
    },

    saveHistory() {},

    // Reproduce saveCurrentWork from app.js
    saveCurrentWork() {
      if (this.state !== State.WORKING || !this.workStartTime) return;

      const workStart = this.workStartTime;
      if (this._lastSavedWorkStart === workStart) return;

      const duration = Math.floor((Date.now() - workStart) / 1000);
      if (duration < MIN_SESSION_DURATION) return;

      this._lastSavedWorkStart = workStart;
      this.addWorkSession(duration);
      this.workStartTime = null;
    },
  };
}

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test('First save succeeds', () => {
  const app = createMockApp();
  // Set workStartTime to 10 seconds ago so duration > MIN_SESSION_DURATION
  app.workStartTime = Date.now() - 10000;
  app.saveCurrentWork();
  assert.strictEqual(app._addWorkSessionCalls.length, 1);
  assert.ok(app._addWorkSessionCalls[0] >= 9); // ~10 seconds
});

test('Second save with same workStartTime is skipped (double-save prevention)', () => {
  const app = createMockApp();
  const workStart = Date.now() - 10000;
  app.workStartTime = workStart;
  app.saveCurrentWork();
  assert.strictEqual(app._addWorkSessionCalls.length, 1);

  // Simulate saveCurrentWork being called again with the same workStartTime
  // (e.g., beforeunload + transition both firing)
  // workStartTime was set to null by first call, but _lastSavedWorkStart is set.
  // Restore workStartTime to simulate the race condition scenario:
  app.workStartTime = workStart;
  app.state = State.WORKING;
  app.saveCurrentWork();
  // Second call should be skipped because _lastSavedWorkStart matches
  assert.strictEqual(app._addWorkSessionCalls.length, 1);
});

test('Save with different workStartTime succeeds', () => {
  const app = createMockApp();
  app.workStartTime = Date.now() - 20000;
  app.saveCurrentWork();
  assert.strictEqual(app._addWorkSessionCalls.length, 1);

  // New work session with different start time
  app.workStartTime = Date.now() - 15000;
  app.state = State.WORKING;
  app.saveCurrentWork();
  assert.strictEqual(app._addWorkSessionCalls.length, 2);
});

test('Save is skipped when state is not WORKING', () => {
  const app = createMockApp();
  app.state = State.BREAK;
  app.workStartTime = Date.now() - 10000;
  app.saveCurrentWork();
  assert.strictEqual(app._addWorkSessionCalls.length, 0);
});

test('Save is skipped when workStartTime is null', () => {
  const app = createMockApp();
  app.workStartTime = null;
  app.saveCurrentWork();
  assert.strictEqual(app._addWorkSessionCalls.length, 0);
});

test('Save is skipped when duration is below MIN_SESSION_DURATION', () => {
  const app = createMockApp();
  app.workStartTime = Date.now() - 2000; // 2 seconds, below threshold of 5
  app.saveCurrentWork();
  assert.strictEqual(app._addWorkSessionCalls.length, 0);
});

module.exports = tests;
