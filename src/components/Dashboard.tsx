'use client';

import type { Session } from '../lib/types';
import { formatDuration, getDateString } from '../lib/analytics';
import WeeklyChart from './WeeklyChart';
import FocusPattern from './FocusPattern';
import SessionHistory from './SessionHistory';

interface DashboardProps {
  sessions: Session[];
}

export default function Dashboard({ sessions }: DashboardProps) {
  const today = getDateString(new Date());
  const todaySessions = sessions.filter((s) => s.date === today);
  const todayTotal = todaySessions.reduce((sum, s) => sum + s.duration, 0);
  const totalAll = sessions.reduce((sum, s) => sum + s.duration, 0);

  return (
    <div className="flex flex-col flex-1 animate-fadeIn">
      <h2 className="text-xl font-semibold mb-5">ダッシュボード</h2>

      {/* Today's Stats */}
      <div className="grid grid-cols-3 gap-2.5 mb-7 max-[380px]:grid-cols-1 max-[380px]:gap-2">
        <div className="bg-[#1a1a2e] rounded-xl py-4 px-3 text-center max-[380px]:flex max-[380px]:justify-between max-[380px]:items-center max-[380px]:text-left">
          <div className="text-xl font-bold tabular-nums mb-1 max-[380px]:mb-0">
            {formatDuration(todayTotal)}
          </div>
          <div className="text-[11px] text-[#9898a8]">今日の作業時間</div>
        </div>
        <div className="bg-[#1a1a2e] rounded-xl py-4 px-3 text-center max-[380px]:flex max-[380px]:justify-between max-[380px]:items-center max-[380px]:text-left">
          <div className="text-xl font-bold tabular-nums mb-1 max-[380px]:mb-0">
            {todaySessions.length}
          </div>
          <div className="text-[11px] text-[#9898a8]">今日のセッション</div>
        </div>
        <div className="bg-[#1a1a2e] rounded-xl py-4 px-3 text-center max-[380px]:flex max-[380px]:justify-between max-[380px]:items-center max-[380px]:text-left">
          <div className="text-xl font-bold tabular-nums mb-1 max-[380px]:mb-0">
            {formatDuration(totalAll)}
          </div>
          <div className="text-[11px] text-[#9898a8]">累計作業時間</div>
        </div>
      </div>

      <WeeklyChart sessions={sessions} />
      <FocusPattern sessions={sessions} />
      <SessionHistory sessions={todaySessions} />
    </div>
  );
}
