// ========================================
// State Machine
// ========================================

import { State, type StateValue } from './types';

export type TransitionAction =
  | 'onStart'
  | 'onContinue'
  | 'onShortBreak'
  | 'onBreak'
  | 'onEndBreak';

/**
 * Returns the next state for a given user action.
 */
export function getNextState(action: TransitionAction): StateValue {
  switch (action) {
    case 'onStart':
      return State.IDLING;
    case 'onContinue':
      return State.WORKING;
    case 'onShortBreak':
      return State.SHORT_BREAK;
    case 'onBreak':
      return State.BREAK;
    case 'onEndBreak':
      return State.IDLING;
  }
}

/**
 * Data-action map for PiP button delegation.
 */
export const PIP_ACTIONS: Record<string, TransitionAction> = {
  start: 'onStart',
  continue: 'onContinue',
  shortBreak: 'onShortBreak',
  break: 'onBreak',
  endBreak: 'onEndBreak',
};

/**
 * Determines the keyboard action based on current state and key.
 */
export function getKeyboardAction(
  state: StateValue,
  key: string
): TransitionAction | 'reset' | null {
  if (key === 'Space') {
    switch (state) {
      case State.READY:
        return 'onStart';
      case State.IDLING_DONE:
        return 'onContinue';
      default:
        return null;
    }
  }

  if (key === 'KeyR') {
    return 'reset';
  }

  if (key === 'KeyS') {
    switch (state) {
      case State.IDLING:
        return 'onContinue'; // skip idling -> go to working (via IDLING_DONE -> continue)
      case State.IDLING_DONE:
        return 'onContinue';
      case State.WORKING:
        return 'onBreak';
      case State.SHORT_BREAK:
        return 'onStart'; // restart cycle
      case State.BREAK:
        return 'onEndBreak';
      default:
        return null;
    }
  }

  return null;
}
