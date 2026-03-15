'use client';

import type { Session } from '../lib/types';
import {
  getTimeOfDayData,
  getDayOfWeekData,
  getStatsSummary,
  getBestTime,
  formatShortDuration,
  formatDuration,
} from '../lib/analytics';

interface FocusPatternProps {
  sessions: Session[];
}

function BarChart({
  data,
  height = 140,
}: {
  data: { label: string; avgDuration: number }[];
  height?: number;
}) {
  const maxAvg = Math.max(...data.map((d) => d.avgDuration), 1);

  return (
    <div className="flex items-end justify-around gap-2" style={{ height }}>
      {data.map((item) => {
        const heightPct = Math.max(1, (item.avgDuration / maxAvg) * 100);
        const value =
          item.avgDuration > 0 ? formatShortDuration(item.avgDuration) : '';

        return (
          <div
            key={item.label}
            className="flex flex-col items-center flex-1 h-full justify-end"
          >
            <span className="text-[10px] text-[#9898a8] mb-1 tabular-nums">
              {value}
            </span>
            <div
              className="w-full max-w-[36px] min-h-[2px] rounded-t bg-gradient-to-t from-[#6366f1] to-[#818cf8] transition-[height] duration-500"
              style={{ height: `${heightPct}%` }}
            />
            <span className="text-[11px] text-[#9898a8] mt-2">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function FocusPattern({ sessions }: FocusPatternProps) {
  const stats = getStatsSummary(sessions);
  const timeOfDayData = getTimeOfDayData(sessions);
  const dayOfWeekData = getDayOfWeekData(sessions);
  const bestTime = getBestTime(sessions);

  return (
    <>
      {/* Stats Summary */}
      <div className="bg-[#1a1a2e] rounded-xl p-5 mb-5">
        <h3 className="text-[15px] font-semibold mb-4">統計サマリー</h3>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-[#1a1a2e] rounded-xl p-4 text-center">
            <div className="text-xl font-bold tabular-nums mb-1">
              {stats.totalSessions}
            </div>
            <div className="text-[11px] text-[#9898a8]">総セッション数</div>
          </div>
          <div className="bg-[#1a1a2e] rounded-xl p-4 text-center">
            <div className="text-xl font-bold tabular-nums mb-1">
              {stats.avgDuration > 0 ? formatShortDuration(stats.avgDuration) : '0m'}
            </div>
            <div className="text-[11px] text-[#9898a8]">平均セッション時間</div>
          </div>
          <div className="bg-[#1a1a2e] rounded-xl p-4 text-center">
            <div className="text-xl font-bold tabular-nums mb-1">
              {stats.maxDuration > 0 ? formatShortDuration(stats.maxDuration) : '0m'}
            </div>
            <div className="text-[11px] text-[#9898a8]">最長セッション</div>
          </div>
          <div className="bg-[#1a1a2e] rounded-xl p-4 text-center">
            <div
              className={`text-xl font-bold tabular-nums mb-1 ${
                stats.weekComparison?.changePercent != null
                  ? stats.weekComparison.changePercent >= 0
                    ? 'text-[#22c55e]'
                    : 'text-[#ef4444]'
                  : ''
              }`}
            >
              {stats.weekComparison
                ? stats.weekComparison.changePercent !== null
                  ? `${stats.weekComparison.changePercent >= 0 ? '+' : ''}${stats.weekComparison.changePercent}%`
                  : formatShortDuration(stats.weekComparison.thisWeek)
                : '--'}
            </div>
            <div className="text-[11px] text-[#9898a8]">今週 vs 先週</div>
          </div>
        </div>
      </div>

      {/* Best Time */}
      <div className="bg-[#1a1a2e] rounded-xl p-5 mb-5 text-center">
        <h3 className="text-[15px] font-semibold mb-4">ベストタイム</h3>
        <div className="text-[15px] font-semibold text-[#f59e0b] leading-[1.8] py-2">
          {bestTime
            ? `あなたのベストタイムは${bestTime.day.label}曜日の${bestTime.timeSlot.label}です！（平均${formatShortDuration(bestTime.timeSlot.avgDuration)}/セッション）`
            : 'データが不足しています。セッションを重ねると分析結果が表示されます。'}
        </div>
      </div>

      {/* Time of Day Chart */}
      <div className="bg-[#1a1a2e] rounded-xl p-5 mb-5">
        <h3 className="text-[15px] font-semibold mb-4">時間帯別の集中パターン</h3>
        <BarChart data={timeOfDayData} height={140} />
      </div>

      {/* Day of Week Chart */}
      <div className="bg-[#1a1a2e] rounded-xl p-5 mb-5">
        <h3 className="text-[15px] font-semibold mb-4">曜日別の集中パターン</h3>
        <BarChart data={dayOfWeekData} height={140} />
      </div>
    </>
  );
}
