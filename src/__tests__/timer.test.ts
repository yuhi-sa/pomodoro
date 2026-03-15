import { State } from '../lib/types';
import { MIN_SESSION_DURATION } from '../lib/types';

// --- Data validation tests (loadSettings/loadHistory equivalents) ---

function loadSettings(mockStorage: Record<string, string | undefined>) {
  const defaults = { sound: true, autoTransition: true };
  try {
    const saved = mockStorage['pomodoro-settings'];
    if (saved) {
      const parsed = JSON.parse(saved);
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        typeof parsed.sound !== 'boolean' ||
        typeof parsed.autoTransition !== 'boolean'
      ) {
        return { ...defaults };
      }
      return { ...defaults, ...parsed };
    }
  } catch {
    // malformed JSON
  }
  return { ...defaults };
}

function loadHistory(mockStorage: Record<string, string | undefined>) {
  try {
    const saved = mockStorage['pomodoro-history'];
    if (saved) {
      const parsed = JSON.parse(saved);
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !Array.isArray(parsed.sessions)
      ) {
        return { sessions: [] };
      }
      return parsed;
    }
  } catch {
    // malformed JSON
  }
  return { sessions: [] };
}

// --- Settings validation tests ---

test('Valid settings object passes validation', () => {
  const result = loadSettings({
    'pomodoro-settings': JSON.stringify({ sound: false, autoTransition: true }),
  });
  expect(result.sound).toBe(false);
  expect(result.autoTransition).toBe(true);
});

test('Settings with missing keys returns defaults', () => {
  const result = loadSettings({
    'pomodoro-settings': JSON.stringify({ someOther: 'value' }),
  });
  expect(result.sound).toBe(true);
  expect(result.autoTransition).toBe(true);
});

test('Settings with wrong types returns defaults', () => {
  const result = loadSettings({
    'pomodoro-settings': JSON.stringify({ sound: 'yes', autoTransition: 1 }),
  });
  expect(result.sound).toBe(true);
  expect(result.autoTransition).toBe(true);
});

test('Settings with null parsed value returns defaults', () => {
  const result = loadSettings({
    'pomodoro-settings': 'null',
  });
  expect(result.sound).toBe(true);
  expect(result.autoTransition).toBe(true);
});

test('No saved settings returns defaults', () => {
  const result = loadSettings({});
  expect(result.sound).toBe(true);
  expect(result.autoTransition).toBe(true);
});

test('Malformed JSON settings returns defaults', () => {
  const result = loadSettings({
    'pomodoro-settings': '{broken json!!!',
  });
  expect(result.sound).toBe(true);
  expect(result.autoTransition).toBe(true);
});

// --- History validation tests ---

test('Valid history with sessions array passes', () => {
  const sessions = [{ date: '2026-03-15', duration: 300, timestamp: Date.now() }];
  const result = loadHistory({
    'pomodoro-history': JSON.stringify({ sessions }),
  });
  expect(Array.isArray(result.sessions)).toBe(true);
  expect(result.sessions.length).toBe(1);
  expect(result.sessions[0].duration).toBe(300);
});

test('History with non-array sessions returns default', () => {
  const result = loadHistory({
    'pomodoro-history': JSON.stringify({ sessions: 'not-an-array' }),
  });
  expect(result).toEqual({ sessions: [] });
});

test('History with missing sessions key returns default', () => {
  const result = loadHistory({
    'pomodoro-history': JSON.stringify({ other: 123 }),
  });
  expect(result).toEqual({ sessions: [] });
});

test('Malformed JSON history returns default', () => {
  const result = loadHistory({
    'pomodoro-history': '<<<not json>>>',
  });
  expect(result).toEqual({ sessions: [] });
});

test('No saved history returns default', () => {
  const result = loadHistory({});
  expect(result).toEqual({ sessions: [] });
});

// --- Save prevention tests ---

interface MockApp {
  state: string;
  workStartTime: number | null;
  _lastSavedWorkStart: number | null;
  _addWorkSessionCalls: number[];
  addWorkSession: (duration: number) => void;
  saveCurrentWork: () => void;
}

