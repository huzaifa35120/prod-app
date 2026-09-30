import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Row } from './ui';
import { colors, fonts, spacing, type } from '../lib/theme';
import { formatDuration } from '../lib/format';
import type { LeaderboardRow, Profile } from '../lib/types';
import { displayNameOf } from '../lib/types';

export interface PlayerStats {
  profile: Profile | null;
  row: LeaderboardRow | undefined;
  isMe: boolean;
}

/**
 * The scoreboard. Two columns of numbers with a single split bar under them —
 * a result, not a dashboard widget. Total focused time decides the challenge,
 * so it is the only thing set large.
 */
export function StatsPanel({
  me, them, finished,
}: {
  me: PlayerStats;
  them: PlayerStats;
  finished: boolean;
}) {
  const mine = Number(me.row?.total_seconds ?? 0);
  const theirs = Number(them.row?.total_seconds ?? 0);
  const total = mine + theirs;
  const share = total > 0 ? mine / total : 0.5;

  const leader = mine === theirs ? null : mine > theirs ? me : them;
  const gap = Math.abs(mine - theirs);

  const anim = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: share, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [share, anim]);

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const rivalName = them.profile ? displayNameOf(them.profile) : 'Open slot';

  return (
    <View>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.who}>You</Text>
          <Text style={[type.statLg, { color: colors.accent }]} numberOfLines={1} adjustsFontSizeToFit>
            {formatDuration(mine)}
          </Text>
          <Text style={styles.sub}>
            {me.row?.days_complete ?? 0}d · {me.row?.tasks_done ?? 0}/{me.row?.tasks_total ?? 0}
          </Text>
        </View>

        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={[styles.who, { textAlign: 'right' }]} numberOfLines={1}>
            {rivalName}
          </Text>
          <Text
            style={[type.statLg, { color: colors.rival, textAlign: 'right' }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatDuration(theirs)}
          </Text>
          <Text style={[styles.sub, { textAlign: 'right' }]}>
            {them.row?.days_complete ?? 0}d · {them.row?.tasks_done ?? 0}/{them.row?.tasks_total ?? 0}
          </Text>
        </View>
      </Row>

      {/* split bar */}
      <View style={styles.bar}>
        <Animated.View style={{ width, height: '100%', backgroundColor: colors.accent }} />
        <View style={{ flex: 1, backgroundColor: colors.rival }} />
      </View>

      <Text style={styles.verdict}>
        {finished ? (
          leader ? (
            <>
              <Text style={{ color: leader.isMe ? colors.accent : colors.rival }}>
                {leader.isMe ? 'You win' : `${displayNameOf(leader.profile)} wins`}
              </Text>
              {`  ·  final`}
            </>
          ) : (
            'Dead heat  ·  final'
          )
        ) : leader ? (
          <>
            <Text style={{ color: leader.isMe ? colors.accent : colors.rival }}>
              {leader.isMe ? 'You lead' : `${displayNameOf(leader.profile)} leads`}
            </Text>
            {`  ·  by ${formatDuration(gap)}`}
          </>
        ) : (
          'Level'
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  who: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginBottom: 6,
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.textFaint,
    marginTop: 5,
    fontVariant: ['tabular-nums'],
  },
  bar: { flexDirection: 'row', height: 4, marginTop: spacing.lg },
  verdict: {
    fontFamily: fonts.bodyMd,
    fontSize: 12,
    color: colors.textFaint,
    marginTop: spacing.md,
    letterSpacing: 0.2,
  },
});
