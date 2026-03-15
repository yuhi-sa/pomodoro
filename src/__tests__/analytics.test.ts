import {
  getTimeSlot,
  getTimeSlotLabel,
  getTimeOfDayData,
  getDayOfWeekData,
  getStatsSummary,
  getBestTime,
  getWeeklyData,
  formatTime,
  formatDuration,
  formatShortDuration,
  getDateString,
} from '../lib/analytics';
import type { Session } from '../lib/types';

// Helper to create a timestamp at a specific hour on a specific day
function makeTimestamp(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): number {
  return new Date(year, month - 1, day, hour, minute, 0).getTime();
}

// --- getTimeSlot tests ---

test('getTimeSlot returns 0 (morning) for hours 5-11', () => {
  expect(getTimeSlot(5)).toBe(0);
  expect(getTimeSlot(8)).toBe(0);
  expect(getTimeSlot(11)).toBe(0);
});

test('getTimeSlot returns 1 (noon) for hours 12-13', () => {
  expect(getTimeSlot(12)).toBe(1);
  expect(getTimeSlot(13)).toBe(1);
});

test('getTimeSlot returns 2 (afternoon) for hours 14-17', () => {
  expect(getTimeSlot(14)).toBe(2);
  expect(getTimeSlot(17)).toBe(2);
});

test('getTimeSlot returns 3 (night) for hours 18-4', () => {
  expect(getTimeSlot(18)).toBe(3);
  expect(getTimeSlot(23)).toBe(3);
  expect(getTimeSlot(0)).toBe(3);
  expect(getTimeSlot(4)).toBe(3);
});

// --- getTimeSlotLabel tests ---

test('getTimeSlotLabel returns correct labels', () => {
  expect(getTimeSlotLabel(0)).toBe('朝(5-11時)');
  expect(getTimeSlotLabel(1)).toBe('昼(12-13時)');
  expect(getTimeSlotLabel(2)).toBe('午後(14-17時)');
  expect(getTimeSlotLabel(3)).toBe('夜(18-4時)');
});

// --- getTimeOfDayData tests ---

test('getTimeOfDayData returns zeros for empty sessions', () => {
  const data = getTimeOfDayData([]);
  expect(data.length).toBe(4);
  expect(data[0].avgDuration).toBe(0);
  expect(data[0].count).toBe(0);
});

test('getTimeOfDayData calculates average correctly', () => {
  const sessions: Session[] = [
    { date: '2026-03-10', duration: 600, timestamp: makeTimestamp(2026, 3, 10, 9, 0) },
    { date: '2026-03-11', duration: 1200, timestamp: makeTimestamp(2026, 3, 11, 10, 0) },
    { date: '2026-03-12', duration: 900, timestamp: makeTimestamp(2026, 3, 12, 15, 0) },
  ];
  const data = getTimeOfDayData(sessions);

  // Morning: (600 + 1200) / 2 = 900
  expect(data[0].avgDuration).toBe(900);
  expect(data[0].count).toBe(2);
  // Afternoon: 900 / 1 = 900
  expect(data[2].avgDuration).toBe(900);
  expect(data[2].count).toBe(1);
});

test('getTimeOfDayData skips sessions without timestamp', () => {
  const sessions = [{ date: '2026-03-10', duration: 600 }] as Session[];
  const data = getTimeOfDayData(sessions);
  expect(data[0].count).toBe(0);
  expect(data[1].count).toBe(0);
  expect(data[2].count).toBe(0);
  expect(data[3].count).toBe(0);
});

// --- getDayOfWeekData tests ---

test('getDayOfWeekData returns zeros for empty sessions', () => {
  const data = getDayOfWeekData([]);
  expect(data.length).toBe(7);
  for (const d of data) {
    expect(d.avgDuration).toBe(0);
    expect(d.count).toBe(0);
  }
});

test('getDayOfWeekData groups by day of week correctly', () => {
  // 2026-03-09 is Monday, 2026-03-10 is Tuesday
  const sessions: Session[] = [
    { date: '2026-03-09', duration: 1000, timestamp: makeTimestamp(2026, 3, 9, 10, 0) },
    { date: '2026-03-10', duration: 2000, timestamp: makeTimestamp(2026, 3, 10, 14, 0) },
    { date: '2026-03-10', duration: 1000, timestamp: makeTimestamp(2026, 3, 10, 16, 0) },
  ];
  const data = getDayOfWeekData(sessions);

  const monDay = new Date(2026, 2, 9).getDay();
  const tueDay = new Date(2026, 2, 10).getDay();

  expect(data[monDay].count).toBe(1);
  expect(data[monDay].avgDuration).toBe(1000);
  expect(data[tueDay].count).toBe(2);
  expect(data[tueDay].avgDuration).toBe(1500);
});

// --- getStatsSummary tests ---

