import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
// Direct import: the package root pulls in every icon font family.
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Avatar, Body, Button, Caption, EmptyState, Hero, Loading, Row, Screen, SectionTitle, StatTile,
} from '../../components/ui';
import { ChallengeCard, type Standing } from '../../components/ChallengeCard';
import { useAuth } from '../../lib/auth';
import { finalizeDueChallenges, getLeaderboards, listMyChallenges } from '../../lib/api';
import { errorMessage } from '../../lib/supabase';
import { challengePhase, formatDuration } from '../../lib/format';
import { colors, gradients, radius, spacing, type } from '../../lib/theme';
import { displayNameOf, type ChallengeWithPeople, type LeaderboardRow } from '../../lib/types';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function MyChallenges() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [challenges, setChallenges] = useState<ChallengeWithPeople[]>([]);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      await finalizeDueChallenges();
      const mine = await listMyChallenges(user.id);
      setChallenges(mine);
      setBoard(await getLeaderboards(mine.map((c) => c.id)));
    } catch (e) {
      setError(errorMessage(e));
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
      if (rows.length < 2) return undefined;
      const mine = rows.find((r) => r.user_id === user.id);
      const theirs = rows.find((r) => r.user_id !== user.id);
      if (!mine || !theirs) return undefined;
      return { mySeconds: Number(mine.total_seconds), theirSeconds: Number(theirs.total_seconds) };
    },
    [board, user]
  );

  const groups = useMemo(() => {
    const live: ChallengeWithPeople[] = [];
    const waiting: ChallengeWithPeople[] = [];
    const upcoming: ChallengeWithPeople[] = [];
    const finished: ChallengeWithPeople[] = [];

    for (const c of challenges) {
      const phase = challengePhase(c.start_date, c.end_date);
      if (!c.opponent_id) waiting.push(c);
      else if (c.status === 'completed' || phase === 'finished') finished.push(c);
      else if (phase === 'upcoming') upcoming.push(c);
      else live.push(c);
    }
    return { live, waiting, upcoming, finished };
  }, [challenges]);

  const totals = useMemo(() => {
    if (!user) return { seconds: 0, days: 0, wins: 0 };
    const mine = board.filter((r) => r.user_id === user.id);
    const seconds = mine.reduce((s, r) => s + Number(r.total_seconds), 0);
    const days = mine.reduce((s, r) => s + r.days_complete, 0);

    let wins = 0;
    for (const c of challenges) {
      if (c.status !== 'completed') continue;
      const rows = board.filter((r) => r.challenge_id === c.id);
      const me = rows.find((r) => r.user_id === user.id);
      const them = rows.find((r) => r.user_id !== user.id);
      if (me && them && Number(me.total_seconds) > Number(them.total_seconds)) wins += 1;
    }
    return { seconds, days, wins };
  }, [board, challenges, user]);

  if (loading) return <Loading label="Loading your challenges…" />;

  const empty = challenges.length === 0;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
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
        {/* hero */}
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.hero}
        >
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Caption>{greeting()}</Caption>
              <View style={{ height: 4 }} />
              <Hero>{profile ? displayNameOf(profile).split(' ')[0] : 'Athlete'}</Hero>
            </View>
            <Row style={{ gap: spacing.sm }}>
              <Pressable
                onPress={() => router.push('/challenge/new')}
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                hitSlop={6}
              >
                <LinearGradient
                  colors={gradients.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.newButton}
                >
                  <Ionicons name="add" size={24} color={colors.primaryInk} />
                </LinearGradient>
              </Pressable>
              <Pressable onPress={() => router.push('/(tabs)/profile')}>
                <Avatar name={profile ? displayNameOf(profile) : '?'} size={46} />
              </Pressable>
            </Row>
          </Row>

          {!empty ? (
            <Row style={{ gap: spacing.sm, marginTop: spacing.xl }}>
              <StatTile label="Focused" value={formatDuration(totals.seconds)} tint={colors.primary} />
              <StatTile label="Days done" value={String(totals.days)} tint={colors.green} />
              <StatTile label="Wins" value={String(totals.wins)} tint={colors.amber} />
            </Row>
          ) : null}
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg }}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {empty ? (
            <EmptyState
              icon="🏁"
              title="No challenges yet"
              subtitle="Create one and invite a friend, or browse open challenges other people have posted."
              action={
                <Button title="Create a challenge" onPress={() => router.push('/challenge/new')} />
              }
            />
          ) : null}

          <Group title="Live now" items={groups.live} standingFor={standingFor} router={router} />
          <Group title="Waiting for an opponent" items={groups.waiting} standingFor={standingFor} router={router} />
          <Group title="Starting soon" items={groups.upcoming} standingFor={standingFor} router={router} />
          <Group title="Finished" items={groups.finished} standingFor={standingFor} router={router} />
        </View>
      </ScrollView>

    </Screen>
  );
}

function Group({
  title,
  items,
  standingFor,
  router,
}: {
  title: string;
  items: ChallengeWithPeople[];
  standingFor: (c: ChallengeWithPeople) => Standing | undefined;
  router: ReturnType<typeof useRouter>;
}) {
  if (items.length === 0) return null;
  return (
    <>
      <SectionTitle right={<Text style={type.caption}>{items.length}</Text>}>{title}</SectionTitle>
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
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
  },
  error: { ...type.bodySm, color: colors.red, marginTop: spacing.lg },
  newButton: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
