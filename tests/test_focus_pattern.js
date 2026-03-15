'use strict';

const assert = require('assert');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// Helper: create a mock app with analysis methods extracted from app.js
function createAnalysisApp(sessions) {
  return {
    history: { sessions: sessions || [] },

    getTimeSlot(hour) {
      if (hour >= 5 && hour < 12) return 0;
      if (hour >= 12 && hour < 14) return 1;
      if (hour >= 14 && hour < 18) return 2;
      return 3;
    },

    getTimeSlotLabel(index) {
      const labels = ['朝(5-11時)', '昼(12-13時)', '午後(14-17時)', '夜(18-4時)'];
      return labels[index];
    },

    getTimeOfDayData() {
      const slots = [
        { label: '朝(5-11時)', totalDuration: 0, count: 0 },
        { label: '昼(12-13時)', totalDuration: 0, count: 0 },
        { label: '午後(14-17時)', totalDuration: 0, count: 0 },
        { label: '夜(18-4時)', totalDuration: 0, count: 0 },
      ];

      for (const session of this.history.sessions) {
        if (!session.timestamp) continue;
        const hour = new Date(session.timestamp).getHours();
        const slotIndex = this.getTimeSlot(hour);
        slots[slotIndex].totalDuration += session.duration;
        slots[slotIndex].count += 1;
      }

      return slots.map((slot) => ({
        label: slot.label,
        avgDuration: slot.count > 0 ? Math.round(slot.totalDuration / slot.count) : 0,
        count: slot.count,
      }));
    },

    getDayOfWeekData() {
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      const days = dayNames.map((name) => ({
        label: name,
        totalDuration: 0,
        count: 0,
      }));

      for (const session of this.history.sessions) {
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
    },

    getStatsSummary() {
      const sessions = this.history.sessions;
      const totalSessions = sessions.length;

      if (totalSessions === 0) {
        return { totalSessions: 0, avgDuration: 0, maxDuration: 0, weekComparison: null };
      }

      const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
      const avgDuration = Math.round(totalDuration / totalSessions);
      const maxDuration = Math.max(...sessions.map((s) => s.duration));

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayOfWeek = todayStart.getDay();
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
        const changePercent = Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100);
        weekComparison = { thisWeek: thisWeekTotal, lastWeek: lastWeekTotal, changePercent };
      } else if (thisWeekTotal > 0) {
        weekComparison = { thisWeek: thisWeekTotal, lastWeek: 0, changePercent: null };
      }

      return { totalSessions, avgDuration, maxDuration, weekComparison };
    },

    getBestTime() {
      const timeData = this.getTimeOfDayData();
      const dayData = this.getDayOfWeekData();

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
    },
  };
}

// Helper to create a timestamp at a specific hour on a specific day
function makeTimestamp(year, month, day, hour, minute) {
  return new Date(year, month - 1, day, hour, minute, 0).getTime();
}

// --- getTimeSlot tests ---

test('getTimeSlot returns 0 (morning) for hours 5-11', () => {
  const app = createAnalysisApp();
  assert.strictEqual(app.getTimeSlot(5), 0);
  assert.strictEqual(app.getTimeSlot(8), 0);
  assert.strictEqual(app.getTimeSlot(11), 0);
});

test('getTimeSlot returns 1 (noon) for hours 12-13', () => {
  const app = createAnalysisApp();
  assert.strictEqual(app.getTimeSlot(12), 1);
  assert.strictEqual(app.getTimeSlot(13), 1);
});

test('getTimeSlot returns 2 (afternoon) for hours 14-17', () => {
  const app = createAnalysisApp();
  assert.strictEqual(app.getTimeSlot(14), 2);
  assert.strictEqual(app.getTimeSlot(17), 2);
});

test('getTimeSlot returns 3 (night) for hours 18-4', () => {
  const app = createAnalysisApp();
  assert.strictEqual(app.getTimeSlot(18), 3);
  assert.strictEqual(app.getTimeSlot(23), 3);
  assert.strictEqual(app.getTimeSlot(0), 3);
  assert.strictEqual(app.getTimeSlot(4), 3);
});

// --- getTimeOfDayData tests ---

test('getTimeOfDayData returns zeros for empty sessions', () => {
  const app = createAnalysisApp([]);
  const data = app.getTimeOfDayData();
  assert.strictEqual(data.length, 4);
  assert.strictEqual(data[0].avgDuration, 0);
  assert.strictEqual(data[0].count, 0);
});

test('getTimeOfDayData calculates average correctly', () => {
  const sessions = [
    { date: '2026-03-10', duration: 600, timestamp: makeTimestamp(2026, 3, 10, 9, 0) },
    { date: '2026-03-11', duration: 1200, timestamp: makeTimestamp(2026, 3, 11, 10, 0) },
    { date: '2026-03-12', duration: 900, timestamp: makeTimestamp(2026, 3, 12, 15, 0) },
  ];
  const app = createAnalysisApp(sessions);
  const data = app.getTimeOfDayData();

  // Morning: (600 + 1200) / 2 = 900
  assert.strictEqual(data[0].avgDuration, 900);
  assert.strictEqual(data[0].count, 2);
  // Afternoon: 900 / 1 = 900
  assert.strictEqual(data[2].avgDuration, 900);
  assert.strictEqual(data[2].count, 1);
});

test('getTimeOfDayData skips sessions without timestamp', () => {
  const sessions = [
    { date: '2026-03-10', duration: 600 }, // no timestamp
  ];
  const app = createAnalysisApp(sessions);
  const data = app.getTimeOfDayData();
  assert.strictEqual(data[0].count, 0);
  assert.strictEqual(data[1].count, 0);
  assert.strictEqual(data[2].count, 0);
  assert.strictEqual(data[3].count, 0);
});

