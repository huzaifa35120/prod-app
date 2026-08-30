import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
// Direct import: the package root pulls in every icon font family.
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, gradients, radius, spacing } from '../lib/theme';
import type { Task } from '../lib/types';

/**
 * One checkbox for a day. The tick springs in so the interaction feels
 * physical; the pip on the right mirrors the opponent's copy of the task.
 */
export function TaskRow({
  task,
  done,
  rivalDone,
  busy,
  locked,
  canDelete,
  onToggle,
  onDelete,
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
      toValue: done ? 1 : 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10,
    }).start();
  }, [done, tick]);

  const scale = tick.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <View style={[styles.row, done && styles.rowDone, locked && { opacity: 0.5 }]}>
      <Pressable
        onPress={onToggle}
        disabled={locked || busy}
        style={styles.hit}
        hitSlop={{ top: 6, bottom: 6 }}
      >
        <View style={[styles.box, done && styles.boxOn]}>
          {busy ? (
            <ActivityIndicator size="small" color={done ? colors.greenInk : colors.green} />
          ) : done ? (
            <Animated.View style={{ transform: [{ scale }] }}>
              <Ionicons name="checkmark-sharp" size={17} color={colors.greenInk} />
            </Animated.View>
          ) : null}
        </View>

        <Text style={[styles.title, done && styles.titleDone]} numberOfLines={2}>
          {task.title}
        </Text>
      </Pressable>

      {rivalDone ? (
        <LinearGradient
          colors={gradients.rival}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.pip}
        />
      ) : null}

      {canDelete ? (
        <Pressable onPress={onDelete} hitSlop={10} style={styles.trash}>
          <Ionicons name="close" size={16} color={colors.textFaint} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 15,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  rowDone: { borderColor: colors.greenEdge, backgroundColor: colors.greenDim },
  hit: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  box: {
    width: 26,
    height: 26,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.borderGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.green, borderColor: colors.green },
  title: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: colors.text,
    flex: 1,
    lineHeight: 20,
  },
  titleDone: { color: colors.green, textDecorationLine: 'line-through' },
  pip: { width: 9, height: 9, borderRadius: 5 },
  trash: { padding: 2 },
});
