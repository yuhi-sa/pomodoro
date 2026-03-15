'use client';

import type { Session } from '../lib/types';
import { getWeeklyData, getDateString, formatShortDuration } from '../lib/analytics';

interface WeeklyChartProps {
  sessions: Session[];
}

export default function WeeklyChart({ sessions }: WeeklyChartProps) {
  const weekData = getWeeklyData(sessions);
  const today = getDateString(new Date());
  const maxDuration = Math.max(...weekData.map((d) => d.duration), 1);

  return (
    <div className="bg-[#1a1a2e] rounded-xl p-5 mb-5">
      <h3 className="text-[15px] font-semibold mb-4">過去7日間の作業時間</h3>
      <div className="flex items-end justify-around h-[160px] gap-2">
        {weekData.map((day) => {
          const heightPct = Math.max(1, (day.duration / maxDuration) * 100);
          const isToday = day.date === today;
          const value = day.duration > 0 ? formatShortDuration(day.duration) : '';

          return (
            <div key={day.date} className="flex flex-col items-center flex-1 h-full justify-end">
              <span className="text-[10px] text-[#9898a8] mb-1 tabular-nums">{value}</span>
              <div
                className={`w-full max-w-[36px] min-h-[2px] rounded-t transition-[height] duration-500 ${
                  isToday
                    ? 'bg-gradient-to-t from-[#f59e0b] to-[#fbbf24]'
                    : 'bg-gradient-to-t from-[#ef4444] to-[#f87171]'
                }`}
                style={{ height: `${heightPct}%` }}
              />
              <span
                className={`text-[11px] mt-2 ${
                  isToday ? 'text-[#f59e0b] font-semibold' : 'text-[#9898a8]'
                }`}
              >
                {day.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
