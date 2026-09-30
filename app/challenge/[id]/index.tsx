import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
// Direct import: the package root pulls in every icon font family.
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Avatar, Badge, Body, Button, Card, H2, Loading, Row, Screen, SectionTitle,
} from '../../../components/ui';
import { DayGrid, GridLegend } from '../../../components/DayGrid';
import { StatsPanel } from '../../../components/StatsPanel';
import { useAuth } from '../../../lib/auth';
import {
  deleteChallenge, getChallenge, getDayProgress, getLeaderboard, listDays,
  listJoinRequestsFor, requestToJoin, respondToJoinRequest,
} from '../../../lib/api';
import { supabase, errorMessage } from '../../../lib/supabase';
import { challengePhase, formatDate } from '../../../lib/format';
import { colors, fonts, radius, spacing } from '../../../lib/theme';
import {
  displayNameOf,
  type ChallengeDay, type ChallengeWithPeople, type DayProgress,
  type JoinRequestWithUser, type LeaderboardRow,
} from '../../../lib/types';

export default function ChallengeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [challenge, setChallenge] = useState<ChallengeWithPeople | null>(null);
  const [days, setDays] = useState<ChallengeDay[]>([]);
  const [progress, setProgress] = useState<DayProgress[]>([]);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [requests, setRequests] = useState<JoinRequestWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<'me' | 'them'>('me');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const c = await getChallenge(id);
      setChallenge(c);
      if (!c) return;

      const isParticipant = c.creator_id === user?.id || c.opponent_id === user?.id;
      const [d, p, b, r] = await Promise.all([
        listDays(id),
        isParticipant ? getDayProgress(id) : Promise.resolve([]),
        isParticipant ? getLeaderboard(id) : Promise.resolve([]),
        c.creator_id === user?.id && !c.opponent_id ? listJoinRequestsFor(id) : Promise.resolve([]),
      ]);
      setDays(d);
      setProgress(p);
      setBoard(b);
      setRequests(r);
    } catch (e) {
      Alert.alert('Could not load challenge', errorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // Live-update when either player ticks a task or logs focus time.
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`challenge:${id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'task_completions', filter: `challenge_id=eq.${id}` },
        () => void load())
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'focus_sessions', filter: `challenge_id=eq.${id}` },
        () => void load())
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'challenges', filter: `id=eq.${id}` },
        () => void load())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, load]);

  const amCreator = challenge?.creator_id === user?.id;
  const amOpponent = challenge?.opponent_id === user?.id;
  const amParticipant = amCreator || amOpponent;

  const opponentProfile = amCreator ? challenge?.opponent : challenge?.creator;
  const opponentId = amCreator ? challenge?.opponent_id : challenge?.creator_id;

  const myProgress = useMemo(() => {
    const m = new Map<number, DayProgress>();
    for (const p of progress) if (p.user_id === user?.id) m.set(p.day_number, p);
    return m;
  }, [progress, user?.id]);

  const theirProgress = useMemo(() => {
    const m = new Map<number, DayProgress>();
    for (const p of progress) if (p.user_id === opponentId) m.set(p.day_number, p);
    return m;
  }, [progress, opponentId]);

  const inviteUrl = useMemo(
    () => (challenge ? Linking.createURL(`/join/${challenge.invite_code}`) : ''),
    [challenge]
  );

  async function shareInvite() {
    if (!challenge) return;
    try {
      await Share.share({
        message:
          `Take me on in "${challenge.title}" — ${challenge.day_count} days, starting ` +
          `${formatDate(challenge.start_date)}.\n\n${inviteUrl}\n\n` +
          `Or paste this code in the app: ${challenge.invite_code}`,
      });
    } catch {
      // User dismissed the share sheet.
    }
  }

  async function copyCode() {
    if (!challenge) return;
    await Clipboard.setStringAsync(challenge.invite_code);
    Alert.alert('Copied', 'Invite code copied to your clipboard.');
  }

  async function respond(requestId: string, accept: boolean) {
    setBusy(true);
    try {
      await respondToJoinRequest(requestId, accept);
      await load();
    } catch (e) {
      Alert.alert('Could not respond', errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function askToJoin() {
    if (!challenge) return;
    setBusy(true);
    try {
      await requestToJoin(challenge.id, null);
      Alert.alert('Request sent', 'You will show up in the creator’s request list.');
    } catch (e) {
      Alert.alert('Could not send request', errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    if (!challenge) return;
    Alert.alert('Delete challenge', 'This removes the challenge and all its tasks. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteChallenge(challenge.id);
            router.replace('/(tabs)');
          } catch (e) {
            Alert.alert('Could not delete', errorMessage(e));
          }
        },
      },
    ]);
  }

  if (loading) return <Loading label="Loading challenge…" />;
  if (!challenge) {
    return (
      <Screen scroll>
        <Body>This challenge is not available.</Body>
      </Screen>
    );
  }

  const phase = challengePhase(challenge.start_date, challenge.end_date);
  const finished = challenge.status === 'completed' || phase === 'finished';
  const myRow = board.find((r) => r.user_id === user?.id);
  const theirRow = board.find((r) => r.user_id === opponentId);
  const gridProgress = viewing === 'me' ? myProgress : theirProgress;
  const gridOther = viewing === 'me' ? theirProgress : myProgress;

  return (
    <Screen edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl * 2 }}
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
        {/* ---- header ---- */}
        <Row style={{ gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' }}>
          <Badge
            label={
              finished ? 'Finished' : !challenge.opponent_id ? 'Waiting for opponent'
                : phase === 'upcoming' ? 'Starts soon' : 'Live'
            }
            tone={finished ? 'rival' : !challenge.opponent_id ? 'neutral' : phase === 'upcoming' ? 'accent' : 'accent'}
          />
          <Badge label={`${challenge.day_count} days`} />
          <Badge label={challenge.is_public ? 'Public' : 'Private'} tone={challenge.is_public ? 'accent' : 'neutral'} />
        </Row>

        <Text style={styles.title}>{challenge.title}</Text>
        {challenge.description ? <Text style={styles.desc}>{challenge.description}</Text> : null}
        <Text style={styles.dates}>
          {formatDate(challenge.start_date)} → {formatDate(challenge.end_date)}
        </Text>

        {/* ---- stats ---- */}
        {amParticipant && challenge.opponent_id ? (
          <>
            <SectionTitle>Standings</SectionTitle>
            <StatsPanel
              finished={finished}
              me={{ profile: amCreator ? challenge.creator : challenge.opponent, row: myRow, isMe: true }}
              them={{ profile: opponentProfile ?? null, row: theirRow, isMe: false }}
            />
          </>
        ) : null}

        {/* ---- invite / join ---- */}
        {!challenge.opponent_id && amCreator ? (
          <>
            <SectionTitle>Invite an opponent</SectionTitle>
            <Card>
              <Body muted size={13}>
                Send this link to a friend. Opening it in the app drops them straight into the
                challenge.
              </Body>
              <View style={styles.codeBox}>
                <Text style={styles.code} selectable>
                  {challenge.invite_code}
                </Text>
              </View>
              <Row style={{ gap: spacing.sm }}>
                <Button title="Share link" style={{ flex: 1 }} onPress={shareInvite} />
                <Button title="Copy code" variant="secondary" style={{ flex: 1 }} onPress={copyCode} />
              </Row>
            </Card>

            <SectionTitle right={<Badge label={`${requests.length}`} tone={requests.length ? 'accent' : 'neutral'} />}>
              Join requests
            </SectionTitle>
            {requests.length === 0 ? (
              <Card>
                <Body muted size={13}>
                  No one has asked to join yet.
                  {challenge.is_public ? ' It is listed on Discover.' : ' This challenge is private.'}
                </Body>
              </Card>
            ) : (
              requests.map((r) => (
                <Card key={r.id} style={{ marginBottom: spacing.sm }}>
                  <Row style={{ gap: spacing.md }}>
                    <Avatar name={displayNameOf(r.profile)} size={38} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{displayNameOf(r.profile)}</Text>
                      <Text style={styles.handle}>@{r.profile?.username}</Text>
                    </View>
                  </Row>
                  {r.message ? <Text style={styles.message}>“{r.message}”</Text> : null}
                  <Row style={{ gap: spacing.sm, marginTop: spacing.md }}>
                    <Button title="Accept" small style={{ flex: 1 }} loading={busy}
                      onPress={() => respond(r.id, true)} />
                    <Button title="Decline" variant="secondary" small style={{ flex: 1 }}
                      onPress={() => respond(r.id, false)} />
                  </Row>
                </Card>
              ))
            )}
          </>
        ) : null}

        {!challenge.opponent_id && !amCreator ? (
          <Card style={{ marginTop: spacing.xl }}>
            <H2>This challenge needs a second player</H2>
            <View style={{ height: spacing.sm }} />
            <Body muted size={13}>
              Ask {displayNameOf(challenge.creator)} for the slot. They decide who gets in.
            </Body>
            <View style={{ height: spacing.lg }} />
            <Button title="Request to join" loading={busy} onPress={askToJoin} />
          </Card>
        ) : null}

        {/* ---- day grid ---- */}
        {amParticipant ? (
          <>
            <SectionTitle>The {challenge.day_count} days</SectionTitle>

            {challenge.opponent_id ? (
              <Row style={styles.segment}>
                <SegmentButton
                  label="You"
                  active={viewing === 'me'}
                  onPress={() => setViewing('me')}
                />
                <SegmentButton
                  label={displayNameOf(opponentProfile)}
                  active={viewing === 'them'}
                  onPress={() => setViewing('them')}
                />
              </Row>
            ) : null}

            <DayGrid
              days={days}
              progress={gridProgress}
              opponentProgress={challenge.opponent_id ? gridOther : undefined}
              onPressDay={(d) => router.push(`/challenge/${challenge.id}/day/${d.day_number}`)}
            />
            <GridLegend
              rivalName={
                challenge.opponent_id
                  ? viewing === 'me'
                    ? displayNameOf(opponentProfile)
                    : 'You'
                  : undefined
              }
            />

            {amCreator ? (
              <Card style={{ marginTop: spacing.xl, backgroundColor: colors.surfaceHi }}>
                <Row style={{ gap: spacing.md }}>
                  <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
                  <Body muted size={13}>
                    You created this challenge, so you set the tasks. Tap any day to add or remove its
                    checkboxes.
                  </Body>
                </Row>
              </Card>
            ) : null}
          </>
        ) : null}

        {amCreator ? (
          <>
            <SectionTitle>Danger zone</SectionTitle>
            <Button title="Delete challenge" variant="danger" onPress={confirmDelete} />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.segmentBtn}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.segmentRule, active && styles.segmentRuleActive]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  desc: { color: colors.textDim, fontSize: 14, lineHeight: 20, marginTop: spacing.sm },
  dates: { color: colors.textFaint, fontSize: 12, marginTop: spacing.md },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  handle: { color: colors.textFaint, fontSize: 12, marginTop: 1 },
  message: { color: colors.textDim, fontSize: 13, fontStyle: 'italic', marginTop: spacing.md },
  codeBox: {
    backgroundColor: colors.surfaceHi,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.lg,
    alignItems: 'center',
  },
  code: { color: colors.done, fontFamily: 'Menlo', fontSize: 16, letterSpacing: 2 },
  segment: { gap: spacing.xl, marginBottom: spacing.lg },
  segmentBtn: { alignItems: 'flex-start' },
  segmentBtnActive: {},
  segmentText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginBottom: 7,
  },
  segmentTextActive: { color: colors.text },
  segmentRule: { height: 2, width: '100%', minWidth: 42, backgroundColor: 'transparent' },
  segmentRuleActive: { backgroundColor: colors.accent },
});
