import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Badge, Button, EmptyState, Field, Loading, Row, Screen, SectionTitle,
} from '../../components/ui';
import { ChallengeCard, type Standing } from '../../components/ChallengeCard';
import { useAuth } from '../../lib/auth';
import {
  finalizeDueChallenges, getLeaderboards, listMyChallenges, listMyJoinRequests,
  listOpenChallenges, requestToJoin,
} from '../../lib/api';
import { errorMessage } from '../../lib/supabase';
import { challengePhase } from '../../lib/format';
import { colors, fonts, GUTTER, radius, spacing, type } from '../../lib/theme';
import {
  type ChallengeWithPeople, type JoinRequestWithChallenge, type LeaderboardRow,
} from '../../lib/types';

type Mode = 'mine' | 'browse';

/**
 * Challenges.
 *
 * Discover used to be its own tab, which gave browsing strangers' challenges
 * the same weight as your own. It is a toggle here instead, which frees the
 * tab slot that Today now uses.
 */
export default function Challenges() {
  const { user } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('mine');
  const [mine, setMine] = useState<ChallengeWithPeople[]>([]);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [open, setOpen] = useState<ChallengeWithPeople[]>([]);
  const [requests, setRequests] = useState<JoinRequestWithChallenge[]>([]);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      await finalizeDueChallenges();
      const list = await listMyChallenges(user.id);
      setMine(list);
      const [lb, openList, reqs] = await Promise.all([
        getLeaderboards(list.map((c) => c.id)),
        listOpenChallenges(user.id),
        listMyJoinRequests(user.id),
      ]);
      setBoard(lb);
      setOpen(openList);
      setRequests(reqs);
    } catch (e) {
      Alert.alert('Could not load challenges', errorMessage(e));
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

  const standingFor = useCallback(
    (c: ChallengeWithPeople): Standing | undefined => {
      if (!c.opponent_id || !user) return undefined;
      const rows = board.filter((r) => r.challenge_id === c.id);
      const me = rows.find((r) => r.user_id === user.id);
      const them = rows.find((r) => r.user_id !== user.id);
      if (!me || !them) return undefined;
      return { mySeconds: Number(me.total_seconds), theirSeconds: Number(them.total_seconds) };
    },
    [board, user]
  );

  const groups = useMemo(() => {
    const live: ChallengeWithPeople[] = [];
    const waiting: ChallengeWithPeople[] = [];
    const upcoming: ChallengeWithPeople[] = [];
    const done: ChallengeWithPeople[] = [];
    for (const c of mine) {
      const phase = challengePhase(c.start_date, c.end_date);
      if (!c.opponent_id) waiting.push(c);
      else if (c.status === 'completed' || phase === 'finished') done.push(c);
      else if (phase === 'upcoming') upcoming.push(c);
      else live.push(c);
    }
    return { live, waiting, upcoming, done };
  }, [mine]);

  const requestByChallenge = useMemo(() => {
    const m = new Map<string, JoinRequestWithChallenge>();
    for (const r of requests) m.set(r.challenge_id, r);
    return m;
  }, [requests]);

  async function ask(c: ChallengeWithPeople) {
    setBusyId(c.id);
    try {
      await requestToJoin(c.id, null);
      await load();
      Alert.alert('Request sent', 'The creator decides who gets the slot.');
    } catch (e) {
      Alert.alert('Could not send request', errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <Loading label="Loading challenges…" />;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: GUTTER, paddingBottom: spacing.xxxl * 2 }}
        keyboardShouldPersistTaps="handled"
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
        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={type.hero}>Challenges</Text>
          <Pressable onPress={() => router.push('/challenge/new')} style={styles.newBtn} hitSlop={6}>
            <Ionicons name="add" size={20} color={colors.accentInk} />
          </Pressable>
        </Row>

        {/* mine / browse */}
        <Row style={styles.toggle}>
          {(['mine', 'browse'] as Mode[]).map((m) => (
            <Pressable key={m} onPress={() => setMode(m)} style={styles.toggleItem}>
              <Text style={[styles.toggleText, mode === m && styles.toggleTextOn]}>
                {m === 'mine' ? 'Yours' : 'Browse'}
              </Text>
              <View style={[styles.toggleRule, mode === m && { backgroundColor: colors.accent }]} />
            </Pressable>
          ))}
        </Row>

        {mode === 'mine' ? (
          mine.length === 0 ? (
            <EmptyState
              title="No challenges yet"
              subtitle="Create one and invite a friend, or switch to Browse and join one that needs a second player."
              action={<Button title="New challenge" onPress={() => router.push('/challenge/new')} />}
            />
          ) : (
            <>
              <Group title="Live" items={groups.live} standingFor={standingFor} router={router} />
              <Group title="Waiting for a rival" items={groups.waiting} standingFor={standingFor} router={router} />
              <Group title="Starting soon" items={groups.upcoming} standingFor={standingFor} router={router} />
              <Group title="Finished" items={groups.done} standingFor={standingFor} router={router} />
            </>
          )
        ) : (
          <>
            <SectionTitle>Invite code</SectionTitle>
            <Row style={{ gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Field
                  value={code}
                  onChangeText={setCode}
                  placeholder="9f2ac41b77de"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{ marginBottom: 0 }}
                />
              </View>
              <Button
                title="Open"
                small
                disabled={code.trim().length < 4}
                onPress={() => router.push(`/join/${code.trim().toLowerCase()}`)}
              />
            </Row>

            {requests.length > 0 ? (
              <>
                <SectionTitle>Your requests</SectionTitle>
                {requests.map((r) => (
                  <Row key={r.id} style={styles.requestRow}>
                    <Text style={styles.requestTitle} numberOfLines={1}>
                      {r.challenge?.title ?? 'Challenge'}
                    </Text>
                    <Badge
                      label={r.status}
                      tone={r.status === 'accepted' ? 'accent' : r.status === 'declined' ? 'danger' : 'neutral'}
                    />
                  </Row>
                ))}
              </>
            ) : null}

            <SectionTitle>Looking for a rival</SectionTitle>
            {open.length === 0 ? (
              <EmptyState
                title="Nothing open"
                subtitle="Public challenges without a second player show up here."
              />
            ) : (
              open.map((c) => {
                const existing = requestByChallenge.get(c.id);
                return (
                  <ChallengeCard
                    key={c.id}
                    challenge={c}
                    footer={
                      existing?.status === 'pending' ? (
                        <Badge label="Requested" tone="neutral" />
                      ) : (
                        <Button
                          title={existing?.status === 'declined' ? 'Ask again' : 'Request slot'}
                          small
                          variant="secondary"
                          loading={busyId === c.id}
                          onPress={() => ask(c)}
                        />
                      )
                    }
                  />
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Group({
  title, items, standingFor, router,
}: {
  title: string;
  items: ChallengeWithPeople[];
  standingFor: (c: ChallengeWithPeople) => Standing | undefined;
  router: ReturnType<typeof useRouter>;
}) {
  if (items.length === 0) return null;
  return (
    <>
      <SectionTitle right={<Text style={styles.count}>{items.length}</Text>}>{title}</SectionTitle>
      {items.map((c) => (
        <ChallengeCard
          key={c.id}
          challenge={c}
          standing={standingFor(c)}
          onPress={() => router.push(`/challenge/${c.id}`)}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  newBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggle: { gap: spacing.xl, marginTop: spacing.xl, marginBottom: spacing.sm },
  toggleItem: { alignItems: 'flex-start' },
  toggleText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginBottom: 7,
  },
  toggleTextOn: { color: colors.text },
  toggleRule: { height: 2, width: '100%', minWidth: 46, backgroundColor: 'transparent' },
  count: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    color: colors.textFaint,
    fontVariant: ['tabular-nums'],
  },
  requestRow: {
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: spacing.md,
  },
  requestTitle: { fontFamily: fonts.bodyMd, fontSize: 14, color: colors.text, flex: 1 },
});
