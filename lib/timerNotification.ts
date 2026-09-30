import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  elapsedOf, getActiveTimer, IDLE, mutateTimer, pauseOf, readTimer, serialise,
  setActiveTimer, startOf, writeTimer,
  type ActiveTimer, type TimerState,
} from './timerState';
import { formatClock } from './format';
import {
  ensureChannels, notifications, NOTIFICATIONS_SUPPORTED, TIMER_CHANNEL,
} from './notifications';
import { supabase } from './supabase';
import { logFocusSession } from './api';

const NOTIFICATION_ID = 'focus-timer';
const HANDLED_KEY = 'timer:lastHandledAction';

/** Button titles are baked into a category, so each state needs its own. */
const CATEGORY_RUNNING = 'focus-timer-running';
const CATEGORY_PAUSED = 'focus-timer-paused';

export const TIMER_ACTIONS = {
  pause: 'timer-pause',
  resume: 'timer-resume',
  log: 'timer-log',
  stop: 'timer-stop',
} as const;

type Listener = (key: string, state: TimerState) => void;
const listeners = new Set<Listener>();

/** Lets a mounted screen adopt a change made from the notification. */
export function onTimerChangedExternally(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function announce(key: string, state: TimerState) {
  listeners.forEach((fn) => {
    try {
      fn(key, state);
    } catch {
      // A listener on an unmounted screen must not take the app down.
    }
  });
}

/* ------------------------------------------------------------------ */
/*  Rendering                                                          */
/* ------------------------------------------------------------------ */

let categoriesReady = false;

async function ensureCategories(): Promise<void> {
  const N = notifications();
  if (!N || categoriesReady) return;

  // The timer can be shown before usePushRegistration has run, so the silent
  // channel has to be created here too or Android falls back to a noisy one.
  await ensureChannels();

  // opensAppToForeground: the timer is timestamp-based, so an action applied
  // late would over-count. Bringing the app up guarantees it lands now.
  const opts = { opensAppToForeground: true };
  await N.setNotificationCategoryAsync(CATEGORY_RUNNING, [
    { identifier: TIMER_ACTIONS.pause, buttonTitle: 'Pause', options: opts },
    { identifier: TIMER_ACTIONS.log, buttonTitle: 'Log it', options: opts },
    { identifier: TIMER_ACTIONS.stop, buttonTitle: 'Discard', options: opts },
  ]);
  await N.setNotificationCategoryAsync(CATEGORY_PAUSED, [
    { identifier: TIMER_ACTIONS.resume, buttonTitle: 'Resume', options: opts },
    { identifier: TIMER_ACTIONS.log, buttonTitle: 'Log it', options: opts },
    { identifier: TIMER_ACTIONS.stop, buttonTitle: 'Discard', options: opts },
  ]);
  categoriesReady = true;
}

/** Draws the notification. Never throws. */
async function render(meta: ActiveTimer, state: TimerState): Promise<void> {
  const N = notifications();
  if (!N) return;

  try {
    await ensureCategories();
    await N.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        // The elapsed clock is the headline — Android has no chronometer we
        // can reach from here, so the number is redrawn by the ticker below.
        title: formatClock(elapsedOf(state)),
        body: `${state.running ? 'Recording' : 'Paused'} · ${meta.challengeTitle} · Day ${meta.dayNumber}`,
        categoryIdentifier: state.running ? CATEGORY_RUNNING : CATEGORY_PAUSED,
        data: { challengeId: meta.challengeId, dayNumber: meta.dayNumber, timer: true },
        sticky: state.running,
        autoDismiss: false,
        sound: false,
        ...(TIMER_CHANNEL ? { channelId: TIMER_CHANNEL } : {}),
      },
      trigger: null,
    });
  } catch {
    // The timer itself must keep working even if the shade will not.
  }
}

/* ------------------------------------------------------------------ */
/*  The ticker that keeps the number moving                            */
/* ------------------------------------------------------------------ */

let ticker: ReturnType<typeof setInterval> | null = null;
let ticking = false;

function stopTicker() {
  if (ticker) {
    clearInterval(ticker);
    ticker = null;
  }
}

