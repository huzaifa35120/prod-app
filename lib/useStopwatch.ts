import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  addOf, elapsedOf, IDLE, mutateTimer, pauseOf, readTimer, startOf, writeTimer,
  type ActiveTimer, type TimerState,
} from './timerState';
import {
  clearTimerNotification, onTimerChangedExternally, showTimerNotification,
} from './timerNotification';

type Meta = Omit<ActiveTimer, 'storageKey'>;

/**
 * A stopwatch that survives backgrounding and app restarts, mirrored into an
 * ongoing notification with Pause / Resume / Log it / Discard.
 *
 * Storage is the single source of truth. Every change goes through a
 * serialised read-modify-write, and reads never write back — an earlier
 * version persisted on every state change, so a value read during the
 * foreground transition could overwrite a change the notification had just
 * made. That is what made repeated Pause presses appear to do nothing.
 */
export function useStopwatch(storageKey: string, meta?: Meta) {
  const [state, setState] = useState<TimerState>(IDLE);
  const [hydrated, setHydrated] = useState(false);
  const [, setTick] = useState(0);

  const metaRef = useRef<Meta | undefined>(meta);
  metaRef.current = meta;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const activeMeta = useCallback((): ActiveTimer | null => {
    const m = metaRef.current;
    return m ? { ...m, storageKey } : null;
  }, [storageKey]);

  /** Reflects a state into the shade: shown while it has time, cleared when idle. */
  const mirror = useCallback(
    (next: TimerState) => {
      const m = activeMeta();
      if (!m) return;

      if (next.running || elapsedOf(next) > 0) void showTimerNotification(m, next);
      // Scoped to this key: opening an idle day must not cancel a timer that
      // is still running on a different one.
      else void clearTimerNotification(storageKey);
    },
    [activeMeta]
  );

  // Load whatever was left for this day.
  useEffect(() => {
    let alive = true;
    setHydrated(false);
    setState(IDLE);

    void readTimer(storageKey).then((s) => {
      if (!alive) return;
      setState(s);
      setHydrated(true);
      // Only a RUNNING timer re-claims the shade. Merely opening a day that
      // has banked-but-unlogged time should not raise a notification.
      if (s.running) mirror(s);
    });

    return () => {
      alive = false;
    };
  }, [storageKey, mirror]);

  /** The only path that writes. Storage first, then local state. */
  const apply = useCallback(
    (fn: (s: TimerState) => TimerState) => {
      void mutateTimer(storageKey, fn).then((next) => {
        if (mounted.current) setState(next);
        mirror(next);
      });
    },
    [storageKey, mirror]
  );

  // The notification's buttons mutate storage directly; adopt their result
  // without writing it back.
  useEffect(
    () =>
      onTimerChangedExternally((key, next) => {
        if (key === storageKey && mounted.current) setState(next);
      }),
    [storageKey]
  );

  // Returning to the foreground, storage may be newer than our state.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      void readTimer(storageKey).then((next) => {
        if (mounted.current) setState(next);
      });
    });
    return () => sub.remove();
  }, [storageKey]);

  // Re-render once a second while running so the on-screen clock advances.
  useEffect(() => {
    if (!state.running) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [state.running]);

  const elapsed = elapsedOf(state);

  const start = useCallback(() => apply(startOf), [apply]);
  const pause = useCallback(() => apply(pauseOf), [apply]);
  const addSeconds = useCallback((s: number) => apply((prev) => addOf(prev, s)), [apply]);

  /** Clears the timer outright — used after banking the time. */
  const reset = useCallback(() => {
    void writeTimer(storageKey, IDLE).then(() => {
      if (mounted.current) setState(IDLE);
      void clearTimerNotification(storageKey);
    });
  }, [storageKey]);

  return { elapsed, running: state.running, hydrated, start, pause, reset, addSeconds };
}