// --- getDayOfWeekData tests ---

test('getDayOfWeekData returns zeros for empty sessions', () => {
  const app = createAnalysisApp([]);
  const data = app.getDayOfWeekData();
  assert.strictEqual(data.length, 7);
  for (const d of data) {
    assert.strictEqual(d.avgDuration, 0);
    assert.strictEqual(d.count, 0);
  }
});

test('getDayOfWeekData groups by day of week correctly', () => {
  // 2026-03-09 is Monday, 2026-03-10 is Tuesday
  const sessions = [
    { date: '2026-03-09', duration: 1000, timestamp: makeTimestamp(2026, 3, 9, 10, 0) },
    { date: '2026-03-10', duration: 2000, timestamp: makeTimestamp(2026, 3, 10, 14, 0) },
    { date: '2026-03-10', duration: 1000, timestamp: makeTimestamp(2026, 3, 10, 16, 0) },
  ];
  const app = createAnalysisApp(sessions);
  const data = app.getDayOfWeekData();

  // Check the correct day got the data (getDay: Mon=1, Tue=2)
  const monDay = new Date(2026, 2, 9).getDay();
  const tueDay = new Date(2026, 2, 10).getDay();

  assert.strictEqual(data[monDay].count, 1);
  assert.strictEqual(data[monDay].avgDuration, 1000);
  assert.strictEqual(data[tueDay].count, 2);
  assert.strictEqual(data[tueDay].avgDuration, 1500); // (2000+1000)/2
});

// --- getStatsSummary tests ---

test('getStatsSummary returns zeros for empty sessions', () => {
  const app = createAnalysisApp([]);
  const stats = app.getStatsSummary();
  assert.strictEqual(stats.totalSessions, 0);
  assert.strictEqual(stats.avgDuration, 0);
  assert.strictEqual(stats.maxDuration, 0);
  assert.strictEqual(stats.weekComparison, null);
});

test('getStatsSummary calculates basic stats correctly', () => {
  const sessions = [
    { date: '2026-01-01', duration: 300, timestamp: makeTimestamp(2026, 1, 1, 10, 0) },
    { date: '2026-01-01', duration: 600, timestamp: makeTimestamp(2026, 1, 1, 14, 0) },
    { date: '2026-01-02', duration: 900, timestamp: makeTimestamp(2026, 1, 2, 10, 0) },
  ];
  const app = createAnalysisApp(sessions);
  const stats = app.getStatsSummary();

  assert.strictEqual(stats.totalSessions, 3);
  assert.strictEqual(stats.avgDuration, 600); // (300+600+900)/3
  assert.strictEqual(stats.maxDuration, 900);
});

test('getStatsSummary week comparison: this week has data, last week has no data', () => {
  const now = new Date();
  const sessions = [
    { date: '2026-03-15', duration: 500, timestamp: now.getTime() },
  ];
  const app = createAnalysisApp(sessions);
  const stats = app.getStatsSummary();

  // Should show thisWeek data, changePercent null
  if (stats.weekComparison) {
    assert.strictEqual(stats.weekComparison.changePercent, null);
    assert.ok(stats.weekComparison.thisWeek > 0);
  }
});

// --- getBestTime tests ---

test('getBestTime returns null for empty sessions', () => {
  const app = createAnalysisApp([]);
  const best = app.getBestTime();
  assert.strictEqual(best, null);
});

test('getBestTime identifies the best time slot and day', () => {
  const sessions = [
    // Morning sessions: avg 500
    { date: '2026-03-09', duration: 500, timestamp: makeTimestamp(2026, 3, 9, 9, 0) },
    // Afternoon sessions: avg 1500
    { date: '2026-03-10', duration: 1500, timestamp: makeTimestamp(2026, 3, 10, 15, 0) },
    // Night session: avg 800
    { date: '2026-03-11', duration: 800, timestamp: makeTimestamp(2026, 3, 11, 20, 0) },
  ];
  const app = createAnalysisApp(sessions);
  const best = app.getBestTime();

  assert.ok(best !== null);
  assert.strictEqual(best.timeSlot.label, '午後(14-17時)');
  assert.strictEqual(best.timeSlot.avgDuration, 1500);
});

test('getBestTime picks highest average when multiple sessions in same slot', () => {
  const sessions = [
    { date: '2026-03-09', duration: 600, timestamp: makeTimestamp(2026, 3, 9, 9, 0) },
    { date: '2026-03-10', duration: 1200, timestamp: makeTimestamp(2026, 3, 10, 10, 0) },
    { date: '2026-03-11', duration: 300, timestamp: makeTimestamp(2026, 3, 11, 15, 0) },
  ];
  const app = createAnalysisApp(sessions);
  const best = app.getBestTime();

  assert.ok(best !== null);
  // Morning avg = (600+1200)/2 = 900, Afternoon avg = 300
  assert.strictEqual(best.timeSlot.label, '朝(5-11時)');
  assert.strictEqual(best.timeSlot.avgDuration, 900);
});

// --- getTimeSlotLabel test ---

test('getTimeSlotLabel returns correct labels', () => {
  const app = createAnalysisApp();
  assert.strictEqual(app.getTimeSlotLabel(0), '朝(5-11時)');
  assert.strictEqual(app.getTimeSlotLabel(1), '昼(12-13時)');
  assert.strictEqual(app.getTimeSlotLabel(2), '午後(14-17時)');
  assert.strictEqual(app.getTimeSlotLabel(3), '夜(18-4時)');
});

module.exports = tests;
