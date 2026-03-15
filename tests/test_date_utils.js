'use strict';

const assert = require('assert');

// Reproduce getDateString from app.js
function getDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Reproduce formatTime from app.js
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Reproduce formatDuration from app.js
function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// --- getDateString tests ---

test('getDateString formats date correctly (YYYY-MM-DD)', () => {
  const date = new Date(2026, 2, 15); // March 15, 2026 (month is 0-indexed)
  assert.strictEqual(getDateString(date), '2026-03-15');
});

test('Single-digit months are zero-padded', () => {
  const date = new Date(2026, 0, 20); // January 20, 2026
  assert.strictEqual(getDateString(date), '2026-01-20');
});

test('Single-digit days are zero-padded', () => {
  const date = new Date(2026, 11, 5); // December 5, 2026
  assert.strictEqual(getDateString(date), '2026-12-05');
});

test('Double-digit month and day are not double-padded', () => {
  const date = new Date(2026, 10, 25); // November 25, 2026
  assert.strictEqual(getDateString(date), '2026-11-25');
});

test('December 31 formats correctly', () => {
  const date = new Date(2025, 11, 31);
  assert.strictEqual(getDateString(date), '2025-12-31');
});

// --- formatTime tests ---

test('formatTime formats 0 seconds as 0:00', () => {
  assert.strictEqual(formatTime(0), '0:00');
});

test('formatTime formats 65 seconds as 1:05', () => {
  assert.strictEqual(formatTime(65), '1:05');
});

test('formatTime formats 600 seconds as 10:00', () => {
  assert.strictEqual(formatTime(600), '10:00');
});

// --- formatDuration tests ---

test('formatDuration formats 3661 seconds as 1:01:01', () => {
  assert.strictEqual(formatDuration(3661), '1:01:01');
});

test('formatDuration formats 0 seconds as 0:00:00', () => {
  assert.strictEqual(formatDuration(0), '0:00:00');
});

module.exports = tests;
