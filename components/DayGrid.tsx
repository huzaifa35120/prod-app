import React from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../lib/theme';
import { todayKey } from '../lib/format';
import type { ChallengeDay, DayProgress } from '../lib/types';

export type DayState = 'complete' | 'partial' | 'missed' | 'today' | 'future';

export function dayStateFor(day: ChallengeDay, p: DayProgress | undefined): DayState {
  if (p?.is_complete) return 'complete';
  const today = todayKey();
  if (day.day_date > today) return 'future';
  if ((p?.completed_tasks ?? 0) > 0) return 'partial';
  return day.day_date === today ? 'today' : 'missed';
}

/** Longest run of completed days ending at the most recent elapsed day. */
export function currentStreak(days: ChallengeDay[], progress: Map<number, DayProgress>): number {
  const today = todayKey();
  const elapsed = days.filter((d) => d.day_date <= today).sort((a, b) => b.day_number - a.day_number);
  let streak = 0;
  for (const d of elapsed) {
    if (progress.get(d.day_number)?.is_complete) streak += 1;
    else if (d.day_date === today) continue;
    else break;
  }
  return streak;
}

/**
 * The challenge calendar, as a dense block of squares.
 *
 * A solid lime square is a day you completed; the rival's matching day is a
 * bar along the bottom edge. Deliberately tight and unlabelled — it should
 * read as a pattern of form over time, not as a list of cards.
 */
export function DayGrid({
  days, progress, opponentProgress, onPressDay, horizontalPadding = (spacing.lg + 2) * 2,
}: {
  days: ChallengeDay[];
  progress: Map<number, DayProgress>;
  opponentProgress?: Map<number, DayProgress>;
  onPressDay: (day: ChallengeDay) => void;
  horizontalPadding?: number;
}) {
  const today = todayKey();
  const { width } = useWindowDimensions();

  const perRow = width >= 430 ? 8 : 7;
  const gap = 5;
  const cell = Math.floor((width - horizontalPadding - gap * (perRow - 1)) / perRow);

  return (
    <View style={[styles.grid, { gap }]}>
      {days.map((day) => {
        const mine = progress.get(day.day_number);
        const theirs = opponentProgress?.get(day.day_number);
        const state = dayStateFor(day, mine);
        const isToday = day.day_date === today;
        const frac = mine && mine.total_tasks > 0 ? mine.completed_tasks / mine.total_tasks : 0;

        return (
          <Pressable
            key={day.id}
            onPress={() => onPressDay(day)}
            style={({ pressed }) => [
              styles.cell,
              { width: cell, height: cell },
              state === 'complete' && { backgroundColor: colors.done, borderColor: colors.done },
              state === 'partial' && { borderColor: colors.partial },
              state === 'missed' && { borderColor: colors.line },
              state === 'future' && { borderColor: colors.line, opacity: 0.4 },
              isToday && state !== 'complete' && { borderColor: colors.accent, borderWidth: 1.5 },
              pressed && { opacity: 0.55 },
            ]}
          >
            <Text
              style={[
                styles.num,
                { fontSize: Math.max(10, Math.min(13, cell * 0.34)) },
                state === 'complete' && { color: colors.accentInk },
                state === 'partial' && { color: colors.text },
                state === 'missed' && { color: colors.textFaint },
                state === 'future' && { color: colors.textFaint },
                isToday && state !== 'complete' && { color: colors.accent },
              ]}
            >
              {day.day_number}
            </Text>

            {/* partial fill creeps up from the bottom */}
            {state === 'partial' && frac > 0 ? (
              <View style={[styles.partialFill, { height: `${frac * 100}%` }]} />
            ) : null}

            {/* rival's completion: a bar across the bottom edge */}
            {theirs?.is_complete ? <View style={styles.rivalBar} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function GridLegend({ rivalName }: { rivalName?: string }) {
  return (
    <View style={styles.legend}>
      <Item label="Done" swatch={{ backgroundColor: colors.done, borderColor: colors.done }} />
      <Item label="Part" swatch={{ borderColor: colors.partial }} />
      <Item label="Missed" swatch={{ borderColor: colors.line }} />
      {rivalName ? (
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { borderColor: colors.line }]}>
            <View style={styles.rivalBar} />
          </View>
          <Text style={styles.legendText}>{rivalName}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Item({ label, swatch }: { label: string; swatch: object }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, swatch]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    borderRadius: radius.xs,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  num: {
    fontFamily: fonts.displayBold,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
    zIndex: 2,
  },
  partialFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surfaceMax,
    zIndex: 1,
  },
  rivalBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: colors.rival,
    zIndex: 3,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 11, height: 11, borderRadius: radius.xs, borderWidth: 1, overflow: 'hidden' },
  legendText: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.textFaint,
    letterSpacing: 0.3,
  },
});
