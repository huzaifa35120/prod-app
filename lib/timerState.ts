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
  /** Needed so "Log it" can write a focus session straight from the shade. */
  dayId: string;
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
  // A device clock that jumps backwards (timezone change, NTP correction)
  // would otherwise make the run negative and the timer count down.
  const run = s.running && s.startedAt ? Math.max(0, (now - s.startedAt) / 1000) : 0;
  return Math.max(0, Math.floor(s.accumulated + run));
}

export function startOf(s: TimerState): TimerState {
  return s.running ? s : { ...s, running: true, startedAt: Date.now() };
}

export function pauseOf(s: TimerState): TimerState {
  if (!s.running || !s.startedAt) return s;
  return {
    running: false,
    startedAt: null,
    accumulated: s.accumulated + Math.max(0, (Date.now() - s.startedAt) / 1000),
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
 * Serialises every read-modify-write against storage.
 *
 * Two of these can otherwise overlap — a notification action and the screen
 * both mutate the same entry — and the slower read would overwrite the faster
 * write. That is what made repeated Pause/Resume presses appear to do nothing.
 */
let chain: Promise<unknown> = Promise.resolve();

export function serialise<T>(work: () => Promise<T>): Promise<T> {
  const run = chain.then(work, work);
  // Keep the chain alive even if this link rejects.
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** Read-modify-write, serialised against every other mutation. */
export function mutateTimer(
  key: string,
  fn: (s: TimerState) => TimerState
): Promise<TimerState> {
  return serialise(async () => {
    const next = fn(await readTimer(key));
    await writeTimer(key, next);
    return next;
  });
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
