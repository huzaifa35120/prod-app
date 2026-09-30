import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
// Direct import: the package root pulls in every icon font family.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar, Card, Row } from './ui';
import { colors, gradients, radius, spacing, type } from '../lib/theme';
import { formatDuration } from '../lib/format';
import type { LeaderboardRow, Profile } from '../lib/types';
import { displayNameOf } from '../lib/types';

export interface PlayerStats {
  profile: Profile | null;
  row: LeaderboardRow | undefined;
  isMe: boolean;
}

/**
 * The scoreboard. Total focused time is what decides the challenge, so it is
 * the headline; days and tasks sit underneath as context.
 */
export function StatsPanel({
  me,
  them,
  finished,
}: {
  me: PlayerStats;
  them: PlayerStats;
  finished: boolean;
}) {
  const mySeconds = Number(me.row?.total_seconds ?? 0);
  const theirSeconds = Number(them.row?.total_seconds ?? 0);
  const total = mySeconds + theirSeconds;
  const myShare = total > 0 ? mySeconds / total : 0.5;

  const leader = mySeconds === theirSeconds ? null : mySeconds > theirSeconds ? me : them;
  const gap = Math.abs(mySeconds - theirSeconds);

  const anim = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: myShare,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [myShare, anim]);

  const width = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Card glowColor={finished && leader ? colors.amber : undefined}>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.xl }}>
        <Row style={{ gap: 6 }}>
          <Ionicons name="stopwatch-outline" size={14} color={colors.textFaint} />
          <Text style={type.eyebrow}>Focused time</Text>
        </Row>
        {finished ? (
          <Text style={styles.final}>FINAL</Text>
        ) : leader ? (
          <Text style={styles.lead}>
            {leader.isMe ? 'You lead' : `${displayNameOf(leader.profile)} leads`} by{' '}
            <Text style={{ color: leader.isMe ? colors.green : colors.rival }}>
              {formatDuration(gap)}
            </Text>
          </Text>
        ) : (
          <Text style={styles.lead}>Dead even</Text>
        )}
      </Row>

      {/* head to head */}
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <PlayerColumn player={me} seconds={mySeconds} tone="blue" isLeader={leader === me} />
        <View style={styles.vsWrap}>
          <Text style={styles.vs}>VS</Text>
        </View>
        <PlayerColumn
          player={them}
          seconds={theirSeconds}
          tone="rival"
          isLeader={leader === them}
          alignEnd
        />
      </Row>

      {/* split bar */}
      <View style={styles.bar}>
        <Animated.View style={{ width, height: '100%' }}>
          <LinearGradient
            colors={gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
        <View style={styles.barRest}>
          <LinearGradient
            colors={gradients.rival}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </View>
      </View>

      {finished ? (
        <LinearGradient
          colors={leader ? gradients.amber : [colors.surfaceMax, colors.surfaceMax]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.winner}
        >
          <Ionicons
            name={leader ? 'trophy' : 'hand-left'}
            size={16}
            color={leader ? '#3A2A00' : colors.textDim}
          />
          <Text style={[styles.winnerText, !leader && { color: colors.textDim }]}>
            {leader
              ? `${leader.isMe ? 'You win' : `${displayNameOf(leader.profile)} wins`} — ${formatDuration(
                  Number(leader.row?.total_seconds ?? 0)
                )} logged`
              : 'It ends in a dead heat'}
          </Text>
        </LinearGradient>
      ) : null}
    </Card>
  );
}

function PlayerColumn({
  player,
  seconds,
  tone,
  isLeader,
  alignEnd,
}: {
  player: PlayerStats;
  seconds: number;
  tone: 'blue' | 'rival';
  isLeader: boolean;
  alignEnd?: boolean;
}) {
  const name = player.profile ? displayNameOf(player.profile) : 'Open slot';
  const tint = tone === 'rival' ? colors.rival : colors.primary;
  const days = player.row?.days_complete ?? 0;

  return (
    <View style={[styles.col, alignEnd && { alignItems: 'flex-end' }]}>
      <View>
        <Avatar name={name} size={46} tone={tone} />
        {isLeader ? (
          <View style={[styles.crown, alignEnd ? { right: -4 } : { left: -4 }]}>
            <Ionicons name="trophy" size={10} color="#3A2A00" />
          </View>
        ) : null}
      </View>

      <Text style={[styles.name, alignEnd && { textAlign: 'right' }]} numberOfLines={1}>
        {player.isMe ? 'You' : name}
      </Text>

      <Text style={[type.numeral, { color: tint, fontSize: 24 }]}>{formatDuration(seconds)}</Text>

      <Text style={[styles.meta, alignEnd && { textAlign: 'right' }]}>
        {days} {days === 1 ? 'day' : 'days'} · {player.row?.tasks_done ?? 0}/
        {player.row?.tasks_total ?? 0} tasks
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  final: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.amber,
  },
  lead: { fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.textFaint },

  col: { flex: 1, gap: 7 },
  vsWrap: { paddingHorizontal: spacing.sm, paddingTop: 14 },
  vs: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    color: colors.textFaint,
    letterSpacing: 1,
  },
  crown: {
    position: 'absolute',
    top: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  name: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.text },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textFaint, lineHeight: 15 },

  bar: {
    flexDirection: 'row',
    height: 9,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginTop: spacing.xl,
    backgroundColor: colors.surfaceMax,
  },
  barRest: { flex: 1 },

  winner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  winnerText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#3A2A00', flexShrink: 1 },
});
