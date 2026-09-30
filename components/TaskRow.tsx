import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, radius, spacing } from '../lib/theme';
import type { Task } from '../lib/types';

/**
 * One checkbox for a day.
 *
 * A full-width row separated by a hairline rather than a floating card — a
 * checklist should read as a list, not as a stack of panels.
 */
export function TaskRow({
  task, done, rivalDone, busy, locked, canDelete, onToggle, onDelete,
}: {
  task: Task;
  done: boolean;
  rivalDone: boolean;
  busy: boolean;
  locked: boolean;
  canDelete: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const tick = useRef(new Animated.Value(done ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(tick, {
      toValue: done ? 1 : 0, useNativeDriver: true, speed: 26, bounciness: 6,
    }).start();
  }, [done, tick]);

  const scale = tick.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <View style={[styles.row, locked && { opacity: 0.45 }]}>
      <Pressable
        onPress={onToggle}
        disabled={locked || busy}
        style={styles.hit}
        hitSlop={{ top: 8, bottom: 8 }}
      >
        <View style={[styles.box, done && styles.boxOn]}>
          {busy ? (
            <ActivityIndicator size="small" color={done ? colors.accentInk : colors.accent} />
          ) : done ? (
            <Animated.View style={{ transform: [{ scale }] }}>
              <Ionicons name="checkmark-sharp" size={15} color={colors.accentInk} />
            </Animated.View>
          ) : null}
        </View>

        <Text style={[styles.title, done && styles.titleDone]} numberOfLines={2}>
          {task.title}
        </Text>
      </Pressable>

      {/* rival's copy of this task */}
      {rivalDone ? <View style={styles.rivalTick} /> : null}

      {canDelete ? (
        <Pressable onPress={onDelete} hitSlop={12} style={{ padding: 2 }}>
          <Ionicons name="remove" size={16} color={colors.textFaint} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  hit: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  box: {
    width: 22,
    height: 22,
    borderRadius: radius.xs,
    borderWidth: 1.5,
    borderColor: colors.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  title: {
    fontFamily: fonts.bodyMd,
    fontSize: 15,
    color: colors.text,
    flex: 1,
    lineHeight: 20,
  },
  titleDone: { color: colors.textFaint, textDecorationLine: 'line-through' },
  rivalTick: { width: 3, height: 16, backgroundColor: colors.rival },
});
