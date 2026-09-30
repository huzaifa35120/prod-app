import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  addOf, elapsedOf, IDLE, pauseOf, readTimer, startOf, writeTimer,
  type ActiveTimer, type TimerState,
} from './timerState';
import {
  clearTimerNotification, onTimerChangedExternally, showTimerNotification,
} from './timerNotification';

type Meta = Omit<ActiveTimer, 'storageKey'>;

/**
 * A stopwatch that survives backgrounding and app restarts, and mirrors
 * itself into an ongoing Android notification with Pause/Resume/Stop.
 *
 * The notification's buttons write to the same AsyncStorage entry this hook
 * reads, so the two can never disagree: whoever changed it last wins, and the
 * hook re-reads whenever it regains focus.
 */
export function useStopwatch(storageKey: string, meta?: Meta) {
  const [state, setState] = useState<TimerState>(IDLE);
  const [hydrated, setHydrated] = useState(false);
  const [, setTick] = useState(0);
  const metaRef = useRef<Meta | undefined>(meta);
  metaRef.current = meta;

  // Load whatever was left for this day.
  useEffect(() => {
    let alive = true;
    setHydrated(false);
    setState(IDLE);

    readTimer(storageKey).then((s) => {
      if (!alive) return;
      setState(s);
      setHydrated(true);
    });

    return () => {
      alive = false;
    };
  }, [storageKey]);

  // Persist after every change, but never before hydration — that would
  // clobber a saved timer with the empty initial state.
  useEffect(() => {
    if (!hydrated) return;
    void writeTimer(storageKey, state);
  }, [storageKey, state, hydrated]);

  // Keep the notification in step with the timer.
  useEffect(() => {
    if (!hydrated) return;
    const m = metaRef.current;
    if (!m) return;

    const elapsed = elapsedOf(state);
    if (state.running || elapsed > 0) {
      void showTimerNotification({ ...m, storageKey }, state);
    } else {
      void clearTimerNotification();
    }
  }, [state, hydrated, storageKey]);

  // The notification's buttons mutate storage directly; adopt their result.
  useEffect(() => {
    return onTimerChangedExternally((key, next) => {
      if (key === storageKey) setState(next);
    });
  }, [storageKey]);

  // Coming back to the foreground, storage may be newer than our state.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void readTimer(storageKey).then(setState);
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

  const start = useCallback(() => setState(startOf), []);
  const pause = useCallback(() => setState(pauseOf), []);
  const reset = useCallback(() => {
    setState(IDLE);
    void clearTimerNotification();
  }, []);
  const addSeconds = useCallback((seconds: number) => setState((s) => addOf(s, seconds)), []);

  return { elapsed, running: state.running, hydrated, start, pause, reset, addSeconds };
}
