import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TimerState {
  running: boolean;
  /** Epoch ms when the current run began, or null while paused. */
  startedAt: number | null;
  /** Seconds banked from previous runs. */
  accumulated: number;
}

const IDLE: TimerState = { running: false, startedAt: null, accumulated: 0 };

/**
 * A stopwatch that survives backgrounding and app restarts.
 *
 * Elapsed time is derived from wall-clock timestamps rather than counted
 * ticks, so time that passes while the app is suspended still counts and
 * a dropped interval can never lose seconds.
 */
export function useStopwatch(storageKey: string) {
  const [state, setState] = useState<TimerState>(IDLE);
  const [hydrated, setHydrated] = useState(false);
  const [, setTick] = useState(0);
  const keyRef = useRef(storageKey);

  // Load any timer that was left running for this day.
  useEffect(() => {
    let alive = true;
    keyRef.current = storageKey;
    setHydrated(false);
    setState(IDLE);

    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!alive) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as TimerState;
            if (typeof parsed.accumulated === 'number') setState(parsed);
          } catch {
            // Corrupt entry: fall back to a fresh timer.
          }
        }
        setHydrated(true);
      })
      .catch(() => setHydrated(true));

    return () => {
      alive = false;
    };
  }, [storageKey]);

  // Persist after every change, but never before hydration (that would
  // clobber a saved timer with the empty initial state).
  useEffect(() => {
    if (!hydrated) return;
    void AsyncStorage.setItem(storageKey, JSON.stringify(state)).catch(() => {});
  }, [storageKey, state, hydrated]);

  // Re-render once a second while running so the clock advances.
  useEffect(() => {
    if (!state.running) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [state.running]);

  const elapsed = Math.floor(
    state.accumulated + (state.running && state.startedAt ? (Date.now() - state.startedAt) / 1000 : 0)
  );

  const start = useCallback(() => {
    setState((s) => (s.running ? s : { ...s, running: true, startedAt: Date.now() }));
  }, []);

  const pause = useCallback(() => {
    setState((s) => {
      if (!s.running || !s.startedAt) return s;
      return {
        running: false,
        startedAt: null,
        accumulated: s.accumulated + (Date.now() - s.startedAt) / 1000,
      };
    });
  }, []);

  const reset = useCallback(() => setState(IDLE), []);

  const addSeconds = useCallback((seconds: number) => {
    setState((s) => ({ ...s, accumulated: s.accumulated + seconds }));
  }, []);

  return { elapsed, running: state.running, hydrated, start, pause, reset, addSeconds };
}
