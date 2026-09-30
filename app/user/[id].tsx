import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Avatar, Badge, Body, Button, Card, EmptyState, H2, Loading, Row, Screen, SectionTitle,
} from '../../components/ui';
import { useAuth } from '../../lib/auth';
import {
  getProfile, listFriendships, otherPerson, removeFriendship, respondToFriendRequest, sendFriendRequest,
} from '../../lib/api';
import { errorMessage } from '../../lib/supabase';
import { colors, spacing } from '../../lib/theme';
import { displayNameOf, type FriendEdge, type Profile } from '../../lib/types';

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [edge, setEdge] = useState<FriendEdge | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id || !user) return;
    try {
      const [p, edges] = await Promise.all([getProfile(id), listFriendships(user.id)]);
      setProfile(p);
      setEdge(
        edges.find((e) => e.requester_id === id || e.addressee_id === id) ?? null
      );
    } catch (e) {
      Alert.alert('Could not load profile', errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      Alert.alert('Could not update', errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (!profile) {
    return (
      <Screen scroll edges={['bottom']}>
        <EmptyState title="Profile not found" />
      </Screen>
    );
  }

  const isMe = profile.id === user?.id;
  const theyRequested = edge?.status === 'pending' && edge.addressee_id === user?.id;
  const iRequested = edge?.status === 'pending' && edge.requester_id === user?.id;
  const areFriends = edge?.status === 'accepted';

  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen options={{ title: `@${profile.username}` }} />

      <Card style={{ alignItems: 'center' }}>
        <Avatar name={displayNameOf(profile)} size={76} />
        <View style={{ height: spacing.md }} />
        <H2>{displayNameOf(profile)}</H2>
        <Text style={styles.handle}>@{profile.username}</Text>
        {areFriends ? (
          <View style={{ marginTop: spacing.md }}>
            <Badge label="Friends" tone='accent' />
          </View>
        ) : null}
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      </Card>

      {!isMe ? (
        <>
          <SectionTitle>Friendship</SectionTitle>
          {areFriends ? (
            <Row style={{ gap: spacing.sm }}>
              <Button
                title="Challenge them"
                style={{ flex: 1 }}
                onPress={() => router.push('/challenge/new')}
              />
              <Button
                title="Remove"
                variant="secondary"
                style={{ flex: 1 }}
                loading={busy}
                onPress={() => edge && act(() => removeFriendship(edge.id))}
              />
            </Row>
          ) : theyRequested ? (
            <Row style={{ gap: spacing.sm }}>
              <Button
                title="Accept request"
                style={{ flex: 1 }}
                loading={busy}
                onPress={() => edge && act(() => respondToFriendRequest(edge.id, true))}
              />
              <Button
                title="Decline"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => edge && act(() => respondToFriendRequest(edge.id, false))}
              />
            </Row>
          ) : iRequested ? (
            <Card>
              <Body muted size={13}>Friend request sent. Waiting for them to accept.</Body>
            </Card>
          ) : (
            <Button
              title="Add friend"
              loading={busy}
              onPress={() => user && act(() => sendFriendRequest(user.id, profile.id))}
            />
          )}
        </>
      ) : null}

      <View style={{ height: spacing.xl }} />
      <Body muted size={12} center>
        Joined {new Date(profile.created_at).toLocaleDateString(undefined, {
          month: 'long',
          year: 'numeric',
        })}
      </Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  handle: { color: colors.textFaint, fontSize: 13, marginTop: 2 },
  bio: { color: colors.textDim, fontSize: 14, textAlign: 'center', marginTop: spacing.md, lineHeight: 20 },
});
