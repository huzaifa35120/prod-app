import React, { useCallback, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Badge, Body, Button, Card, EmptyState, Field, H1, Loading, Row, Screen, SectionTitle } from '../../components/ui';
import { ChallengeCard } from '../../components/ChallengeCard';
import { useAuth } from '../../lib/auth';
import { listMyJoinRequests, listOpenChallenges, requestToJoin } from '../../lib/api';
import { errorMessage } from '../../lib/supabase';
import { colors, spacing } from '../../lib/theme';
import type { ChallengeWithPeople, JoinRequestWithChallenge } from '../../lib/types';

export default function Discover() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState<ChallengeWithPeople[]>([]);
  const [myRequests, setMyRequests] = useState<JoinRequestWithChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      const [openList, requests] = await Promise.all([
        listOpenChallenges(user.id),
        listMyJoinRequests(user.id),
      ]);
      setOpen(openList);
      setMyRequests(requests);
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

  const requestByChallenge = useMemo(() => {
    const map = new Map<string, JoinRequestWithChallenge>();
    for (const r of myRequests) map.set(r.challenge_id, r);
    return map;
  }, [myRequests]);

  async function ask(challenge: ChallengeWithPeople) {
    setBusyId(challenge.id);
    try {
      await requestToJoin(challenge.id, null);
      await load();
      Alert.alert('Request sent', `${challenge.creator?.username ?? 'The creator'} will get to decide.`);
    } catch (e) {
      Alert.alert('Could not send request', errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <Loading label="Finding open challenges…" />;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
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
        <H1>Discover</H1>
        <View style={{ height: spacing.xs }} />
        <Body muted>Open challenges looking for a second player.</Body>

        <Card style={{ marginTop: spacing.xl }}>
          <Field
            label="Have an invite code?"
            value={code}
            onChangeText={setCode}
            placeholder="e.g. 9f2ac41b77de"
            autoCapitalize="none"
            autoCorrect={false}
            style={{ marginBottom: 0 }}
          />
          <Button
            title="Open invitation"
            variant="secondary"
            disabled={code.trim().length < 4}
            onPress={() => router.push(`/join/${code.trim().toLowerCase()}`)}
          />
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {myRequests.length > 0 ? (
          <>
            <SectionTitle>Your requests</SectionTitle>
            {myRequests.map((r) => (
              <Card key={r.id} style={{ marginBottom: spacing.sm }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={styles.reqTitle} numberOfLines={1}>
                    {r.challenge?.title ?? 'Challenge'}
                  </Text>
                  <Badge
                    label={r.status[0].toUpperCase() + r.status.slice(1)}
                    tone={r.status === 'accepted' ? 'green' : r.status === 'declined' ? 'red' : 'amber'}
                  />
                </Row>
                {r.status === 'accepted' && r.challenge ? (
                  <Button
                    title="Open challenge"
                    variant="secondary"
                    small
                    style={{ marginTop: spacing.md }}
                    onPress={() => router.push(`/challenge/${r.challenge_id}`)}
                  />
                ) : null}
              </Card>
            ))}
          </>
        ) : null}

        <SectionTitle>Open challenges</SectionTitle>

        {open.length === 0 ? (
          <EmptyState
            icon="🌱"
            title="Nothing open right now"
            subtitle="When someone posts a public challenge without an opponent, it shows up here."
          />
        ) : (
          open.map((c) => {
            const existing = requestByChallenge.get(c.id);
            return (
              <ChallengeCard
                key={c.id}
                challenge={c}
                footer={
                  existing && existing.status === 'pending' ? (
                    <Badge label="Request pending" tone="amber" />
                  ) : existing && existing.status === 'declined' ? (
                    <Button
                      title="Ask again"
                      variant="secondary"
                      small
                      loading={busyId === c.id}
                      onPress={() => ask(c)}
                    />
                  ) : (
                    <Button
                      title="Request to join"
                      small
                      loading={busyId === c.id}
                      onPress={() => ask(c)}
                    />
                  )
                }
              />
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.red, marginTop: spacing.lg, fontSize: 14 },
  reqTitle: { color: colors.text, fontWeight: '700', fontSize: 15, flex: 1, marginRight: spacing.md },
});