function createMockApp(): MockApp {
  const app: MockApp = {
    state: State.WORKING,
    workStartTime: null,
    _lastSavedWorkStart: null,
    _addWorkSessionCalls: [],
    addWorkSession(duration: number) {
      this._addWorkSessionCalls.push(duration);
    },
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
  return app;
}

test('First save succeeds', () => {
  const app = createMockApp();
  app.workStartTime = Date.now() - 10000;
  app.saveCurrentWork();
  expect(app._addWorkSessionCalls.length).toBe(1);
  expect(app._addWorkSessionCalls[0]).toBeGreaterThanOrEqual(9);
});

test('Second save with same workStartTime is skipped (double-save prevention)', () => {
  const app = createMockApp();
  const workStart = Date.now() - 10000;
  app.workStartTime = workStart;
  app.saveCurrentWork();
  expect(app._addWorkSessionCalls.length).toBe(1);

  app.workStartTime = workStart;
  app.state = State.WORKING;
  app.saveCurrentWork();
  expect(app._addWorkSessionCalls.length).toBe(1);
});

test('Save with different workStartTime succeeds', () => {
  const app = createMockApp();
  app.workStartTime = Date.now() - 20000;
  app.saveCurrentWork();
  expect(app._addWorkSessionCalls.length).toBe(1);

  app.workStartTime = Date.now() - 15000;
  app.state = State.WORKING;
  app.saveCurrentWork();
  expect(app._addWorkSessionCalls.length).toBe(2);
});

test('Save is skipped when state is not WORKING', () => {
  const app = createMockApp();
  app.state = State.BREAK;
  app.workStartTime = Date.now() - 10000;
  app.saveCurrentWork();
  expect(app._addWorkSessionCalls.length).toBe(0);
});

test('Save is skipped when workStartTime is null', () => {
  const app = createMockApp();
  app.workStartTime = null;
  app.saveCurrentWork();
  expect(app._addWorkSessionCalls.length).toBe(0);
});

test('Save is skipped when duration is below MIN_SESSION_DURATION', () => {
  const app = createMockApp();
  app.workStartTime = Date.now() - 2000; // 2 seconds, below threshold of 5
  app.saveCurrentWork();
  expect(app._addWorkSessionCalls.length).toBe(0);
});

// --- State transition tests ---

function createTransitionMockApp() {
  return {
    state: State.READY as string,
    _enterCalled: null as string | null,
    _saveWorkCalled: false,

    clearTimers() {},
    saveCurrentWork() {
      this._saveWorkCalled = true;
    },

    transition(newState: string) {
      if (this.state === State.WORKING) {
        this.saveCurrentWork();
      }
      this.clearTimers();
      this.state = newState;
      this._enterCalled = newState;
    },

    onStart() { this.transition(State.IDLING); },
    onContinue() { this.transition(State.WORKING); },
    onShortBreak() { this.transition(State.SHORT_BREAK); },
    onBreak() { this.transition(State.BREAK); },
    onEndBreak() { this.transition(State.IDLING); },
  };
}

test('READY -> IDLING transition via onStart', () => {
  const app = createTransitionMockApp();
  expect(app.state).toBe(State.READY);
  app.onStart();
  expect(app.state).toBe(State.IDLING);
  expect(app._enterCalled).toBe(State.IDLING);
});

test('IDLING_DONE -> WORKING transition via onContinue', () => {
  const app = createTransitionMockApp();
  app.state = State.IDLING_DONE;
  app.onContinue();
  expect(app.state).toBe(State.WORKING);
  expect(app._enterCalled).toBe(State.WORKING);
});

test('WORKING -> SHORT_BREAK transition via onShortBreak', () => {
  const app = createTransitionMockApp();
  app.state = State.WORKING;
  app.onShortBreak();
  expect(app.state).toBe(State.SHORT_BREAK);
});

test('SHORT_BREAK -> IDLING transition', () => {
  const app = createTransitionMockApp();
  app.state = State.SHORT_BREAK;
  app.transition(State.IDLING);
  expect(app.state).toBe(State.IDLING);
});

test('WORKING -> BREAK transition via onBreak', () => {
  const app = createTransitionMockApp();
  app.state = State.WORKING;
  app.onBreak();
  expect(app.state).toBe(State.BREAK);
});

test('BREAK -> IDLING transition via onEndBreak', () => {
  const app = createTransitionMockApp();
  app.state = State.BREAK;
  app.onEndBreak();
  expect(app.state).toBe(State.IDLING);
});

test('Transition from WORKING calls saveCurrentWork', () => {
  const app = createTransitionMockApp();
  app.state = State.WORKING;
  app._saveWorkCalled = false;
  app.transition(State.BREAK);
  expect(app._saveWorkCalled).toBe(true);
});

test('Transition from non-WORKING does not call saveCurrentWork', () => {
  const app = createTransitionMockApp();
  app.state = State.IDLING;
  app._saveWorkCalled = false;
  app.transition(State.IDLING_DONE);
  expect(app._saveWorkCalled).toBe(false);
});
