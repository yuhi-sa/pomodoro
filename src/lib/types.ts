// ========================================
// Type Definitions
// ========================================

export const State = {
  READY: 'ready',
  IDLING: 'idling',
  IDLING_DONE: 'idling_done',
  WORKING: 'working',
  SHORT_BREAK: 'short_break',
  BREAK: 'break',
} as const;

export type StateValue = (typeof State)[keyof typeof State];

export interface Session {
  date: string;
  duration: number;
  timestamp: number;
}

export interface History {
  sessions: Session[];
}

export interface Settings {
  sound: boolean;
  autoTransition: boolean;
}

export interface TimeSlotData {
  label: string;
  avgDuration: number;
  count: number;
}

export interface DayOfWeekData {
  label: string;
  avgDuration: number;
  count: number;
}

export interface WeekComparison {
  thisWeek: number;
  lastWeek: number;
  changePercent: number | null;
}

export interface StatsSummary {
  totalSessions: number;
  avgDuration: number;
  maxDuration: number;
  weekComparison: WeekComparison | null;
}

export interface BestTime {
  timeSlot: TimeSlotData;
  day: DayOfWeekData;
}

export interface WeeklyDayData {
  date: string;
  label: string;
  duration: number;
}

// Constants
export const CIRCUMFERENCE = 2 * Math.PI * 88; // ~553
export const IDLING_DURATION = 60; // 1 minute
export const SHORT_BREAK_DURATION = 60; // 1 minute
export const AUTO_TRANSITION_DELAY = 5; // seconds
export const IDLING_TICK_INTERVAL_MS = 100;
export const AUDIO_VOLUME = 0.25;
export const MIN_SESSION_DURATION = 5;
