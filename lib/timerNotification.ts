import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  elapsedOf, getActiveTimer, mutateTimer, pauseOf, readTimer, setActiveTimer, startOf,
  type ActiveTimer, type TimerState,
} from './timerState';
import { formatDuration } from './format';
import { TIMER_CHANNEL } from './notifications';

const NOTIFICATION_ID = 'focus-timer';

// expo-notifications has no web implementation — several of its methods throw
// outright there. The timer still works; it just has no shade to live in.
const SUPPORTED = Platform.OS !== 'web';

/**
 * Button titles are baked into a category, so running and paused need one
 * each rather than a single category with changing labels.
 */
const CATEGORY_RUNNING = 'focus-timer-running';
const CATEGORY_PAUSED = 'focus-timer-paused';

export const TIMER_ACTIONS = {
  pause: 'timer-pause',
  resume: 'timer-resume',
  stop: 'timer-stop',
} as const;

type Listener = (key: string, state: TimerState) => void;
const listeners = new Set<Listener>();

/** Lets a mounted screen adopt a change made from the notification. */
export function onTimerChangedExternally(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let categoriesReady = false;

async function ensureCategories(): Promise<void> {
  if (!SUPPORTED || categoriesReady) return;
  // opensAppToForeground: the app must be alive to apply the change correctly,
  // and the timer is timestamp-based, so a late pause would over-count.
  await Notifications.setNotificationCategoryAsync(CATEGORY_RUNNING, [
    { identifier: TIMER_ACTIONS.pause, buttonTitle: 'Pause', options: { opensAppToForeground: true } },
    { identifier: TIMER_ACTIONS.stop, buttonTitle: 'Stop', options: { opensAppToForeground: true } },
  ]);
  await Notifications.setNotificationCategoryAsync(CATEGORY_PAUSED, [
    { identifier: TIMER_ACTIONS.resume, buttonTitle: 'Resume', options: { opensAppToForeground: true } },
    { identifier: TIMER_ACTIONS.stop, buttonTitle: 'Stop', options: { opensAppToForeground: true } },
  ]);
  categoriesReady = true;
}

function startedAtLabel(state: TimerState): string {
  const since = state.startedAt ?? Date.now();
  return new Date(since).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Shows (or replaces) the ongoing timer notification.
 *
 * While running it shows the time the run STARTED rather than a count of
 * elapsed seconds. Android only redraws a notification when we replace it,
 * so an elapsed figure would silently go stale; a start time stays true no
 * matter how long the shade sits untouched.
 */
export async function showTimerNotification(
  meta: ActiveTimer,
  state: TimerState
): Promise<void> {
  if (!SUPPORTED) return;
  await ensureCategories();
  await setActiveTimer(meta);

  const where = `${meta.challengeTitle} · Day ${meta.dayNumber}`;
  const elapsed = elapsedOf(state);

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title: state.running ? 'Recording focused time' : 'Timer paused',
        body: state.running
          ? `Running since ${startedAtLabel(state)} · ${where}`
          : `${formatDuration(elapsed)} banked · ${where}`,
        categoryIdentifier: state.running ? CATEGORY_RUNNING : CATEGORY_PAUSED,
        data: { challengeId: meta.challengeId, dayNumber: meta.dayNumber, timer: true },
        sticky: state.running, // ongoing: cannot be swiped away mid-run
        autoDismiss: false,
        sound: false,
        ...(Platform.OS === 'android' ? { channelId: TIMER_CHANNEL } : {}),
      },
      trigger: null,
    });
  } catch {
    // The timer itself must keep working even if the shade will not cooperate.
  }
}

export async function clearTimerNotification(): Promise<void> {
  if (!SUPPORTED) return;
  await setActiveTimer(null);
  try {
    await Notifications.dismissNotificationAsync(NOTIFICATION_ID);
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
  } catch {
    /* already gone */
  }
}

/** Applies a pressed action to the stored timer. */
async function applyAction(actionId: string): Promise<void> {
  const meta = await getActiveTimer();
  if (!meta) return;

  if (actionId === TIMER_ACTIONS.stop) {
    const next = await mutateTimer(meta.storageKey, pauseOf);
    listeners.forEach((fn) => fn(meta.storageKey, next));
    await clearTimerNotification();
    return;
  }

  const next = await mutateTimer(
    meta.storageKey,
    actionId === TIMER_ACTIONS.pause ? pauseOf : startOf
  );
  listeners.forEach((fn) => fn(meta.storageKey, next));
  await showTimerNotification(meta, next);
}

function isTimerAction(id: string | undefined): id is string {
  return !!id && (Object.values(TIMER_ACTIONS) as string[]).includes(id);
}

/** Registered once from the app root. */
export function registerTimerNotificationHandlers(): () => void {
  if (!SUPPORTED) return () => {};

  // A press from a cold start arrives here rather than through the listener.
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    const id = response?.actionIdentifier;
    if (isTimerAction(id)) void applyAction(id);
  });

  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const id = response.actionIdentifier;
    if (isTimerAction(id)) void applyAction(id);
  });

  return () => sub.remove();
}

/** Re-reads storage for whichever timer the notification is showing. */
export async function readActiveTimerState(): Promise<
  { meta: ActiveTimer; state: TimerState } | null
> {
  const meta = await getActiveTimer();
  if (!meta) return null;
  return { meta, state: await readTimer(meta.storageKey) };
}
