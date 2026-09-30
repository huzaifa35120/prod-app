import React, { useMemo, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { useRouter } from 'expo-router';
// Direct import: the package root pulls in every icon font family.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Body, Button, Caption, Card, Field, H2, Row, Screen } from '../../components/ui';
import { DateField } from '../../components/DateField';
import { useAuth } from '../../lib/auth';
import { createChallenge } from '../../lib/api';
import { errorMessage } from '../../lib/supabase';
import { addDays, formatDate, toDateKey } from '../../lib/format';
import { colors, fonts, radius, spacing, type } from '../../lib/theme';

const DAY_PRESETS = [7, 14, 21, 30, 60, 90];

const TASK_SUGGESTIONS = [
  'No phone before noon',
  '2h deep work',
  'Gym or a run',
  'Read 20 pages',
  'In bed by 11',
  '3L of water',
];

const MAX_TASKS = 20;

export default function NewChallenge() {
  const { user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dayCount, setDayCount] = useState(30);
  const [startDate, setStartDate] = useState(new Date());
  const [isPublic, setIsPublic] = useState(true);
  const [tasks, setTasks] = useState<string[]>([]);
  const [taskDraft, setTaskDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const endDate = useMemo(() => addDays(startDate, dayCount - 1), [startDate, dayCount]);

  function addTask(raw: string) {
    const title = raw.trim();
    if (!title) return;
    if (tasks.length >= MAX_TASKS) {
      Alert.alert('That is plenty', `A challenge can start with up to ${MAX_TASKS} daily tasks.`);
      return;
    }
    if (tasks.some((t) => t.toLowerCase() === title.toLowerCase())) {
      setTaskDraft('');
      return;
    }
    setTasks((prev) => [...prev, title.slice(0, 140)]);
    setTaskDraft('');
  }

  function removeTask(index: number) {
    setTasks((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    if (!user) return;
    if (title.trim().length < 3) {
      Alert.alert('Add a title', 'Give the challenge a name of at least 3 characters.');
      return;
    }
    if (dayCount < 1 || dayCount > 365) {
      Alert.alert('Check the length', 'A challenge must run between 1 and 365 days.');
      return;
    }

    setBusy(true);
    try {
      const created = await createChallenge({
        title: title.trim(),
        description: description.trim() || null,
        day_count: dayCount,
        start_date: toDateKey(startDate),
        is_public: isPublic,
        tasks,
      });
      router.replace(`/challenge/${created.id}`);
    } catch (e) {
      Alert.alert('Could not create challenge', errorMessage(e));
    } finally {
      setBusy(false);
    }
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
          <Field
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="75 Hard, but friendlier"
            maxLength={80}
          />
          <Field
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="What are you both signing up for?"
            multiline
            maxLength={500}
          />

          <Text style={styles.label}>Length</Text>
          <Row style={{ flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
            {DAY_PRESETS.map((n) => (
              <Pressable
                key={n}
                onPress={() => setDayCount(n)}
                style={[styles.chip, dayCount === n && styles.chipActive]}
              >
                <Text style={[styles.chipText, dayCount === n && styles.chipTextActive]}>
                  {n} days
                </Text>
              </Pressable>
            ))}
          </Row>

          <View style={styles.customRow}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={type.eyebrow}>Custom</Text>
              <Row style={{ gap: spacing.md }}>
                <Stepper icon="remove" onPress={() => setDayCount((d) => Math.max(1, d - 1))} />
                <Text style={styles.dayCount}>{dayCount}</Text>
                <Stepper icon="add" onPress={() => setDayCount((d) => Math.min(365, d + 1))} />
              </Row>
            </Row>
          </View>

          <Text style={styles.label}>Start date</Text>
          <DateField value={startDate} onChange={setStartDate} />

          {/* ---- daily checklist, applied to every day ---- */}
          <View style={{ height: spacing.xl }} />
          <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text style={styles.label}>Daily tasks</Text>
            <Text style={styles.counter}>
              {tasks.length}/{MAX_TASKS}
            </Text>
          </Row>
          <Caption style={{ marginBottom: spacing.md }}>
            These go onto all {dayCount} days. You can still add or remove tasks on an
            individual day afterwards.
          </Caption>

          {tasks.map((t, i) => (
            <Row key={`${t}-${i}`} style={styles.taskRow}>
              <View style={styles.taskDot} />
              <Text style={styles.taskText} numberOfLines={2}>
                {t}
              </Text>
              <Pressable onPress={() => removeTask(i)} hitSlop={10}>
                <Ionicons name="close" size={16} color={colors.textFaint} />
              </Pressable>
            </Row>
          ))}

          <Row style={{ gap: spacing.sm, marginTop: tasks.length ? spacing.sm : 0 }}>
            <TextInput
              value={taskDraft}
              onChangeText={setTaskDraft}
              placeholder="e.g. 2h of focused work"
              placeholderTextColor={colors.textFaint}
              style={styles.taskInput}
              maxLength={140}
              onSubmitEditing={() => addTask(taskDraft)}
              returnKeyType="done"
              blurOnSubmit={false}
            />
            <Button
              title="Add"
              small
              disabled={!taskDraft.trim() || tasks.length >= MAX_TASKS}
              onPress={() => addTask(taskDraft)}
            />
          </Row>

          {tasks.length === 0 ? (
            <Row style={{ flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
              {TASK_SUGGESTIONS.map((sug) => (
                <Pressable key={sug} onPress={() => addTask(sug)} style={styles.suggestion}>
                  <Ionicons name="add" size={13} color={colors.textDim} />
                  <Text style={styles.suggestionText}>{sug}</Text>
                </Pressable>
              ))}
            </Row>
          ) : null}

          <Card style={{ marginTop: spacing.lg }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <H2>Visible to everyone</H2>
                <Body muted size={13}>
                  {isPublic
                    ? 'Anyone can find this under Browse and ask to join.'
                    : 'Only people with your invite link can join.'}
                </Body>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ true: colors.accent, false: colors.surfaceMax }}
                thumbColor={isPublic ? colors.accentInk : colors.textDim}
                ios_backgroundColor={colors.surfaceMax}
              />
            </Row>
          </Card>

          <Card style={{ marginTop: spacing.lg, backgroundColor: colors.surfaceHi }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={styles.summaryLabel}>Runs</Text>
              <Text style={styles.summaryValue}>{dayCount} days</Text>
            </Row>
            <Row style={{ justifyContent: 'space-between', marginTop: spacing.sm }}>
              <Text style={styles.summaryLabel}>First day</Text>
              <Text style={styles.summaryValue}>{formatDate(toDateKey(startDate))}</Text>
            </Row>
            <Row style={{ justifyContent: 'space-between', marginTop: spacing.sm }}>
              <Text style={styles.summaryLabel}>Last day</Text>
              <Text style={styles.summaryValue}>{formatDate(toDateKey(endDate))}</Text>
            </Row>
          </Card>

          <View style={{ height: spacing.xl }} />
          <Button title="Create challenge" onPress={submit} loading={busy} />
          <View style={{ height: spacing.md }} />
          <Body muted size={12} center>
            {tasks.length > 0
              ? `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'} × ${dayCount} days. You can invite an opponent next.`
              : 'You can add the daily tasks and invite an opponent next.'}
          </Body>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Stepper({ icon, onPress }: { icon: 'add' | 'remove'; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.stepper} hitSlop={6}>
      <Ionicons name={icon} size={18} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: {
    ...type.eyebrow,
    marginBottom: spacing.sm,
  },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: {
    color: colors.textDim,
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  chipTextActive: { color: colors.accentInk },
  dayCount: { color: colors.text, fontFamily: fonts.display, fontSize: 20, minWidth: 44, textAlign: 'center', fontVariant: ['tabular-nums'] },
  counter: { color: colors.textFaint, fontFamily: fonts.bodySemi, fontSize: 12 },
  taskRow: {
    gap: spacing.md,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  taskDot: { width: 3, height: 14, backgroundColor: colors.accent },
  taskText: { flex: 1, color: colors.text, fontFamily: fonts.bodyMd, fontSize: 14 },
  taskInput: {
    flex: 1,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.line,
    paddingVertical: spacing.md,
    color: colors.text,
    fontFamily: fonts.bodyMd,
    fontSize: 15,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  suggestionText: { color: colors.textDim, fontFamily: fonts.bodyMd, fontSize: 12.5 },
  customRow: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.lg,
    marginBottom: spacing.xl,
  },
  stepper: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: { color: colors.textDim, fontSize: 13 },
  summaryValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
});
