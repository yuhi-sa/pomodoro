'use strict';

const assert = require('assert');

// Reproduce loadSettings and loadHistory logic from app.js,
// but accept a mock localStorage instead of using the global one.

function loadSettings(mockStorage) {
  const defaults = { sound: true, autoTransition: true };
  try {
    const saved = mockStorage.getItem('pomodoro-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed !== 'object' || parsed === null ||
          typeof parsed.sound !== 'boolean' || typeof parsed.autoTransition !== 'boolean') {
        return { ...defaults };
      }
      return { ...defaults, ...parsed };
    }
  } catch (e) {
    // malformed JSON or other error
  }
  return { ...defaults };
}

function loadHistory(mockStorage) {
  try {
    const saved = mockStorage.getItem('pomodoro-history');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.sessions)) {
        return { sessions: [] };
      }
      return parsed;
    }
  } catch (e) {
    // malformed JSON
  }
  return { sessions: [] };
}

function createMockStorage(data) {
  return {
    _data: data,
    getItem(key) { return this._data[key] !== undefined ? this._data[key] : null; },
  };
}

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// --- Settings tests ---

test('Valid settings object passes validation', () => {
  const storage = createMockStorage({
    'pomodoro-settings': JSON.stringify({ sound: false, autoTransition: true }),
  });
  const result = loadSettings(storage);
  assert.strictEqual(result.sound, false);
  assert.strictEqual(result.autoTransition, true);
});

test('Settings with missing keys returns defaults', () => {
  const storage = createMockStorage({
    'pomodoro-settings': JSON.stringify({ someOther: 'value' }),
  });
  const result = loadSettings(storage);
  // Missing sound and autoTransition are not booleans, so defaults returned
  assert.strictEqual(result.sound, true);
  assert.strictEqual(result.autoTransition, true);
});

test('Settings with wrong types returns defaults', () => {
  const storage = createMockStorage({
    'pomodoro-settings': JSON.stringify({ sound: 'yes', autoTransition: 1 }),
  });
  const result = loadSettings(storage);
  assert.strictEqual(result.sound, true);
  assert.strictEqual(result.autoTransition, true);
});

test('Settings with null parsed value returns defaults', () => {
  const storage = createMockStorage({
    'pomodoro-settings': 'null',
  });
  const result = loadSettings(storage);
  assert.strictEqual(result.sound, true);
  assert.strictEqual(result.autoTransition, true);
});

test('No saved settings returns defaults', () => {
  const storage = createMockStorage({});
  const result = loadSettings(storage);
  assert.strictEqual(result.sound, true);
  assert.strictEqual(result.autoTransition, true);
});

test('Malformed JSON settings returns defaults', () => {
  const storage = createMockStorage({
    'pomodoro-settings': '{broken json!!!',
  });
  const result = loadSettings(storage);
  assert.strictEqual(result.sound, true);
  assert.strictEqual(result.autoTransition, true);
});

// --- History tests ---

test('Valid history with sessions array passes', () => {
  const sessions = [
    { date: '2026-03-15', duration: 300, timestamp: Date.now() },
  ];
  const storage = createMockStorage({
    'pomodoro-history': JSON.stringify({ sessions }),
  });
  const result = loadHistory(storage);
  assert.strictEqual(Array.isArray(result.sessions), true);
  assert.strictEqual(result.sessions.length, 1);
  assert.strictEqual(result.sessions[0].duration, 300);
});

test('History with non-array sessions returns default', () => {
  const storage = createMockStorage({
    'pomodoro-history': JSON.stringify({ sessions: 'not-an-array' }),
  });
  const result = loadHistory(storage);
  assert.deepStrictEqual(result, { sessions: [] });
});

test('History with missing sessions key returns default', () => {
  const storage = createMockStorage({
    'pomodoro-history': JSON.stringify({ other: 123 }),
  });
  const result = loadHistory(storage);
  assert.deepStrictEqual(result, { sessions: [] });
});

test('Malformed JSON history returns default', () => {
  const storage = createMockStorage({
    'pomodoro-history': '<<<not json>>>',
  });
  const result = loadHistory(storage);
  assert.deepStrictEqual(result, { sessions: [] });
});

test('No saved history returns default', () => {
  const storage = createMockStorage({});
  const result = loadHistory(storage);
  assert.deepStrictEqual(result, { sessions: [] });
});

module.exports = tests;
