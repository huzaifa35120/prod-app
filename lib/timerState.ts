import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TimerState {
  running: boolean;
  /** Epoch ms when the current run began, or null while paused. */
  startedAt: number | null;
  /** Seconds banked from previous runs. */
  accumulated: number;
}

export const IDLE: TimerState = { running: false, startedAt: null, accumulated: 0 };

/** Context for the timer currently shown in the notification shade. */
export interface ActiveTimer {
  storageKey: string;
  challengeId: string;
  challengeTitle: string;
  dayNumber: number;
}

const ACTIVE_KEY = 'timer:active';

/**
 * Elapsed seconds, derived from wall-clock timestamps rather than counted
 * ticks — so time passing while the app is suspended still counts, and a
 * dropped interval can never lose seconds.
 */
export function elapsedOf(s: TimerState, now = Date.now()): number {
  return Math.floor(s.accumulated + (s.running && s.startedAt ? (now - s.startedAt) / 1000 : 0));
}

export function startOf(s: TimerState): TimerState {
  return s.running ? s : { ...s, running: true, startedAt: Date.now() };
}

export function pauseOf(s: TimerState): TimerState {
  if (!s.running || !s.startedAt) return s;
  return {
    running: false,
    startedAt: null,
    accumulated: s.accumulated + (Date.now() - s.startedAt) / 1000,
  };
}

export function addOf(s: TimerState, seconds: number): TimerState {
  return { ...s, accumulated: s.accumulated + seconds };
}

/* ---------------- persistence ---------------- */

export async function readTimer(key: string): Promise<TimerState> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return IDLE;
    const parsed = JSON.parse(raw) as TimerState;
    return typeof parsed?.accumulated === 'number' ? parsed : IDLE;
  } catch {
    return IDLE;
  }
}

export async function writeTimer(key: string, s: TimerState): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(s));
  } catch {
    // A failed write costs at most the current run, never a crash.
  }
}

/**
 * Read-modify-write. Used by the notification's action handler, which runs in
 * a headless task with no React state to go through.
 */
export async function mutateTimer(
  key: string,
  fn: (s: TimerState) => TimerState
): Promise<TimerState> {
  const next = fn(await readTimer(key));
  await writeTimer(key, next);
  return next;
}

/* ---------------- which timer the notification owns ---------------- */

export async function setActiveTimer(meta: ActiveTimer | null): Promise<void> {
  try {
    if (meta) await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(meta));
    else await AsyncStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}

export async function getActiveTimer(): Promise<ActiveTimer | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_KEY);
    return raw ? (JSON.parse(raw) as ActiveTimer) : null;
  } catch {
    return null;
  }
}
