import React, { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  Avatar, Body, Button, Card, Field, Loading, Row, Rule, Screen, SectionTitle, Stat,
} from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { listMyChallenges, updateProfile } from '../../lib/api';
import { supabase, errorMessage } from '../../lib/supabase';
import { formatDuration } from '../../lib/format';
import { colors, fonts, GUTTER, spacing, type } from '../../lib/theme';
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
        {/* identity, left-aligned like everything else */}
        <Row style={{ gap: spacing.lg, alignItems: 'center' }}>
          <Avatar name={displayNameOf(profile)} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={type.h1} numberOfLines={1}>
              {displayNameOf(profile)}
            </Text>
            <Text style={styles.handle}>@{profile.username}</Text>
          </View>
        </Row>

        {profile.bio ? (
          <Text style={styles.bio}>{profile.bio}</Text>
        ) : null}

        <Button
          title="Edit profile"
          variant="secondary"
          small
          style={{ marginTop: spacing.xl, alignSelf: 'flex-start' }}
          onPress={beginEdit}
        />

        {editing ? (
          <Card style={{ marginTop: spacing.xl }}>
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
              placeholder="Something short"
              multiline
            />
            <Row style={{ gap: spacing.md }}>
              <Button title="Save" style={{ flex: 1 }} loading={saving} onPress={save} />
              <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setEditing(false)} />
            </Row>
          </Card>
        ) : null}

        <SectionTitle>Lifetime</SectionTitle>
        {stats ? (
          <View>
            <Row style={{ paddingBottom: spacing.lg }}>
              <Stat label="Focused time" value={formatDuration(stats.totalSeconds)} tint={colors.accent} />
              <Stat label="Days done" value={String(stats.daysComplete)} />
            </Row>
            <Rule />
            <Row style={{ paddingTop: spacing.lg }}>
              <Stat label="Challenges" value={String(stats.played)} />
              <Stat label="Won" value={String(stats.won)} tint={stats.won > 0 ? colors.accent : undefined} />
            </Row>
          </View>
        ) : (
          <Body muted>Crunching numbers…</Body>
        )}

        <SectionTitle>Account</SectionTitle>
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
  handle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textFaint,
    marginTop: 3,
  },
  bio: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textDim,
    marginTop: spacing.lg,
  },
});
