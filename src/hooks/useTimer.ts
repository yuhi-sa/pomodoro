'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  State,
  type StateValue,
  type Session,
  type History,
  type Settings,
  IDLING_DURATION,
  SHORT_BREAK_DURATION,
  AUTO_TRANSITION_DELAY,
  IDLING_TICK_INTERVAL_MS,
  AUDIO_VOLUME,
  MIN_SESSION_DURATION,
  CIRCUMFERENCE,
} from '../lib/types';
import { formatTime, getDateString } from '../lib/analytics';

interface TimerState {
  state: StateValue;
  displayTime: string;
  progress: number;
  progressColor: string;
  isPulsing: boolean;
  phaseLabel: string;
  phaseSub: string;
  phaseClass: string;
}

interface UseTimerReturn {
  timerState: TimerState;
  onStart: () => void;
  onContinue: () => void;
  onShortBreak: () => void;
  onBreak: () => void;
  onEndBreak: () => void;
  reset: () => void;
}

export function useTimer(
  settings: Settings,
  history: History,
  setHistory: (value: History | ((prev: History) => History)) => void
): UseTimerReturn {
  const [currentState, setCurrentState] = useState<StateValue>(State.READY);
  const [displayTime, setDisplayTime] = useState('1:00');
  const [progress, setProgress] = useState(0);
  const [progressColor, setProgressColor] = useState('var(--color-ready)');
  const [isPulsing, setIsPulsing] = useState(false);
  const [phaseLabel, setPhaseLabel] = useState('準備完了');
  const [phaseSub, setPhaseSub] = useState('スタートボタンを押して始めよう');
  const [phaseClass, setPhaseClass] = useState('ready');

  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoTransitionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const workStartTimeRef = useRef<number | null>(null);
  const lastSavedWorkStartRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const stateRef = useRef<StateValue>(State.READY);

  // Keep stateRef in sync
  useEffect(() => {
    stateRef.current = currentState;
  }, [currentState]);

  // ----------------------------------------
  // Audio
  // ----------------------------------------
  const initAudio = useCallback(() => {
    if (audioCtxRef.current) return;
    try {
      audioCtxRef.current = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch (e) {
      console.warn('Audio init failed:', (e as Error).message);
    }
  }, []);

  const playBeep = useCallback(
    (frequency = 800, duration = 0.15) => {
      if (!settings.sound || !audioCtxRef.current) return;
      try {
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        const now = ctx.currentTime;
        gainNode.gain.setValueAtTime(AUDIO_VOLUME, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
        oscillator.start(now);
        oscillator.stop(now + duration);
      } catch (e) {
        console.warn('Audio playback failed:', (e as Error).message);
      }
    },
    [settings.sound]
  );

  // ----------------------------------------
  // Timer Management
  // ----------------------------------------
  const clearTimers = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (autoTransitionTimerRef.current) {
      clearInterval(autoTransitionTimerRef.current);
      autoTransitionTimerRef.current = null;
    }
    startTimeRef.current = null;
  }, []);

  // ----------------------------------------
  // Work Tracking
  // ----------------------------------------
  const saveCurrentWork = useCallback(() => {
    if (stateRef.current !== State.WORKING || !workStartTimeRef.current) return;

    const workStart = workStartTimeRef.current;
    if (lastSavedWorkStartRef.current === workStart) return;

    const duration = Math.floor((Date.now() - workStart) / 1000);
    if (duration < MIN_SESSION_DURATION) return;

    lastSavedWorkStartRef.current = workStart;
    const now = new Date();
    const session: Session = {
      date: getDateString(now),
      duration: duration,
      timestamp: now.getTime(),
    };

    setHistory((prev: History) => ({
      sessions: [...prev.sessions, session],
    }));
    workStartTimeRef.current = null;
  }, [setHistory]);

  // Save on page unload
  useEffect(() => {
    const handler = () => saveCurrentWork();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [saveCurrentWork]);

  // ----------------------------------------
  // Tick
  // ----------------------------------------
  const tick = useCallback(() => {
    if (!startTimeRef.current) return;
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const state = stateRef.current;

    switch (state) {
      case State.IDLING: {
        const remaining = Math.max(0, IDLING_DURATION - elapsed);
        const prog = Math.min(1, elapsed / IDLING_DURATION);
        setDisplayTime(formatTime(Math.ceil(remaining)));
        setProgress(prog);
        setProgressColor('var(--color-idling)');
        if (remaining <= 0) {
          enterIdlingDone();
        }
        break;
      }
      case State.WORKING: {
        setDisplayTime(formatTime(Math.floor(elapsed)));
        break;
      }
      case State.SHORT_BREAK: {
        const remaining = Math.max(0, SHORT_BREAK_DURATION - elapsed);
        const prog = 1 - Math.min(1, elapsed / SHORT_BREAK_DURATION);
        setDisplayTime(formatTime(Math.ceil(remaining)));
        setProgress(prog);
        setProgressColor('var(--color-break)');
        if (remaining <= 0) {
          playBeep(660, 0.1);
          enterIdling();
        }
        break;
      }
      case State.BREAK: {
        setDisplayTime(formatTime(Math.floor(elapsed)));
        break;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playBeep]);

  // Visibility change handler
  useEffect(() => {
    const handler = () => {
      if (!document.hidden && timerIntervalRef.current) {
        tick();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [tick]);

  // ----------------------------------------
  // State Transitions
  // ----------------------------------------
  function enterReady() {
    clearTimers();
    setCurrentState(State.READY);
    setPhaseLabel('準備完了');
    setPhaseSub('スタートボタンを押して始めよう');
    setPhaseClass('ready');
    setDisplayTime('1:00');
    setProgress(0);
    setProgressColor('var(--color-ready)');
    setIsPulsing(false);
  }

  function enterIdling() {
    // Save work if leaving WORKING state
    if (stateRef.current === State.WORKING) {
      saveCurrentWork();
    }
    clearTimers();
    initAudio();
    setCurrentState(State.IDLING);
    setPhaseLabel('アイドリング');
    setPhaseSub('1分だけ頑張ろう！');
    setPhaseClass('idling');
    setProgress(0);
    setProgressColor('var(--color-idling)');
    setIsPulsing(false);

    startTimeRef.current = Date.now();
    timerIntervalRef.current = setInterval(() => tick(), IDLING_TICK_INTERVAL_MS);
  }

  function enterIdlingDone() {
    clearTimers();
    setCurrentState(State.IDLING_DONE);
    playBeep(880, 0.12);
    setTimeout(() => playBeep(1100, 0.12), 150);
    setPhaseLabel('アイドリング完了');
    setPhaseClass('idling');
    setDisplayTime('0:00');
    setProgress(1);
    setProgressColor('var(--color-idling)');

    if (settings.autoTransition) {
      let countdown = AUTO_TRANSITION_DELAY;
      setPhaseSub(`${countdown}秒後に自動で作業に移行`);

      autoTransitionTimerRef.current = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
          enterWorking();
        } else {
          setPhaseSub(`${countdown}秒後に自動で作業に移行`);
        }
      }, 1000);
    } else {
      setPhaseSub('');
    }
  }

  function enterWorking() {
    // Save work if leaving WORKING state (shouldn't normally happen)
    if (stateRef.current === State.WORKING) {
      saveCurrentWork();
    }
    clearTimers();
    setCurrentState(State.WORKING);
    setPhaseLabel('作業中');
    setPhaseSub('集中！疲れたら休憩ボタンを押そう');
    setPhaseClass('working');
    setProgress(1);
    setProgressColor('var(--color-working)');
    setIsPulsing(true);

    workStartTimeRef.current = Date.now();
    startTimeRef.current = Date.now();
    timerIntervalRef.current = setInterval(() => tick(), 1000);
  }

  function enterShortBreak() {
    if (stateRef.current === State.WORKING) {
      saveCurrentWork();
    }
    clearTimers();
    setCurrentState(State.SHORT_BREAK);
    setPhaseLabel('小休憩');
    setPhaseSub('リフレッシュ...');
    setPhaseClass('break');
    setProgress(1);
    setProgressColor('var(--color-break)');
    setIsPulsing(false);

    startTimeRef.current = Date.now();
    timerIntervalRef.current = setInterval(() => tick(), IDLING_TICK_INTERVAL_MS);
  }

  function enterBreak() {
    if (stateRef.current === State.WORKING) {
      saveCurrentWork();
    }
    clearTimers();
    setCurrentState(State.BREAK);
    setPhaseLabel('休憩中');
    setPhaseSub('ゆっくり休もう');
    setPhaseClass('break');
    setProgress(0);
    setProgressColor('var(--color-break)');
    setIsPulsing(false);

    startTimeRef.current = Date.now();
    timerIntervalRef.current = setInterval(() => tick(), 1000);
  }

  // ----------------------------------------
  // User Actions
  // ----------------------------------------
  const onStart = useCallback(() => {
    initAudio();
    enterIdling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initAudio, clearTimers, tick, settings]);

  const onContinue = useCallback(() => {
    enterWorking();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTimers, tick, saveCurrentWork]);

  const onShortBreak = useCallback(() => {
    enterShortBreak();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTimers, tick, saveCurrentWork]);

  const onBreak = useCallback(() => {
    enterBreak();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTimers, tick, saveCurrentWork]);

  const onEndBreak = useCallback(() => {
    enterIdling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTimers, tick, initAudio]);

  const reset = useCallback(() => {
    if (stateRef.current === State.WORKING) {
      saveCurrentWork();
    }
    enterReady();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTimers, saveCurrentWork]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return {
    timerState: {
      state: currentState,
      displayTime,
      progress,
      progressColor,
      isPulsing,
      phaseLabel,
      phaseSub,
      phaseClass,
    },
    onStart,
    onContinue,
    onShortBreak,
    onBreak,
    onEndBreak,
    reset,
  };
}
