import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import {
  Button, EmptyState, Loading, Row, Screen, SectionTitle,
} from '../../components/ui';
import { TaskRow } from '../../components/TaskRow';
import { useAuth } from '../../lib/auth';
import { finalizeDueChallenges, getToday, setTaskDone, type TodayEntry } from '../../lib/api';
import { errorMessage } from '../../lib/supabase';
import { formatDuration, parseDateKey, todayKey } from '../../lib/format';
import { colors, fonts, GUTTER, radius, spacing, type } from '../../lib/theme';
import { displayNameOf, type Task } from '../../lib/types';

/**
 * Home.
 *
 * Ticking today's boxes is the thing you do every day, so it lives one tap
 * from launch rather than three screens deep. Everything here is actionable;
 * browsing and history sit on the other tabs.
 */
export default function Today() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<TodayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyTask, setBusyTask] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      await finalizeDueChallenges();
      setEntries(await getToday(user.id));
    } catch (e) {
      Alert.alert('Could not load today', errorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function toggle(entry: TodayEntry, task: Task) {
    if (!user) return;
    const on = !entry.myDone.has(task.id);
    setBusyTask(task.id);

    // Optimistic — the box flips now, the server reconciles after.
    setEntries((prev) =>
      prev.map((e) => {
        if (e.challenge.id !== entry.challenge.id) return e;
        const next = new Set(e.myDone);
        if (on) next.add(task.id);
        else next.delete(task.id);
        return { ...e, myDone: next };
      })
    );

    try {
      void Haptics.impactAsync(
        on ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
      );
      await setTaskDone(task.id, user.id, entry.challenge.id, on);
      await load();
    } catch (e) {
      Alert.alert('Could not update', errorMessage(e));
      await load();
    } finally {
      setBusyTask(null);
    }
  }

  const heading = useMemo(() => {
    const d = parseDateKey(todayKey());
    return {
      weekday: d.toLocaleDateString(undefined, { weekday: 'long' }),
      date: d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' }),
    };
  }, []);

  const summary = useMemo(() => {
    const total = entries.reduce((n, e) => n + e.tasks.length, 0);
    const done = entries.reduce((n, e) => n + e.myDone.size, 0);
    const seconds = entries.reduce((n, e) => n + e.mySeconds, 0);
    return { total, done, seconds };
  }, [entries]);

  if (loading) return <Loading label="Loading today…" />;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: GUTTER, paddingBottom: spacing.xxxl * 2 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.textDim}
          />
        }
      >
        {/* ---- masthead ---- */}
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.weekday}>{heading.weekday}</Text>
            <Text style={type.hero}>{heading.date}</Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/profile')} hitSlop={8}>
            <Text style={styles.handle}>{profile ? `@${profile.username}` : ''}</Text>
          </Pressable>
        </Row>

        {entries.length > 0 ? (
          <Row style={styles.summary}>
            <View style={{ flex: 1 }}>
              <Text style={type.statMd}>
                {summary.done}
                <Text style={{ color: colors.textFaint }}>/{summary.total}</Text>
              </Text>
              <Text style={type.eyebrow}>Tasks today</Text>
            </View>
            <View style={styles.divider} />
            <View style={{ flex: 1 }}>
              <Text style={[type.statMd, { color: colors.accent }]}>
                {formatDuration(summary.seconds)}
              </Text>
              <Text style={type.eyebrow}>Focused today</Text>
            </View>
          </Row>
        ) : null}

        {entries.length === 0 ? (
          <EmptyState
            title="Nothing running"
            subtitle="Start a challenge with a friend, or join one that is looking for a second player. Today's checklist shows up here once it is live."
            action={
              <Row style={{ gap: spacing.md }}>
                <Button title="New challenge" style={{ flex: 1 }} onPress={() => router.push('/challenge/new')} />
                <Button title="Browse" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/(tabs)/challenges')} />
              </Row>
            }
          />
        ) : null}

        {entries.map((entry) => {
          const rival = entry.challenge.creator_id === user?.id
            ? entry.challenge.opponent
            : entry.challenge.creator;
          const ahead = entry.mySeconds >= entry.rivalSeconds;
          const allDone = entry.tasks.length > 0 && entry.myDone.size === entry.tasks.length;

          return (
            <View key={entry.challenge.id}>
              <SectionTitle
                right={
                  <Pressable
                    onPress={() => router.push(`/challenge/${entry.challenge.id}`)}
                    hitSlop={8}
                  >
                    <Ionicons name="arrow-forward" size={14} color={colors.textFaint} />
                  </Pressable>
                }
              >
                Day {entry.day.day_number} of {entry.challenge.day_count}
              </SectionTitle>

              <Pressable onPress={() => router.push(`/challenge/${entry.challenge.id}`)}>
                <Text style={[type.h2, { marginBottom: spacing.md }]} numberOfLines={1}>
                  {entry.challenge.title}
                </Text>
              </Pressable>

              {/* today's head-to-head */}
              <Row style={styles.headToHead}>
                <Text style={[styles.hhValue, { color: colors.accent }]}>
                  {formatDuration(entry.mySeconds)}
                </Text>
                <Text style={styles.hhLabel}>
                  {entry.mySeconds === 0 && entry.rivalSeconds === 0
                    ? 'nothing logged yet'
                    : ahead
                      ? 'ahead today'
                      : 'behind today'}
                </Text>
                <Text style={[styles.hhValue, { color: colors.rival, textAlign: 'right' }]}>
                  {formatDuration(entry.rivalSeconds)}
                </Text>
              </Row>

              {entry.tasks.length === 0 ? (
                <Text style={styles.noTasks}>
                  {entry.challenge.creator_id === user?.id
                    ? 'No tasks set for today yet.'
                    : `${displayNameOf(entry.challenge.creator)} hasn't set today's tasks.`}
                </Text>
              ) : (
                entry.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    done={entry.myDone.has(task.id)}
                    rivalDone={entry.rivalDone.has(task.id)}
                    busy={busyTask === task.id}
                    locked={false}
                    canDelete={false}
                    onToggle={() => toggle(entry, task)}
                    onDelete={() => {}}
                  />
                ))
              )}

              <Row style={{ gap: spacing.md, marginTop: spacing.lg }}>
                <Button
                  title={entry.mySeconds > 0 ? 'Add focus time' : 'Start timer'}
                  variant={allDone ? 'primary' : 'secondary'}
                  small
                  style={{ flex: 1 }}
                  icon={
                    <Ionicons
                      name="play"
                      size={12}
                      color={allDone ? colors.accentInk : colors.text}
                    />
                  }
                  onPress={() =>
                    router.push(`/challenge/${entry.challenge.id}/day/${entry.day.day_number}`)
                  }
                />
                {allDone ? (
                  <View style={styles.doneFlag}>
                    <Ionicons name="checkmark-sharp" size={13} color={colors.accentInk} />
                    <Text style={styles.doneFlagText}>Day clear</Text>
                  </View>
                ) : null}
              </Row>

              <View style={{ height: spacing.xl }} />
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  weekday: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.accent,
    marginBottom: 5,
  },
  handle: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, paddingTop: 6 },
  summary: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  divider: { width: 1, height: 34, backgroundColor: colors.line, marginHorizontal: spacing.lg },

  headToHead: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.md,
  },
  hhValue: { fontFamily: fonts.display, fontSize: 17, letterSpacing: -0.4, fontVariant: ['tabular-nums'], flex: 1 },
  hhLabel: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.textFaint,
    letterSpacing: 0.4,
    textAlign: 'center',
    flex: 1,
  },
  noTasks: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textFaint,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  doneFlag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    height: 34,
  },
  doneFlagText: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.accentInk,
  },
});
