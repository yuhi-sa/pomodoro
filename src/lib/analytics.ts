// ========================================
// Focus Pattern Analysis (Pure Functions)
// ========================================

import type {
  Session,
  TimeSlotData,
  DayOfWeekData,
  StatsSummary,
  BestTime,
  WeeklyDayData,
} from './types';

// ----------------------------------------
// Time Slot Helpers
// ----------------------------------------

export function getTimeSlot(hour: number): number {
  if (hour >= 5 && hour < 12) return 0; // Morning (5-11)
  if (hour >= 12 && hour < 14) return 1; // Noon (12-13)
  if (hour >= 14 && hour < 18) return 2; // Afternoon (14-17)
  return 3; // Night (18-4)
}

export function getTimeSlotLabel(index: number): string {
  const labels = ['朝(5-11時)', '昼(12-13時)', '午後(14-17時)', '夜(18-4時)'];
  return labels[index];
}

// ----------------------------------------
// Time of Day Data
// ----------------------------------------

export function getTimeOfDayData(sessions: Session[]): TimeSlotData[] {
  const slots = [
    { label: '朝(5-11時)', totalDuration: 0, count: 0 },
    { label: '昼(12-13時)', totalDuration: 0, count: 0 },
    { label: '午後(14-17時)', totalDuration: 0, count: 0 },
    { label: '夜(18-4時)', totalDuration: 0, count: 0 },
  ];

  for (const session of sessions) {
    if (!session.timestamp) continue;
    const hour = new Date(session.timestamp).getHours();
    const slotIndex = getTimeSlot(hour);
    slots[slotIndex].totalDuration += session.duration;
    slots[slotIndex].count += 1;
  }

  return slots.map((slot) => ({
    label: slot.label,
    avgDuration: slot.count > 0 ? Math.round(slot.totalDuration / slot.count) : 0,
    count: slot.count,
  }));
}

// ----------------------------------------
// Day of Week Data
// ----------------------------------------

export function getDayOfWeekData(sessions: Session[]): DayOfWeekData[] {
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const days = dayNames.map((name) => ({
    label: name,
    totalDuration: 0,
    count: 0,
  }));

  for (const session of sessions) {
    if (!session.timestamp) continue;
    const dayIndex = new Date(session.timestamp).getDay();
    days[dayIndex].totalDuration += session.duration;
    days[dayIndex].count += 1;
  }

  return days.map((day) => ({
    label: day.label,
    avgDuration: day.count > 0 ? Math.round(day.totalDuration / day.count) : 0,
    count: day.count,
  }));
}

// ----------------------------------------
// Stats Summary
// ----------------------------------------

export function getStatsSummary(sessions: Session[]): StatsSummary {
  const totalSessions = sessions.length;

  if (totalSessions === 0) {
    return {
      totalSessions: 0,
      avgDuration: 0,
      maxDuration: 0,
      weekComparison: null,
    };
  }

  const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
  const avgDuration = Math.round(totalDuration / totalSessions);
  const maxDuration = Math.max(...sessions.map((s) => s.duration));

  // This week vs last week
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = todayStart.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const thisWeekStart = new Date(todayStart);
  thisWeekStart.setDate(todayStart.getDate() - mondayOffset);
  const thisWeekStartMs = thisWeekStart.getTime();

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(thisWeekStart.getDate() - 7);
  const lastWeekStartMs = lastWeekStart.getTime();

  const thisWeekTotal = sessions
    .filter((s) => s.timestamp >= thisWeekStartMs)
    .reduce((sum, s) => sum + s.duration, 0);

  const lastWeekTotal = sessions
    .filter((s) => s.timestamp >= lastWeekStartMs && s.timestamp < thisWeekStartMs)
    .reduce((sum, s) => sum + s.duration, 0);

  let weekComparison = null;
  if (lastWeekTotal > 0) {
    const changePercent = Math.round(
      ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100
    );
    weekComparison = { thisWeek: thisWeekTotal, lastWeek: lastWeekTotal, changePercent };
  } else if (thisWeekTotal > 0) {
    weekComparison = { thisWeek: thisWeekTotal, lastWeek: 0, changePercent: null };
  }

  return { totalSessions, avgDuration, maxDuration, weekComparison };
}

// ----------------------------------------
// Best Time
// ----------------------------------------

export function getBestTime(sessions: Session[]): BestTime | null {
  const timeData = getTimeOfDayData(sessions);
  const dayData = getDayOfWeekData(sessions);

  const validTime = timeData.filter((t) => t.count >= 1);
  const validDay = dayData.filter((d) => d.count >= 1);

  if (validTime.length === 0 || validDay.length === 0) {
    return null;
  }

  const bestTimeSlot = validTime.reduce((best, cur) =>
    cur.avgDuration > best.avgDuration ? cur : best
  );

  const bestDay = validDay.reduce((best, cur) =>
    cur.avgDuration > best.avgDuration ? cur : best
  );

  return { timeSlot: bestTimeSlot, day: bestDay };
}

// ----------------------------------------
// Weekly Data
// ----------------------------------------

export function getWeeklyData(sessions: Session[]): WeeklyDayData[] {
  const days: WeeklyDayData[] = [];
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = getDateString(date);
    const dayTotal = sessions
      .filter((s) => s.date === dateStr)
      .reduce((sum, s) => sum + s.duration, 0);

    days.push({
      date: dateStr,
      label: `${date.getMonth() + 1}/${date.getDate()}(${dayNames[date.getDay()]})`,
      duration: dayTotal,
    });
  }
  return days;
}

// ----------------------------------------
// Formatters
// ----------------------------------------

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatShortDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h${m}m`;
  return `${m}m`;
}

export function getDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
