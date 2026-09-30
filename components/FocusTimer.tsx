import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
// Direct import: the package root pulls in every icon font family.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Row, ProgressBar } from './ui';
import { useStopwatch } from '../lib/useStopwatch';
import { formatClock, formatDuration } from '../lib/format';
import { colors, fonts, radius, spacing, type } from '../lib/theme';

const QUICK_ADDS = [
  { label: '+15m', seconds: 900 },
  { label: '+30m', seconds: 1800 },
  { label: '+1h', seconds: 3600 },
];


/**
 * The day's stopwatch, drawn as a ring that races the opponent.
 *
 * The ring fills toward whatever your rival has logged for this day, so the
 * moment you overtake them it completes and turns green. Time only reaches the
 * database when the player taps "Log it".
 */
export function FocusTimer({
  storageKey,
  disabled,
  myLoggedToday,
  theirLoggedToday,
  rivalName,
  challengeId,
  challengeTitle,
  dayNumber,
  onLog,
}: {
  storageKey: string;
  disabled?: boolean;
  myLoggedToday: number;
  theirLoggedToday: number;
  rivalName?: string;
  /** Context for the ongoing notification's title and deep link. */
  challengeId: string;
  challengeTitle: string;
  dayNumber: number;
  onLog: (seconds: number) => Promise<void>;
}) {
  const { elapsed, running, hydrated, start, pause, reset, addSeconds } = useStopwatch(
    storageKey,
    { challengeId, challengeTitle, dayNumber }
  );
  const [saving, setSaving] = useState(false);


  const liveTotal = myLoggedToday + elapsed;
  const target = theirLoggedToday > 0 ? theirLoggedToday : Math.max(liveTotal, 3600);
  const ratio = target > 0 ? Math.min(liveTotal / target, 1) : 0;
  const ahead = theirLoggedToday > 0 && liveTotal > theirLoggedToday;


  // Slow breath while recording
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!running) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [running, pulse]);

  async function log() {
    if (elapsed < 1) return;
    setSaving(true);
    try {
      if (running) pause();
      await onLog(elapsed);
      reset();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function confirmReset() {
    if (elapsed < 1) return;
    Alert.alert('Discard timer', `Throw away ${formatDuration(elapsed)} without logging it?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: reset },
    ]);
  }

  const ringTint = ahead ? colors.done : colors.accent;

  return (
    <View style={[styles.wrap, disabled && { opacity: 0.45 }]}>
      <View style={styles.face}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Text style={[type.clock, running && { color: colors.accent }]}>
            {hydrated ? formatClock(elapsed) : '00:00:00'}
          </Text>
          <View style={styles.status}>
            <View
              style={[
                styles.dot,
                { backgroundColor: running ? colors.accent : colors.textFaint },
              ]}
            />
            <Text style={styles.statusText}>
              {running ? 'REC' : elapsed > 0 ? 'HELD' : 'READY'}
            </Text>
          </View>
        </Row>

        <View style={{ marginTop: spacing.lg }}>
          <ProgressBar
            value={ratio}
            tint={ahead ? colors.accent : colors.rival}
            track={colors.line}
            height={3}
          />
        </View>

        <Text style={styles.versus} numberOfLines={2}>
          {rivalName
            ? ahead
              ? `Ahead of ${rivalName} today`
              : theirLoggedToday > 0
                ? `${formatDuration(theirLoggedToday - liveTotal)} behind ${rivalName}`
                : `${rivalName} hasn't logged today`
            : `${formatDuration(myLoggedToday)} logged today`}
        </Text>
      </View>

      <Row style={{ gap: spacing.md, marginTop: spacing.xl }}>
        <Button
          title={running ? 'Pause' : elapsed > 0 ? 'Resume' : 'Start'}
          variant={running ? 'secondary' : 'primary'}
          style={{ flex: 1 }}
          disabled={disabled}
          icon={
            <Ionicons
              name={running ? 'pause' : 'play'}
              size={16}
              color={running ? colors.text : colors.accentInk}
            />
          }
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            running ? pause() : start();
          }}
        />
        <Button
          title="Log it"
          variant="secondary"
          style={{ flex: 1 }}
          disabled={disabled || elapsed < 1}
          loading={saving}
          onPress={log}
        />
      </Row>

      <Row style={{ gap: spacing.sm, marginTop: spacing.md }}>
        {QUICK_ADDS.map((q) => (
          <Pressable
            key={q.label}
            disabled={disabled}
            onPress={() => {
              void Haptics.selectionAsync();
              addSeconds(q.seconds);
            }}
            style={({ pressed }) => [styles.quick, pressed && { backgroundColor: colors.surfaceMax }]}
          >
            <Text style={styles.quickText}>{q.label}</Text>
          </Pressable>
        ))}
        <Pressable
          disabled={disabled || elapsed < 1}
          onPress={confirmReset}
          style={({ pressed }) => [
            styles.quick,
            { flex: 0, paddingHorizontal: spacing.lg },
            pressed && { backgroundColor: colors.surfaceMax },
          ]}
        >
          <Ionicons name="refresh" size={15} color={colors.textFaint} />
        </Pressable>
      </Row>

      <Text style={styles.hint}>Nothing counts until you log it.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'stretch' },
  face: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.xl,
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 10 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.textDim,
  },
  versus: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textFaint,
    marginTop: spacing.md,
  },
  quick: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: colors.textDim,
    letterSpacing: 0.5,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.textFaint,
    marginTop: spacing.lg,
  },
});
