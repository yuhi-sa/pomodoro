'use client';

import { useEffect, useCallback } from 'react';
import { State, CIRCUMFERENCE, type StateValue } from '../lib/types';
import type { Settings, History } from '../lib/types';
import { useTimer } from '../hooks/useTimer';

interface TimerProps {
  settings: Settings;
  history: History;
  setHistory: (value: History | ((prev: History) => History)) => void;
}

export default function Timer({ settings, history, setHistory }: TimerProps) {
  const {
    timerState,
    onStart,
    onContinue,
    onShortBreak,
    onBreak,
    onEndBreak,
    reset,
  } = useTimer(settings, history, setHistory);

  const { state, displayTime, progress, progressColor, isPulsing, phaseLabel, phaseSub, phaseClass } = timerState;

  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      )
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (state === State.READY) onStart();
        else if (state === State.IDLING_DONE) onContinue();
      } else if (e.code === 'KeyR' && !e.shiftKey) {
        e.preventDefault();
        reset();
      } else if (e.code === 'KeyS' && !e.shiftKey) {
        e.preventDefault();
        switch (state) {
          case State.IDLING:
          case State.IDLING_DONE:
            onContinue();
            break;
          case State.WORKING:
            onBreak();
            break;
          case State.SHORT_BREAK:
            onStart();
            break;
          case State.BREAK:
            onEndBreak();
            break;
        }
      }
    },
    [state, onStart, onContinue, onBreak, onEndBreak, reset]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // PiP support
  const openPiP = useCallback(async () => {
    if (!('documentPictureInPicture' in window)) return;
    try {
      const pipWin = await (
        window as unknown as {
          documentPictureInPicture: {
            requestWindow: (opts: { width: number; height: number }) => Promise<Window>;
          };
        }
      ).documentPictureInPicture.requestWindow({
        width: 300,
        height: 200,
      });

      const pipDoc = pipWin.document;
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
        .pip-phase { font-size: 14px; font-weight: 700; }
        .phase-ready { color: var(--color-ready); }
        .phase-idling { color: var(--color-idling); }
        .phase-working { color: var(--color-working); }
        .phase-break { color: var(--color-break); }
        .pip-time { font-size: 48px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -1px; }
        .pip-actions { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; min-height: 36px; align-items: center; }
        .btn { padding: 8px 16px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; color: white; white-space: nowrap; }
        .btn:active { transform: scale(0.96); }
        .btn-primary { background: var(--color-ready); }
        .btn-idling { background: var(--color-idling); }
        .btn-break { background: var(--color-break); }
        .btn-secondary { background: #1a1a2e; color: #e8e8ec; border: 1px solid rgba(255,255,255,0.1); }
      `;
      pipDoc.head.appendChild(style);

      pipDoc.body.innerHTML = `
        <div id="pip-phase" class="pip-phase phase-${phaseClass}">${phaseLabel}</div>
        <div id="pip-time" class="pip-time">${displayTime}</div>
        <div id="pip-actions" class="pip-actions"></div>
      `;
    } catch (e) {
      console.warn('PiP request failed:', (e as Error).message);
    }
  }, [phaseClass, phaseLabel, displayTime]);

  const pipSupported =
    typeof window !== 'undefined' && 'documentPictureInPicture' in window;

  return (
    <div className="flex flex-col items-center justify-center gap-5 pt-5 relative flex-1">
      {/* PiP Button */}
      {pipSupported && (
        <button
          className="absolute top-3 right-0 w-9 h-9 border border-white/10 bg-[#1a1a2e] text-[#9898a8] rounded-full flex items-center justify-center hover:bg-[#222240] hover:text-[#e8e8ec] transition-all duration-300"
          onClick={openPiP}
          title="ミニプレイヤー"
          aria-label="ピクチャーインピクチャーで開く"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3zm1 0v10h10V3H3z" />
            <path d="M8 8h4v4H8V8z" />
          </svg>
        </button>
      )}

      {/* Phase Label */}
      <div className={`text-[22px] font-bold text-center transition-colors duration-300 phase-${phaseClass}`}>
        {phaseLabel}
      </div>
      <div className="text-sm text-[#9898a8] text-center min-h-[20px]">
        {phaseSub}
      </div>

      {/* Timer Ring */}
      <div className="relative w-[260px] h-[260px] my-3" role="timer" aria-live="polite" aria-atomic="true">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200" aria-hidden="true">
          <circle
            className="fill-none stroke-[#1a1a2e]"
            cx="100"
            cy="100"
            r="88"
            strokeWidth="8"
          />
          <circle
            className={`fill-none transition-[stroke] duration-500 ${isPulsing ? 'animate-pulse' : ''}`}
            cx="100"
            cy="100"
            r="88"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            style={{ stroke: progressColor }}
          />
        </svg>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center flex flex-col items-center gap-1">
          <span className="text-[52px] font-bold tabular-nums tracking-tight">
            {displayTime}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-center flex-wrap min-h-[52px] items-center">
        {state === State.READY && (
          <button
            className="px-8 py-3.5 border-none rounded-xl text-base font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap bg-[#6366f1] text-white hover:brightness-110 active:scale-[0.96]"
            onClick={onStart}
          >
            スタート
          </button>
        )}
        {state === State.IDLING_DONE && (
          <>
            <button
              className="px-8 py-3.5 border-none rounded-xl text-base font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap bg-[#f59e0b] text-white hover:brightness-110 active:scale-[0.96]"
              onClick={onContinue}
            >
              続行
            </button>
            <button
              className="px-8 py-3.5 border-none rounded-xl text-base font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap bg-[#1a1a2e] text-[#e8e8ec] border border-white/10 hover:bg-[#222240] active:scale-[0.96]"
              onClick={onShortBreak}
            >
              1分休憩
            </button>
          </>
        )}
        {state === State.WORKING && (
          <button
            className="px-8 py-3.5 border-none rounded-xl text-base font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap bg-[#06b6d4] text-white hover:brightness-110 active:scale-[0.96]"
            onClick={onBreak}
          >
            休憩する
          </button>
        )}
        {state === State.BREAK && (
          <button
            className="px-8 py-3.5 border-none rounded-xl text-base font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap bg-[#06b6d4] text-white hover:brightness-110 active:scale-[0.96]"
            onClick={onEndBreak}
          >
            休憩終了
          </button>
        )}
      </div>

      {/* Screen reader announcement */}
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {phaseLabel}{phaseSub ? ` - ${phaseSub}` : ''}
      </div>

      {/* Keyboard help */}
      <div className="text-[11px] text-[#686878] text-center mt-2">
        キーボード: Space=開始/一時停止 R=リセット S=次のフェーズへスキップ
      </div>
    </div>
  );
}
