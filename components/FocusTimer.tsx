import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
// Direct import: the package root pulls in every icon font family.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Caption, Row } from './ui';
import { useStopwatch } from '../lib/useStopwatch';
import { formatClock, formatDuration } from '../lib/format';
import { colors, radius, spacing, type } from '../lib/theme';

const QUICK_ADDS = [
  { label: '+15m', seconds: 900 },
  { label: '+30m', seconds: 1800 },
  { label: '+1h', seconds: 3600 },
];

const STROKE = 12;
const MAX_SIZE = 250;
const MIN_SIZE = 180;

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
  onLog,
}: {
  storageKey: string;
  disabled?: boolean;
  myLoggedToday: number;
  theirLoggedToday: number;
  rivalName?: string;
  onLog: (seconds: number) => Promise<void>;
}) {
  const { elapsed, running, hydrated, start, pause, reset, addSeconds } = useStopwatch(storageKey);
  const [saving, setSaving] = useState(false);

  // Scale the ring to the screen so it never crowds a small phone.
  const { width } = useWindowDimensions();
  const SIZE = Math.round(Math.max(MIN_SIZE, Math.min(MAX_SIZE, width - 120)));
  const R = (SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * R;

  const liveTotal = myLoggedToday + elapsed;
  const target = theirLoggedToday > 0 ? theirLoggedToday : Math.max(liveTotal, 3600);
  const ratio = target > 0 ? Math.min(liveTotal / target, 1) : 0;
  const ahead = theirLoggedToday > 0 && liveTotal > theirLoggedToday;

  // Ring sweep. Held in state rather than an animated SVG node: attaching
  // Animated to a react-native-svg element leaks DOM props on web, and this
  // only runs for 600ms at a time.
  const sweep = useRef(new Animated.Value(0)).current;
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    const sub = sweep.addListener(({ value }) => setDrawn(value));
    Animated.timing(sweep, {
      toValue: ratio,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => sweep.removeListener(sub);
  }, [ratio, sweep]);

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

  const ringTint = ahead ? colors.green : colors.primary;

  return (
    <View style={[styles.wrap, disabled && { opacity: 0.45 }]}>
      <View style={[styles.ringWrap, { width: SIZE, height: SIZE }]}>
        <Svg width={SIZE} height={SIZE}>
          <Defs>
            <SvgGradient id="ring" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={ahead ? '#34D399' : '#6D8BFF'} />
              <Stop offset="1" stopColor={ahead ? '#0EA47A' : '#8B5CF6'} />
            </SvgGradient>
          </Defs>

          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={colors.surfaceMax}
            strokeWidth={STROKE}
            fill="none"
          />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke="url(#ring)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - drawn)}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>

        <View style={styles.ringInner} pointerEvents="none">
          <Animated.View
            style={[
              styles.statusPill,
              running && {
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: running ? colors.green : colors.textFaint },
              ]}
            />
            <Text style={styles.statusText}>
              {running ? 'RECORDING' : elapsed > 0 ? 'PAUSED' : 'READY'}
            </Text>
          </Animated.View>

          <Text style={[type.clock, { fontSize: Math.round(SIZE * 0.215) }]}>
            {hydrated ? formatClock(elapsed) : '00:00:00'}
          </Text>

          {rivalName ? (
            <Text style={styles.versus} numberOfLines={2}>
              {ahead ? (
                <Text style={{ color: colors.green }}>ahead of {rivalName}</Text>
              ) : theirLoggedToday > 0 ? (
                `${formatDuration(theirLoggedToday - liveTotal)} behind ${rivalName}`
              ) : (
                `${rivalName} hasn't logged today`
              )}
            </Text>
          ) : (
            <Text style={styles.versus}>{formatDuration(myLoggedToday)} logged today</Text>
          )}
        </View>
      </View>

      <Row style={{ gap: spacing.md, marginTop: spacing.xl }}>
        <Button
          title={running ? 'Pause' : elapsed > 0 ? 'Resume' : 'Start'}
          variant={running ? 'secondary' : 'success'}
          style={{ flex: 1 }}
          disabled={disabled}
          icon={
            <Ionicons
              name={running ? 'pause' : 'play'}
              size={16}
              color={running ? colors.text : colors.greenInk}
            />
          }
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            running ? pause() : start();
          }}
        />
        <Button
          title="Log it"
          style={{ flex: 1 }}
          disabled={disabled || elapsed < 1}
          loading={saving}
          icon={<Ionicons name="checkmark" size={16} color={colors.primaryInk} />}
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

      <Caption style={{ marginTop: spacing.lg, textAlign: 'center' }}>
        Nothing counts until you tap Log it.
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'stretch' },
  ringWrap: { alignSelf: 'center', justifyContent: 'center' },
  ringInner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.textDim,
  },
  versus: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: colors.textFaint,
    marginTop: spacing.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  quick: {
    flex: 1,
    backgroundColor: colors.surfaceHi,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.textDim },
});
