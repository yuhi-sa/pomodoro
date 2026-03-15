import { State } from '../lib/types';
import { getNextState, getKeyboardAction, PIP_ACTIONS } from '../lib/state-machine';

// --- State enum tests ---

test('State enum values are correct strings', () => {
  expect(State.READY).toBe('ready');
  expect(State.IDLING).toBe('idling');
  expect(State.IDLING_DONE).toBe('idling_done');
  expect(State.WORKING).toBe('working');
  expect(State.SHORT_BREAK).toBe('short_break');
  expect(State.BREAK).toBe('break');
});

// --- getNextState tests ---

test('onStart returns IDLING', () => {
  expect(getNextState('onStart')).toBe(State.IDLING);
});

test('onContinue returns WORKING', () => {
  expect(getNextState('onContinue')).toBe(State.WORKING);
});

test('onShortBreak returns SHORT_BREAK', () => {
  expect(getNextState('onShortBreak')).toBe(State.SHORT_BREAK);
});

test('onBreak returns BREAK', () => {
  expect(getNextState('onBreak')).toBe(State.BREAK);
});

test('onEndBreak returns IDLING', () => {
  expect(getNextState('onEndBreak')).toBe(State.IDLING);
});

// --- PIP_ACTIONS tests ---

test('PIP_ACTIONS maps data-action values to transition actions', () => {
  expect(PIP_ACTIONS['start']).toBe('onStart');
  expect(PIP_ACTIONS['continue']).toBe('onContinue');
  expect(PIP_ACTIONS['shortBreak']).toBe('onShortBreak');
  expect(PIP_ACTIONS['break']).toBe('onBreak');
  expect(PIP_ACTIONS['endBreak']).toBe('onEndBreak');
});

// --- Keyboard action tests ---

test('Space in READY state returns onStart', () => {
  expect(getKeyboardAction(State.READY, 'Space')).toBe('onStart');
});

test('Space in IDLING_DONE state returns onContinue', () => {
  expect(getKeyboardAction(State.IDLING_DONE, 'Space')).toBe('onContinue');
});

test('Space in WORKING state returns null', () => {
  expect(getKeyboardAction(State.WORKING, 'Space')).toBeNull();
});

test('KeyR returns reset', () => {
  expect(getKeyboardAction(State.READY, 'KeyR')).toBe('reset');
  expect(getKeyboardAction(State.WORKING, 'KeyR')).toBe('reset');
});

test('KeyS in IDLING returns onContinue (skip)', () => {
  expect(getKeyboardAction(State.IDLING, 'KeyS')).toBe('onContinue');
});

test('KeyS in WORKING returns onBreak', () => {
  expect(getKeyboardAction(State.WORKING, 'KeyS')).toBe('onBreak');
});

test('KeyS in BREAK returns onEndBreak', () => {
  expect(getKeyboardAction(State.BREAK, 'KeyS')).toBe('onEndBreak');
});

test('Unknown key returns null', () => {
  expect(getKeyboardAction(State.READY, 'KeyA')).toBeNull();
});
