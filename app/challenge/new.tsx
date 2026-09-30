import React, { useMemo, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View,
} from 'react-native';
import { useRouter } from 'expo-router';
// Direct import: the package root pulls in every icon font family.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Body, Button, Card, Field, H2, Row, Screen } from '../../components/ui';
import { DateField } from '../../components/DateField';
import { useAuth } from '../../lib/auth';
import { createChallenge } from '../../lib/api';
import { errorMessage } from '../../lib/supabase';
import { addDays, formatDate, toDateKey } from '../../lib/format';
import { colors, radius, spacing } from '../../lib/theme';

const DAY_PRESETS = [7, 14, 21, 30, 60, 90];

export default function NewChallenge() {
  const { user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dayCount, setDayCount] = useState(30);
  const [startDate, setStartDate] = useState(new Date());
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);

  const endDate = useMemo(() => addDays(startDate, dayCount - 1), [startDate, dayCount]);

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
        creator_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        day_count: dayCount,
        start_date: toDateKey(startDate),
        is_public: isPublic,
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

          <Card style={{ marginBottom: spacing.lg }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body muted>Custom length</Body>
              <Row style={{ gap: spacing.md }}>
                <Stepper icon="remove" onPress={() => setDayCount((d) => Math.max(1, d - 1))} />
                <Text style={styles.dayCount}>{dayCount}</Text>
                <Stepper icon="add" onPress={() => setDayCount((d) => Math.min(365, d + 1))} />
              </Row>
            </Row>
          </Card>

          <Text style={styles.label}>Start date</Text>
          <DateField value={startDate} onChange={setStartDate} />

          <Card style={{ marginTop: spacing.lg }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <H2>Visible to everyone</H2>
                <Body muted size={13}>
                  {isPublic
                    ? 'Anyone can find this on Discover and ask to join.'
                    : 'Only people with your invite link can join.'}
                </Body>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.text}
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
            You will be able to add the daily tasks and invite an opponent next.
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
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHi,
  },
  chipActive: { backgroundColor: colors.primaryDim, borderColor: colors.primary },
  chipText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.primary },
  dayCount: { color: colors.text, fontSize: 18, fontWeight: '800', minWidth: 40, textAlign: 'center' },
  stepper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceHi,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: { color: colors.textDim, fontSize: 13 },
  summaryValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
});
