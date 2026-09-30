import React from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius, spacing } from '../lib/theme';
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
    else if (d.day_date === today) continue; // today still has time left
    else break;
  }
  return streak;
}

/**
 * The challenge calendar. Cell fill is the *viewed* player's state — green
 * once every task for that day is ticked — and the corner pip mirrors the
 * opponent so you can read both at a glance.
 */
export function DayGrid({
  days,
  progress,
  opponentProgress,
  onPressDay,
  horizontalPadding = spacing.lg * 2,
}: {
  days: ChallengeDay[];
  progress: Map<number, DayProgress>;
  opponentProgress?: Map<number, DayProgress>;
  onPressDay: (day: ChallengeDay) => void;
  /** Total horizontal padding of the container, so cells divide the row evenly. */
  horizontalPadding?: number;
}) {
  const today = todayKey();
  const { width } = useWindowDimensions();

  // Divide the row evenly rather than using a fixed cell size, so the grid
  // never leaves a ragged edge or overflows on a narrow phone.
  const perRow = width >= 430 ? 6 : 5;
  const cell = Math.floor((width - horizontalPadding - spacing.sm * (perRow - 1)) / perRow);
  const cellStyle = { width: cell, height: cell };

  return (
    <View style={styles.grid}>
      {days.map((day) => {
        const mine = progress.get(day.day_number);
        const theirs = opponentProgress?.get(day.day_number);
        const state = dayStateFor(day, mine);
        const isToday = day.day_date === today;
        const frac =
          mine && mine.total_tasks > 0 ? mine.completed_tasks / mine.total_tasks : 0;

        return (
          <Pressable
            key={day.id}
            onPress={() => onPressDay(day)}
            style={({ pressed }) => [pressed && { opacity: 0.65, transform: [{ scale: 0.94 }] }]}
          >
            {state === 'complete' ? (
              <LinearGradient
                colors={gradients.green}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.cell, cellStyle, styles.cellComplete, isToday && styles.cellTodayRing]}
              >
                <Text style={[styles.num, { color: colors.greenInk }]}>{day.day_number}</Text>
                <Text style={[styles.sub, { color: 'rgba(4,20,13,0.6)' }]}>
                  {mine?.completed_tasks}/{mine?.total_tasks}
                </Text>
              </LinearGradient>
            ) : (
              <View
                style={[
                  styles.cell,
                  cellStyle,
                  state === 'partial' && styles.cellPartial,
                  state === 'missed' && styles.cellMissed,
                  state === 'future' && styles.cellFuture,
                  isToday && styles.cellToday,
                ]}
              >
                <Text
                  style={[
                    styles.num,
                    state === 'partial' && { color: colors.amber },
                    state === 'future' && { color: colors.textFaint },
                    state === 'missed' && { color: colors.textDim },
                    isToday && { color: colors.primary },
                  ]}
                >
                  {day.day_number}
                </Text>
                <Text style={styles.sub}>
                  {mine && mine.total_tasks > 0 ? `${mine.completed_tasks}/${mine.total_tasks}` : '·'}
                </Text>

                {frac > 0 && frac < 1 ? (
                  <View style={styles.meterTrack}>
                    <View style={[styles.meterFill, { width: `${frac * 100}%` }]} />
                  </View>
                ) : null}
              </View>
            )}

            {theirs?.is_complete ? <View style={styles.rivalPip} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function GridLegend({ rivalName }: { rivalName?: string }) {
  return (
    <View style={styles.legend}>
      <LegendItem swatch={colors.green} label="Day complete" solid />
      <LegendItem swatch={colors.amber} label="Partly done" />
      <LegendItem swatch={colors.borderHi} label="Missed" />
      {rivalName ? <LegendItem swatch={colors.rival} label={`${rivalName} done`} pip /> : null}
    </View>
  );
}

function LegendItem({
  swatch,
  label,
  solid,
  pip,
}: {
  swatch: string;
  label: string;
  solid?: boolean;
  pip?: boolean;
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          pip ? styles.legendPip : styles.legendSwatch,
          {
            backgroundColor: solid || pip ? swatch : 'transparent',
            borderColor: swatch,
          },
        ]}
      />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cellComplete: { borderColor: 'transparent' },
  cellPartial: { borderColor: colors.amberEdge, backgroundColor: colors.amberDim },
  cellMissed: { backgroundColor: colors.surface, borderColor: colors.border },
  cellFuture: { backgroundColor: 'transparent', borderStyle: 'dashed', opacity: 0.5 },
  cellToday: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primaryDim },
  cellTodayRing: { borderWidth: 2, borderColor: colors.text },

  num: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 17, color: colors.text },
  sub: { fontFamily: 'Inter_500Medium', fontSize: 9.5, color: colors.textFaint, marginTop: 1 },

  meterTrack: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 6,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  meterFill: { height: '100%', borderRadius: 2, backgroundColor: colors.amber },

  rivalPip: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.rival,
    borderWidth: 1.5,
    borderColor: colors.bg,
  },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 11, height: 11, borderRadius: 4, borderWidth: 1.5 },
  legendPip: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textFaint },
});
