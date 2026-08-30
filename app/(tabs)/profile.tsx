import React, { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  Avatar, Body, Button, Card, Field, H1, H2, Loading, Row, Screen, SectionTitle, StatTile,
} from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { listMyChallenges, updateProfile } from '../../lib/api';
import { supabase, errorMessage } from '../../lib/supabase';
import { formatDuration } from '../../lib/format';
import { colors, spacing } from '../../lib/theme';
import { displayNameOf, type LeaderboardRow } from '../../lib/types';

interface Stats {
  played: number;
  won: number;
  totalSeconds: number;
  daysComplete: number;
}

export default function ProfileTab() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const mine = await listMyChallenges(user.id);
      const ids = mine.map((c) => c.id);
      if (ids.length === 0) {
        setStats({ played: 0, won: 0, totalSeconds: 0, daysComplete: 0 });
        return;
      }

      const { data, error } = await supabase
        .from('challenge_leaderboard')
        .select('*')
        .in('challenge_id', ids);
      if (error) throw error;

      const rows = (data ?? []) as LeaderboardRow[];
      const byChallenge = new Map<string, LeaderboardRow[]>();
      for (const r of rows) {
        const list = byChallenge.get(r.challenge_id) ?? [];
        list.push(r);
        byChallenge.set(r.challenge_id, list);
      }

      let won = 0;
      let totalSeconds = 0;
      let daysComplete = 0;

      for (const c of mine) {
        const rowsFor = byChallenge.get(c.id) ?? [];
        const me = rowsFor.find((r) => r.user_id === user.id);
        const them = rowsFor.find((r) => r.user_id !== user.id);
        if (me) {
          totalSeconds += Number(me.total_seconds);
          daysComplete += me.days_complete;
        }
        // Only finished challenges with both players count toward wins.
        const finished = c.status === 'completed';
        if (finished && me && them && Number(me.total_seconds) > Number(them.total_seconds)) won += 1;
      }

      setStats({ played: mine.filter((c) => c.opponent_id).length, won, totalSeconds, daysComplete });
    } catch (e) {
      Alert.alert('Could not load stats', errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  function beginEdit() {
    setDisplayName(profile?.display_name ?? '');
    setBio(profile?.bio ?? '');
    setEditing(true);
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      await updateProfile(user.id, {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
      });
      await refreshProfile();
      setEditing(false);
    } catch (e) {
      Alert.alert('Could not save', errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return <Loading label="Loading profile…" />;

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
        <H1>Profile</H1>

        <Card style={{ marginTop: spacing.xl, alignItems: 'center' }}>
          <Avatar name={displayNameOf(profile)} size={72} />
          <View style={{ height: spacing.md }} />
          <H2>{displayNameOf(profile)}</H2>
          <Text style={styles.handle}>@{profile.username}</Text>
          {profile.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : (
            <Text style={[styles.bio, { color: colors.textFaint, fontStyle: 'italic' }]}>
              No bio yet
            </Text>
          )}
          <Button
            title="Edit profile"
            variant="secondary"
            small
            style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}
            onPress={beginEdit}
          />
        </Card>

        {editing ? (
          <Card style={{ marginTop: spacing.md }}>
            <Field
              label="Display name"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
            />
            <Field
              label="Bio"
              value={bio}
              onChangeText={setBio}
              placeholder="Something short about you"
              multiline
            />
            <Row style={{ gap: spacing.sm }}>
              <Button title="Save" style={{ flex: 1 }} loading={saving} onPress={save} />
              <Button
                title="Cancel"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => setEditing(false)}
              />
            </Row>
          </Card>
        ) : null}

        <SectionTitle>Lifetime stats</SectionTitle>
        {stats ? (
          <View style={{ gap: spacing.sm }}>
            <Row style={{ gap: spacing.sm }}>
              <StatTile label="Focused time" value={formatDuration(stats.totalSeconds)} tint={colors.primary} />
              <StatTile label="Days done" value={String(stats.daysComplete)} tint={colors.green} />
            </Row>
            <Row style={{ gap: spacing.sm }}>
              <StatTile label="Challenges" value={String(stats.played)} />
              <StatTile label="Won" value={String(stats.won)} tint={colors.amber} />
            </Row>
          </View>
        ) : (
          <Body muted>Crunching numbers…</Body>
        )}

        <View style={{ height: spacing.xxl }} />
        <Button
          title="Sign out"
          variant="danger"
          onPress={() =>
            Alert.alert('Sign out', 'Sign out of this account?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
            ])
          }
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  handle: { color: colors.textFaint, fontSize: 13, marginTop: 2 },
  bio: { color: colors.textDim, fontSize: 14, textAlign: 'center', marginTop: spacing.md, lineHeight: 20 },
});
