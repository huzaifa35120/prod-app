import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
// Direct import: the package root pulls in every icon font family.
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Avatar, Badge, Body, Button, Caption, Card, Hero, Loading, ProgressBar, Row, Screen, SectionTitle,
} from '../../../../components/ui';
import { TaskRow } from '../../../../components/TaskRow';
import { FocusTimer } from '../../../../components/FocusTimer';
import { useAuth } from '../../../../lib/auth';
import {
  addTask, deleteTask, getChallenge, listCompletions, listDays, listFocusSessions,
  listTasks, logFocusSession, setTaskDone, deleteFocusSession,
} from '../../../../lib/api';
import { supabase, errorMessage } from '../../../../lib/supabase';
import { formatDate, formatDuration, todayKey } from '../../../../lib/format';
import { colors, radius, spacing } from '../../../../lib/theme';
import {
  displayNameOf,
  type ChallengeDay, type ChallengeWithPeople, type FocusSession, type Task, type TaskCompletion,
} from '../../../../lib/types';

export default function DayScreen() {
  const { id, dayNumber } = useLocalSearchParams<{ id: string; dayNumber: string }>();
  const { user, profile } = useAuth();

  const [challenge, setChallenge] = useState<ChallengeWithPeople | null>(null);
  const [day, setDay] = useState<ChallengeDay | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState('');
  const [adding, setAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const dayNum = Number(dayNumber);

  const load = useCallback(async () => {
    if (!id || !Number.isFinite(dayNum)) return;
    try {
      const [c, days] = await Promise.all([getChallenge(id), listDays(id)]);
      setChallenge(c);
      const d = days.find((x) => x.day_number === dayNum) ?? null;
      setDay(d);
      if (!d) return;

      const t = await listTasks(d.id);
      setTasks(t);
      const [comps, focus] = await Promise.all([
        listCompletions(t.map((x) => x.id)),
        listFocusSessions(d.id),
      ]);
      setCompletions(comps);
      setSessions(focus);
    } catch (e) {
      Alert.alert('Could not load day', errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id, dayNum]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // Keep the opponent's ticks and logged time fresh while both are on the day.
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`day:${id}:${dayNum}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'task_completions', filter: `challenge_id=eq.${id}` },
        () => void load())
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'focus_sessions', filter: `challenge_id=eq.${id}` },
        () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, dayNum, load]);

  const amCreator = challenge?.creator_id === user?.id;
  const amParticipant = amCreator || challenge?.opponent_id === user?.id;
  const opponentId = amCreator ? challenge?.opponent_id : challenge?.creator_id;
  const opponentProfile = amCreator ? challenge?.opponent : challenge?.creator;

  const myDone = useMemo(
    () => new Set(completions.filter((c) => c.user_id === user?.id).map((c) => c.task_id)),
    [completions, user?.id]
  );
  const theirDone = useMemo(
    () => new Set(completions.filter((c) => c.user_id === opponentId).map((c) => c.task_id)),
    [completions, opponentId]
  );

  const mySeconds = useMemo(
    () => sessions.filter((s) => s.user_id === user?.id).reduce((sum, s) => sum + s.seconds, 0),
    [sessions, user?.id]
  );
  const theirSeconds = useMemo(
    () => sessions.filter((s) => s.user_id === opponentId).reduce((sum, s) => sum + s.seconds, 0),
    [sessions, opponentId]
  );
  const mySessions = useMemo(
    () => sessions.filter((s) => s.user_id === user?.id),
    [sessions, user?.id]
  );

  const isFuture = day ? day.day_date > todayKey() : false;
  const allDone = tasks.length > 0 && myDone.size === tasks.length;

  async function toggle(task: Task) {
    if (!user || !challenge || isFuture) return;
    const on = !myDone.has(task.id);
    setTogglingId(task.id);
    // Optimistic: the checkbox flips immediately, then reconciles with the server.
    setCompletions((prev) =>
      on
        ? [...prev, {
            id: `optimistic-${task.id}`, task_id: task.id, user_id: user.id,
            challenge_id: challenge.id, completed_at: new Date().toISOString(),
          }]
        : prev.filter((c) => !(c.task_id === task.id && c.user_id === user.id))
    );
    try {
      void Haptics.impactAsync(
        on ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
      );
      await setTaskDone(task.id, user.id, challenge.id, on);
      await load();
    } catch (e) {
      Alert.alert('Could not update task', errorMessage(e));
      await load();
    } finally {
      setTogglingId(null);
    }
  }

  async function add() {
    if (!challenge || !day || newTask.trim().length === 0) return;
    setAdding(true);
    try {
      await addTask(challenge.id, day.id, newTask, tasks.length);
      setNewTask('');
      await load();
    } catch (e) {
      Alert.alert('Could not add task', errorMessage(e));
    } finally {
      setAdding(false);
    }
  }

  function confirmDeleteTask(task: Task) {
    Alert.alert('Delete task', `Remove “${task.title}” from this day?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTask(task.id);
            await load();
          } catch (e) {
            Alert.alert('Could not delete', errorMessage(e));
          }
        },
      },
    ]);
  }

  async function onLogTime(seconds: number) {
    if (!challenge || !day || !user) return;
    await logFocusSession(challenge.id, day.id, user.id, seconds, null);
    await load();
  }

  function confirmDeleteSession(s: FocusSession) {
    Alert.alert('Remove entry', `Remove ${formatDuration(s.seconds)} from this day?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteFocusSession(s.id);
            await load();
          } catch (e) {
            Alert.alert('Could not remove', errorMessage(e));
          }
        },
      },
    ]);
  }

  if (loading) return <Loading label="Loading day…" />;
  if (!challenge || !day) {
    return (
      <Screen scroll>
        <Body>This day is not available.</Body>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl * 2 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ---- day header ---- */}
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Caption>{formatDate(day.day_date)}</Caption>
              <View style={{ height: 2 }} />
              <Hero>Day {day.day_number}</Hero>
            </View>
            {allDone ? (
              <Badge label="Complete" tone="green" dot />
            ) : isFuture ? (
              <Badge label="Locked" tone="neutral" />
            ) : tasks.length > 0 ? (
              <Badge label={`${myDone.size} of ${tasks.length}`} tone="amber" />
            ) : null}
          </Row>

          {tasks.length > 0 ? (
            <View style={{ marginTop: spacing.lg }}>
              <ProgressBar
                value={myDone.size / tasks.length}
                tint={allDone ? colors.green : colors.amber}
                height={5}
              />
            </View>
          ) : null}

          {allDone ? (
            <View style={styles.greenBanner}>
              <Ionicons name="checkmark-circle" size={19} color={colors.green} />
              <Text style={styles.greenBannerText}>
                Every task ticked — this day is green on your grid.
              </Text>
            </View>
          ) : null}

          {isFuture ? (
            <Card style={{ marginTop: spacing.lg, backgroundColor: colors.surfaceHi }}>
              <Row style={{ gap: spacing.md }}>
                <Ionicons name="lock-closed-outline" size={16} color={colors.textFaint} />
                <Body muted size={13}>
                  This day has not started yet. You can tick tasks and log time from{' '}
                  {formatDate(day.day_date)}.
                </Body>
              </Row>
            </Card>
          ) : null}

          {/* ---- tasks ---- */}
          <SectionTitle
            right={
              challenge.opponent_id ? (
                <Text style={styles.legendMini}>
                  ◦ = {displayNameOf(opponentProfile)}
                </Text>
              ) : null
            }
          >
            Tasks
          </SectionTitle>

          {tasks.length === 0 ? (
            <Card>
              <Body muted size={13}>
                {amCreator
                  ? 'No tasks for this day yet. Add the first checkbox below.'
                  : `${displayNameOf(challenge.creator)} has not set any tasks for this day yet.`}
              </Body>
            </Card>
          ) : (
            tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                done={myDone.has(task.id)}
                rivalDone={theirDone.has(task.id)}
                busy={togglingId === task.id}
                locked={!amParticipant || isFuture}
                canDelete={Boolean(amCreator)}
                onToggle={() => toggle(task)}
                onDelete={() => confirmDeleteTask(task)}
              />
            ))
          )}

          {amCreator ? (
            <Row style={{ gap: spacing.sm, marginTop: spacing.md }}>
              <TextInput
                value={newTask}
                onChangeText={setNewTask}
                placeholder="Add a checkbox for this day"
                placeholderTextColor={colors.textFaint}
                style={styles.addInput}
                maxLength={140}
                onSubmitEditing={add}
                returnKeyType="done"
              />
              <Button title="Add" small loading={adding} onPress={add} disabled={!newTask.trim()} />
            </Row>
          ) : null}

          {/* ---- productivity timer ---- */}
          {amParticipant ? (
            <>
              <SectionTitle>Productivity timer</SectionTitle>
              <FocusTimer
                storageKey={`timer:${challenge.id}:${day.id}`}
                disabled={isFuture}
                myLoggedToday={mySeconds}
                theirLoggedToday={theirSeconds}
                rivalName={challenge.opponent_id ? displayNameOf(opponentProfile) : undefined}
                onLog={onLogTime}
              />

              <Card style={{ marginTop: spacing.md }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row style={{ gap: spacing.sm, flex: 1 }}>
                    <Avatar name={profile ? displayNameOf(profile) : 'You'} size={30} />
                    <Text style={styles.tallyName}>You</Text>
                  </Row>
                  <Text style={[styles.tallyTime, { color: colors.primary }]}>
                    {formatDuration(mySeconds)}
                  </Text>
                </Row>

                {challenge.opponent_id ? (
                  <Row style={{ justifyContent: 'space-between', marginTop: spacing.md }}>
                    <Row style={{ gap: spacing.sm, flex: 1 }}>
                      <Avatar name={displayNameOf(opponentProfile)} size={30} />
                      <Text style={styles.tallyName} numberOfLines={1}>
                        {displayNameOf(opponentProfile)}
                      </Text>
                    </Row>
                    <Text style={[styles.tallyTime, { color: colors.rival }]}>
                      {formatDuration(theirSeconds)}
                    </Text>
                  </Row>
                ) : null}
              </Card>

              {mySessions.length > 0 ? (
                <>
                  <SectionTitle>Your entries today</SectionTitle>
                  {mySessions.map((s) => (
                    <Row key={s.id} style={styles.sessionRow}>
                      <Ionicons name="time-outline" size={15} color={colors.textFaint} />
                      <Text style={styles.sessionTime}>{formatDuration(s.seconds)}</Text>
                      <Text style={styles.sessionAt}>
                        {new Date(s.created_at).toLocaleTimeString(undefined, {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </Text>
                      <Pressable onPress={() => confirmDeleteSession(s)} hitSlop={8}>
                        <Ionicons name="close" size={16} color={colors.textFaint} />
                      </Pressable>
                    </Row>
                  ))}
                </>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dayTitle: { color: colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  dayDate: { color: colors.textFaint, fontSize: 13, marginTop: 2 },
  greenBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.greenDim,
    borderWidth: 1,
    borderColor: colors.greenEdge,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  greenBannerText: { color: colors.green, fontSize: 13, fontWeight: '600', flex: 1 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  taskRowDone: { borderColor: colors.greenEdge, backgroundColor: colors.greenDim },
  checkArea: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.borderGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.green, borderColor: colors.green },
  taskTitle: { color: colors.text, fontSize: 15, flex: 1 },
  taskTitleDone: { color: colors.green, textDecorationLine: 'line-through' },
  theirDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.rival },
  addInput: {
    flex: 1,
    backgroundColor: colors.surfaceHi,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  legendMini: { color: colors.textFaint, fontSize: 10 },
  tallyName: { color: colors.text, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  tallyTime: { fontSize: 16, fontWeight: '800' },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  sessionTime: { color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 },
  sessionAt: { color: colors.textFaint, fontSize: 12 },
});
