import { Platform } from 'react-native';
import notifee, { AndroidImportance, EventType, type Event } from '@notifee/react-native';
import {
  elapsedOf, getActiveTimer, IDLE, mutateTimer, pauseOf, readTimer, serialise,
  setActiveTimer, startOf, writeTimer,
  type ActiveTimer, type TimerState,
} from './timerState';
import { formatClock } from './format';
import { supabase } from './supabase';
import { logFocusSession } from './api';

const NOTIFICATION_ID = 'focus-timer';
const CHANNEL_ID = 'focus-timer';

const SUPPORTED = Platform.OS === 'android';

export const TIMER_ACTIONS = {
  pause: 'timer-pause',
  resume: 'timer-resume',
  log: 'timer-log',
  stop: 'timer-stop',
} as const;

type Listener = (key: string, state: TimerState) => void;
const listeners = new Set<Listener>();

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
/*  Drawing                                                            */
/* ------------------------------------------------------------------ */

let channelReady = false;

async function ensureChannel(): Promise<void> {
  if (channelReady) return;
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Productivity timer',
    description: 'The running timer, so you can control it from the shade.',
    // LOW keeps it in the shade without a heads-up banner or sound.
    importance: AndroidImportance.LOW,
    vibration: false,
  });
  channelReady = true;
}

/**
 * Shows (or updates) the ongoing timer notification.
 *
 * The elapsed count is drawn by **Android's own chronometer**: we hand it the
 * instant the run effectively started and the OS ticks the display itself.
 * Nothing in JS redraws it.
 *
 * That matters for three reasons the previous JS-redraw approach got wrong:
 *   - it does not re-alert, because we are not re-posting once a second;
 *   - it keeps counting when the app is backgrounded or killed, because no
 *     JavaScript is involved in the ticking;
 *   - it costs nothing in battery.
 */
export async function showTimerNotification(
  meta: ActiveTimer,
  state: TimerState
): Promise<void> {
  if (!SUPPORTED) return;

  try {
    await ensureChannel();
    await setActiveTimer(meta);

    const elapsedMs = elapsedOf(state) * 1000;
    const actions = state.running
      ? [
          { title: 'Pause', pressAction: { id: TIMER_ACTIONS.pause } },
          { title: 'Log it', pressAction: { id: TIMER_ACTIONS.log } },
        ]
      : [
          { title: 'Resume', pressAction: { id: TIMER_ACTIONS.resume } },
          { title: 'Log it', pressAction: { id: TIMER_ACTIONS.log } },
          { title: 'Discard', pressAction: { id: TIMER_ACTIONS.stop } },
        ];

    await notifee.displayNotification({
      id: NOTIFICATION_ID,
      // Running: Android's chronometer draws the live count in the time slot.
      // Paused: the chronometer is off, so the banked figure goes in the title
      // or the notification would show no number at all.
      title: state.running
        ? 'Recording focused time'
        : `${formatClock(elapsedOf(state))} banked`,
      body: `${meta.challengeTitle} · Day ${meta.dayNumber}`,
      data: { challengeId: meta.challengeId, dayNumber: String(meta.dayNumber) },
      android: {
        channelId: CHANNEL_ID,
        smallIcon: 'notification_icon',
        color: '#CCFF00',
        ongoing: state.running,
        autoCancel: false,
        // Without this every update re-alerts — the bug that made a
        // notification appear once a second.
        onlyAlertOnce: true,
        // Android renders the count from this instant onward.
        showChronometer: state.running,
        chronometerDirection: 'up',
        timestamp: Date.now() - elapsedMs,
        showTimestamp: state.running,
        actions,
        pressAction: { id: 'default', launchActivity: 'default' },
      },
    });
  } catch {
    // The timer must keep working even if the shade will not cooperate.
  }
}

export async function clearTimerNotification(onlyForKey?: string): Promise<void> {
  if (!SUPPORTED) return;
  try {
    if (onlyForKey) {
      const active = await getActiveTimer();
      // A screen for a different day must not cancel someone else's timer.
      if (active && active.storageKey !== onlyForKey) return;
    }
    await setActiveTimer(null);
    await notifee.cancelNotification(NOTIFICATION_ID);
  } catch {
    /* already gone */
  }
}

/* ------------------------------------------------------------------ */
/*  Actions — handled in place, without opening the app                */
/* ------------------------------------------------------------------ */

async function logFromNotification(meta: ActiveTimer, state: TimerState): Promise<void> {
  const seconds = elapsedOf(pauseOf(state));
  if (seconds < 1) return;

  // A headless task may run before supabase-js has read the stored session.
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

async function applyAction(actionId: string): Promise<void> {
  const meta = await getActiveTimer();
  if (!meta) return;

  if (actionId === TIMER_ACTIONS.log) {
    try {
      await logFromNotification(meta, await readTimer(meta.storageKey));
    } catch {
      // Offline or signed out: pause instead so the time is never lost.
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
 * Shared by the foreground and the headless background handler.
 *
 * Presses are serialised, so hammering Pause cannot interleave two
 * read-modify-writes against the same stored timer.
 */
export async function handleTimerEvent({ type, detail }: Event): Promise<void> {
  if (type !== EventType.ACTION_PRESS) return;
  const id = detail.pressAction?.id;
  if (!isTimerAction(id)) return;

  await serialise(async () => {
    try {
      await applyAction(id);
    } catch {
      // An action that fails must never surface as a crash.
    }
  });
}

/** Foreground registration. The background half lives in index.js. */
export function registerTimerNotificationHandlers(): () => void {
  if (!SUPPORTED) return () => {};
  return notifee.onForegroundEvent((event) => {
    void handleTimerEvent(event);
  });
}

export async function readActiveTimerState(): Promise<
  { meta: ActiveTimer; state: TimerState } | null
> {
  const meta = await getActiveTimer();
  if (!meta) return null;
  return { meta, state: await readTimer(meta.storageKey) };
}