function startTicker() {
  stopTicker();
  ticker = setInterval(() => {
    if (ticking) return; // a slow redraw must not queue more work behind it
    ticking = true;
    void (async () => {
      try {
        const meta = await getActiveTimer();
        if (!meta) return stopTicker();
        const state = await readTimer(meta.storageKey);
        if (!state.running) return stopTicker();
        await render(meta, state);
      } catch {
        stopTicker();
      } finally {
        ticking = false;
      }
    })();
  }, 1000);
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export async function showTimerNotification(
  meta: ActiveTimer,
  state: TimerState
): Promise<void> {
  if (!NOTIFICATIONS_SUPPORTED) return;
  try {
    await setActiveTimer(meta);
    await render(meta, state);
    if (state.running) startTicker();
    else stopTicker();
  } catch {
    /* never throw at a caller */
  }
}

/**
 * Clears the shade.
 *
 * `onlyForKey` guards against a screen for a different day wiping a
 * notification that does not belong to it — opening an idle day used to
 * cancel a timer still running on another one.
 */
export async function clearTimerNotification(onlyForKey?: string): Promise<void> {
  if (!NOTIFICATIONS_SUPPORTED) return;
  if (onlyForKey) {
    const active = await getActiveTimer();
    if (active && active.storageKey !== onlyForKey) return;
  }
  stopTicker();
  try {
    await setActiveTimer(null);
  } catch {
    /* ignore */
  }
  const N = notifications();
  if (!N) return;
  try {
    await N.dismissNotificationAsync(NOTIFICATION_ID);
  } catch {
    /* not presented */
  }
}

/* ------------------------------------------------------------------ */
/*  Actions                                                            */
/* ------------------------------------------------------------------ */

/** Banks the running time as a focus session, straight from the shade. */
async function logFromNotification(meta: ActiveTimer, state: TimerState): Promise<void> {
  const paused = pauseOf(state);
  const seconds = elapsedOf(paused);
  if (seconds < 1) return;

  // A press that cold-started the app can arrive before supabase-js has read
  // the stored session, so give it a moment rather than failing outright.
  let uid: string | undefined;
  for (let attempt = 0; attempt < 5 && !uid; attempt++) {
    const { data } = await supabase.auth.getSession();
    uid = data.session?.user?.id;
    if (!uid) await new Promise((r) => setTimeout(r, 300));
  }
  if (!uid) throw new Error('Not signed in');

  await logFocusSession(meta.challengeId, meta.dayId, uid, seconds, null);

  await writeTimer(meta.storageKey, IDLE);
  announce(meta.storageKey, IDLE);
  await clearTimerNotification();
}

/**
 * Applies a pressed action.
 *
 * Every press is queued behind the previous one. Without that, two quick
 * presses interleave their read-modify-write against the same storage entry
 * and one silently wins — which is why pressing Pause repeatedly looked like
 * it did nothing.
 */
async function applyAction(actionId: string): Promise<void> {
  const meta = await getActiveTimer();
  if (!meta) return;

  if (actionId === TIMER_ACTIONS.log) {
    try {
      await logFromNotification(meta, await readTimer(meta.storageKey));
    } catch {
      // Offline or signed out: fall back to pausing so nothing is lost.
      const next = await mutateTimer(meta.storageKey, pauseOf);
      announce(meta.storageKey, next);
      await showTimerNotification(meta, next);
    }
    return;
  }

  if (actionId === TIMER_ACTIONS.stop) {
    const next = await mutateTimer(meta.storageKey, pauseOf);
    announce(meta.storageKey, next);
    await clearTimerNotification();
    return;
  }

  const next = await mutateTimer(
    meta.storageKey,
    actionId === TIMER_ACTIONS.pause ? pauseOf : startOf
  );
  announce(meta.storageKey, next);
  await showTimerNotification(meta, next);
}

function isTimerAction(id: string | undefined): id is string {
  return !!id && (Object.values(TIMER_ACTIONS) as string[]).includes(id);
}

/**
 * Cold starts deliver the launching press through
 * getLastNotificationResponseAsync, which keeps returning the same response
 * on every later launch. Without a marker the app re-applies a stale action
 * each time it opens.
 */
async function alreadyHandled(key: string): Promise<boolean> {
  try {
    const seen = await AsyncStorage.getItem(HANDLED_KEY);
    if (seen === key) return true;
    await AsyncStorage.setItem(HANDLED_KEY, key);
    return false;
  } catch {
    return false;
  }
}

/** Registered once from the app root. */
export function registerTimerNotificationHandlers(): () => void {
  const N = notifications();
  if (!N) return () => {};

  const handle = (actionId: string | undefined, key: string) => {
    if (!isTimerAction(actionId)) return;
    void serialise(async () => {
      try {
        if (await alreadyHandled(key)) return;
        await applyAction(actionId);
      } catch {
        // An action that fails must not surface as a crash.
      }
    });
  };

  // The same press can arrive twice — once through the cold-start lookup and
  // once through the listener. Both derive the SAME key, so the second is
  // dropped. Keying on the notification's delivery date works because each
  // action redraws the notification.
  const keyOf = (response: {
    actionIdentifier: string;
    notification: { date: number; request: { identifier: string } };
  }) =>
    `${response.notification.request.identifier}:${response.actionIdentifier}:${response.notification.date}`;

  void N.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) handle(response.actionIdentifier, keyOf(response));
    })
    .catch(() => {});

  const sub = N.addNotificationResponseReceivedListener((response) => {
    handle(response.actionIdentifier, keyOf(response));
  });

  return () => {
    stopTicker();
    sub.remove();
  };
}

/** Re-reads storage for whichever timer the notification is showing. */
export async function readActiveTimerState(): Promise<
  { meta: ActiveTimer; state: TimerState } | null
> {
  const meta = await getActiveTimer();
  if (!meta) return null;
  return { meta, state: await readTimer(meta.storageKey) };
}
