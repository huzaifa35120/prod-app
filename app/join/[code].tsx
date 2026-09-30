import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
// Direct import: the package root pulls in every icon font family.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Badge, Body, Button, Card, EmptyState, H2, Loading, Row, Screen } from '../../components/ui';
import { joinChallengeByCode, previewInvite, type InvitePreview } from '../../lib/api';
import { errorMessage } from '../../lib/supabase';
import { formatDate } from '../../lib/format';
import { colors, spacing } from '../../lib/theme';

export default function JoinByCode() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();

  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    try {
      setInvite(await previewInvite(code));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);

  async function accept() {
    if (!code) return;
    setJoining(true);
    try {
      const challenge = await joinChallengeByCode(code);
      router.replace(`/challenge/${challenge.id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setJoining(false);
    }
  }

  if (loading) return <Loading label="Checking invitation…" />;

  if (!invite) {
    return (
      <Screen scroll edges={['bottom']}>
        <Stack.Screen options={{ title: 'Invitation' }} />
        <EmptyState
                    title="That invite is not valid"
          subtitle="Double-check the code or ask your friend to send the link again."
          action={<Button title="Back to challenges" variant="secondary" onPress={() => router.replace('/(tabs)')} />}
        />
      </Screen>
    );
  }

  const creatorName = invite.creator_display_name || invite.creator_username;
  const blocked = invite.has_opponent || invite.i_am_creator || invite.status !== 'open';

  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen options={{ title: 'Invitation' }} />

      <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
        <Text style={{ fontSize: 44 }}>🤝</Text>
        <View style={{ height: spacing.md }} />
        <H2>{creatorName} challenged you</H2>
      </View>

      <Card>
        <Badge label={`${invite.day_count} days`} tone='accent' />
        <Text style={styles.title}>{invite.title}</Text>
        {invite.description ? <Text style={styles.desc}>{invite.description}</Text> : null}

        <Row style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <Ionicons name="calendar-outline" size={15} color={colors.textFaint} />
          <Text style={styles.meta}>
            {formatDate(invite.start_date)} → {formatDate(invite.end_date)}
          </Text>
        </Row>
        <Row style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <Ionicons name="person-outline" size={15} color={colors.textFaint} />
          <Text style={styles.meta}>Created by @{invite.creator_username}</Text>
        </Row>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={{ height: spacing.xl }} />

      {invite.i_am_creator ? (
        <>
          <Body muted center size={13}>
            This is your own challenge — share the link with someone else.
          </Body>
          <View style={{ height: spacing.lg }} />
          <Button
            title="Open challenge"
            variant="secondary"
            onPress={() => router.replace(`/challenge/${invite.challenge_id}`)}
          />
        </>
      ) : invite.has_opponent ? (
        <>
          <Body muted center size={13}>
            Someone already took the second slot on this one.
          </Body>
          <View style={{ height: spacing.lg }} />
          <Button title="Back to challenges" variant="secondary" onPress={() => router.replace('/(tabs)')} />
        </>
      ) : (
        <>
          <Button title="Accept challenge" loading={joining} disabled={blocked} onPress={accept} />
          <View style={{ height: spacing.md }} />
          <Button title="Not now" variant="ghost" onPress={() => router.replace('/(tabs)')} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: spacing.md },
  desc: { color: colors.textDim, fontSize: 14, lineHeight: 20, marginTop: spacing.sm },
  meta: { color: colors.textFaint, fontSize: 13 },
  error: { color: colors.danger, fontSize: 14, marginTop: spacing.lg, textAlign: 'center' },
});