test('getStatsSummary returns zeros for empty sessions', () => {
  const stats = getStatsSummary([]);
  expect(stats.totalSessions).toBe(0);
  expect(stats.avgDuration).toBe(0);
  expect(stats.maxDuration).toBe(0);
  expect(stats.weekComparison).toBeNull();
});

test('getStatsSummary calculates basic stats correctly', () => {
  const sessions: Session[] = [
    { date: '2026-01-01', duration: 300, timestamp: makeTimestamp(2026, 1, 1, 10, 0) },
    { date: '2026-01-01', duration: 600, timestamp: makeTimestamp(2026, 1, 1, 14, 0) },
    { date: '2026-01-02', duration: 900, timestamp: makeTimestamp(2026, 1, 2, 10, 0) },
  ];
  const stats = getStatsSummary(sessions);

  expect(stats.totalSessions).toBe(3);
  expect(stats.avgDuration).toBe(600); // (300+600+900)/3
  expect(stats.maxDuration).toBe(900);
});

test('getStatsSummary week comparison: this week has data, last week has no data', () => {
  const now = new Date();
  const sessions: Session[] = [
    { date: '2026-03-15', duration: 500, timestamp: now.getTime() },
  ];
  const stats = getStatsSummary(sessions);

  if (stats.weekComparison) {
    expect(stats.weekComparison.changePercent).toBeNull();
    expect(stats.weekComparison.thisWeek).toBeGreaterThan(0);
  }
});

// --- getBestTime tests ---

test('getBestTime returns null for empty sessions', () => {
  const best = getBestTime([]);
  expect(best).toBeNull();
});

test('getBestTime identifies the best time slot and day', () => {
  const sessions: Session[] = [
    { date: '2026-03-09', duration: 500, timestamp: makeTimestamp(2026, 3, 9, 9, 0) },
    { date: '2026-03-10', duration: 1500, timestamp: makeTimestamp(2026, 3, 10, 15, 0) },
    { date: '2026-03-11', duration: 800, timestamp: makeTimestamp(2026, 3, 11, 20, 0) },
  ];
  const best = getBestTime(sessions);

  expect(best).not.toBeNull();
  expect(best!.timeSlot.label).toBe('午後(14-17時)');
  expect(best!.timeSlot.avgDuration).toBe(1500);
});

test('getBestTime picks highest average when multiple sessions in same slot', () => {
  const sessions: Session[] = [
    { date: '2026-03-09', duration: 600, timestamp: makeTimestamp(2026, 3, 9, 9, 0) },
    { date: '2026-03-10', duration: 1200, timestamp: makeTimestamp(2026, 3, 10, 10, 0) },
    { date: '2026-03-11', duration: 300, timestamp: makeTimestamp(2026, 3, 11, 15, 0) },
  ];
  const best = getBestTime(sessions);

  expect(best).not.toBeNull();
  expect(best!.timeSlot.label).toBe('朝(5-11時)');
  expect(best!.timeSlot.avgDuration).toBe(900);
});

// --- formatTime tests ---

test('formatTime formats 0 seconds as 0:00', () => {
  expect(formatTime(0)).toBe('0:00');
});

test('formatTime formats 65 seconds as 1:05', () => {
  expect(formatTime(65)).toBe('1:05');
});

test('formatTime formats 600 seconds as 10:00', () => {
  expect(formatTime(600)).toBe('10:00');
});

// --- formatDuration tests ---

test('formatDuration formats 3661 seconds as 1:01:01', () => {
  expect(formatDuration(3661)).toBe('1:01:01');
});

test('formatDuration formats 0 seconds as 0:00:00', () => {
  expect(formatDuration(0)).toBe('0:00:00');
});

// --- formatShortDuration tests ---

test('formatShortDuration formats minutes only', () => {
  expect(formatShortDuration(300)).toBe('5m');
});

test('formatShortDuration formats hours and minutes', () => {
  expect(formatShortDuration(3900)).toBe('1h5m');
});

// --- getDateString tests ---

test('getDateString formats date correctly (YYYY-MM-DD)', () => {
  const date = new Date(2026, 2, 15); // March 15, 2026
  expect(getDateString(date)).toBe('2026-03-15');
});

test('Single-digit months are zero-padded', () => {
  const date = new Date(2026, 0, 20); // January 20, 2026
  expect(getDateString(date)).toBe('2026-01-20');
});

test('Single-digit days are zero-padded', () => {
  const date = new Date(2026, 11, 5); // December 5, 2026
  expect(getDateString(date)).toBe('2026-12-05');
});

test('Double-digit month and day are not double-padded', () => {
  const date = new Date(2026, 10, 25); // November 25, 2026
  expect(getDateString(date)).toBe('2026-11-25');
});

test('December 31 formats correctly', () => {
  const date = new Date(2025, 11, 31);
  expect(getDateString(date)).toBe('2025-12-31');
});
