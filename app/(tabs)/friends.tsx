import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
// Direct import: the package root pulls in every icon font family.
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Avatar, Badge, Body, Button, Card, EmptyState, Field, H1, Loading, Row, Screen, SectionTitle,
} from '../../components/ui';
import { useAuth } from '../../lib/auth';
import {
  listFriendships, otherPerson, removeFriendship, respondToFriendRequest, searchUsers, sendFriendRequest,
} from '../../lib/api';
import { errorMessage } from '../../lib/supabase';
import { colors, spacing } from '../../lib/theme';
import { displayNameOf, type FriendEdge, type UserSearchResult } from '../../lib/types';

export default function Friends() {
  const { user } = useAuth();
  const router = useRouter();
  const [edges, setEdges] = useState<FriendEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setEdges(await listFriendships(user.id));
    } catch (e) {
      Alert.alert('Could not load friends', errorMessage(e));
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

  const { friends, incoming, outgoing } = useMemo(() => {
    const f: FriendEdge[] = [];
    const inc: FriendEdge[] = [];
    const out: FriendEdge[] = [];
    for (const e of edges) {
      if (e.status === 'accepted') f.push(e);
      else if (e.status === 'pending') {
        if (e.addressee_id === user?.id) inc.push(e);
        else out.push(e);
      }
    }
    return { friends: f, incoming: inc, outgoing: out };
  }, [edges, user?.id]);

  async function runSearch(text: string) {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      setResults(await searchUsers(text.trim()));
    } catch (e) {
      Alert.alert('Search failed', errorMessage(e));
    } finally {
      setSearching(false);
    }
  }

  async function addFriend(target: UserSearchResult) {
    if (!user) return;
    setBusyId(target.id);
    try {
      await sendFriendRequest(user.id, target.id);
      await Promise.all([load(), runSearch(query)]);
    } catch (e) {
      Alert.alert('Could not send request', errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  async function respond(edge: FriendEdge, accept: boolean) {
    setBusyId(edge.id);
    try {
      await respondToFriendRequest(edge.id, accept);
      await load();
    } catch (e) {
      Alert.alert('Could not update request', errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  function confirmRemove(edge: FriendEdge) {
    const name = displayNameOf(otherPerson(edge, user?.id ?? ''));
    Alert.alert('Remove friend', `Remove ${name} from your friends?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFriendship(edge.id);
            await load();
          } catch (e) {
            Alert.alert('Could not remove', errorMessage(e));
          }
        },
      },
    ]);
  }

  if (loading) return <Loading label="Loading friends…" />;

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
        <H1>Friends</H1>
        <View style={{ height: spacing.xs }} />
        <Body muted>Find people by username, then challenge them.</Body>

        <View style={{ height: spacing.xl }} />
        <Field
          label="Search"
          value={query}
          onChangeText={runSearch}
          placeholder="username or name"
          autoCapitalize="none"
          autoCorrect={false}
          style={{ marginBottom: 0 }}
        />

        {searching ? <Text style={styles.hint}>Searching…</Text> : null}

        {results.length > 0 ? (
          <>
            <SectionTitle>Results</SectionTitle>
            {results.map((r) => (
              <Card key={r.id} style={{ marginBottom: spacing.sm }}>
                <Row style={{ gap: spacing.md }}>
                  <Pressable onPress={() => router.push(`/user/${r.id}`)}>
                    <Avatar name={r.display_name || r.username} size={38} />
                  </Pressable>
                  <Pressable style={{ flex: 1 }} onPress={() => router.push(`/user/${r.id}`)}>
                    <Text style={styles.name}>{r.display_name || r.username}</Text>
                    <Text style={styles.handle}>@{r.username}</Text>
                  </Pressable>
                  <SearchAction
                    result={r}
                    busy={busyId === r.id}
                    onAdd={() => addFriend(r)}
                  />
                </Row>
              </Card>
            ))}
          </>
        ) : null}

        {incoming.length > 0 ? (
          <>
            <SectionTitle right={<Badge label={`${incoming.length}`} tone='accent' />}>
              Friend requests
            </SectionTitle>
            {incoming.map((e) => {
              const p = otherPerson(e, user?.id ?? '');
              return (
                <Card key={e.id} style={{ marginBottom: spacing.sm }}>
                  <Row style={{ gap: spacing.md }}>
                    <Avatar name={displayNameOf(p)} size={38} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{displayNameOf(p)}</Text>
                      <Text style={styles.handle}>@{p?.username}</Text>
                    </View>
                  </Row>
                  <Row style={{ gap: spacing.sm, marginTop: spacing.md }}>
                    <Button
                      title="Accept"
                      small
                      style={{ flex: 1 }}
                      loading={busyId === e.id}
                      onPress={() => respond(e, true)}
                    />
                    <Button
                      title="Decline"
                      variant="secondary"
                      small
                      style={{ flex: 1 }}
                      onPress={() => respond(e, false)}
                    />
                  </Row>
                </Card>
              );
            })}
          </>
        ) : null}

        {outgoing.length > 0 ? (
          <>
            <SectionTitle>Sent</SectionTitle>
            {outgoing.map((e) => {
              const p = otherPerson(e, user?.id ?? '');
              return (
                <Card key={e.id} style={{ marginBottom: spacing.sm }}>
                  <Row style={{ gap: spacing.md }}>
                    <Avatar name={displayNameOf(p)} size={34} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{displayNameOf(p)}</Text>
                      <Text style={styles.handle}>@{p?.username}</Text>
                    </View>
                    <Badge label="Pending" tone='neutral' />
                  </Row>
                </Card>
              );
            })}
          </>
        ) : null}

        <SectionTitle right={<Text style={styles.hint}>{friends.length}</Text>}>
          Your friends
        </SectionTitle>

        {friends.length === 0 ? (
          <EmptyState
                        title="No friends yet"
            subtitle="Search for a username above to send your first friend request."
          />
        ) : (
          friends.map((e) => {
            const p = otherPerson(e, user?.id ?? '');
            return (
              <Card key={e.id} style={{ marginBottom: spacing.sm }}>
                <Row style={{ gap: spacing.md }}>
                  <Pressable onPress={() => p && router.push(`/user/${p.id}`)}>
                    <Avatar name={displayNameOf(p)} size={38} />
                  </Pressable>
                  <Pressable style={{ flex: 1 }} onPress={() => p && router.push(`/user/${p.id}`)}>
                    <Text style={styles.name}>{displayNameOf(p)}</Text>
                    <Text style={styles.handle}>@{p?.username}</Text>
                  </Pressable>
                  <Pressable onPress={() => confirmRemove(e)} hitSlop={10}>
                    <Ionicons name="ellipsis-horizontal" size={20} color={colors.textFaint} />
                  </Pressable>
                </Row>
              </Card>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

function SearchAction({
  result,
  busy,
  onAdd,
}: {
  result: UserSearchResult;
  busy: boolean;
  onAdd: () => void;
}) {
  if (result.friend_status === 'accepted') return <Badge label="Friends" tone='accent' />;
  if (result.friend_status === 'pending') {
    return <Badge label={result.i_requested ? 'Sent' : 'Wants to add you'} tone='neutral' />;
  }
  return <Button title="Add" small loading={busy} onPress={onAdd} />;
}

const styles = StyleSheet.create({
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  handle: { color: colors.textFaint, fontSize: 12, marginTop: 1 },
  hint: { color: colors.textFaint, fontSize: 12, marginTop: spacing.sm },
});
