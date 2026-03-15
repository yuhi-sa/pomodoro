'use client';

import type { Session } from '../lib/types';
import { formatDuration } from '../lib/analytics';

interface SessionHistoryProps {
  sessions: Session[];
}

export default function SessionHistory({ sessions }: SessionHistoryProps) {
  const sorted = [...sessions].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="bg-[#1a1a2e] rounded-xl p-5">
      <h3 className="text-[15px] font-semibold mb-4">今日のセッション履歴</h3>
      <div className="flex flex-col gap-2">
        {sorted.length === 0 ? (
          <div className="text-center text-[#9898a8] text-[13px] py-5">
            まだセッションがありません
          </div>
        ) : (
          sorted.map((s) => {
            const time = new Date(s.timestamp);
            const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
            return (
              <div
                key={s.timestamp}
                className="flex justify-between items-center px-3 py-2.5 bg-[#222240] rounded-lg text-[13px]"
              >
                <span className="text-[#9898a8]">{timeStr}</span>
                <span className="font-semibold tabular-nums">{formatDuration(s.duration)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
