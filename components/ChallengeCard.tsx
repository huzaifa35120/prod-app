import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
// Direct import: the package root pulls in every icon font family.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar, Badge, Card, ProgressBar, Row, type Tone } from './ui';
import { colors, spacing, type } from '../lib/theme';
import { challengePhase, daysBetween, formatDateShort, formatDuration, todayKey } from '../lib/format';
import { displayNameOf, type ChallengeWithPeople } from '../lib/types';

export interface Standing {
  mySeconds: number;
  theirSeconds: number;
}

function statusOf(c: ChallengeWithPeople): { label: string; tone: Tone } {
  if (c.status === 'cancelled') return { label: 'Cancelled', tone: 'red' };
  if (!c.opponent_id) return { label: 'Needs an opponent', tone: 'amber' };

  const phase = challengePhase(c.start_date, c.end_date);
  if (c.status === 'completed' || phase === 'finished') return { label: 'Finished', tone: 'rival' };
  if (phase === 'upcoming') return { label: 'Starts soon', tone: 'blue' };
  return { label: 'Live', tone: 'green' };
}

export function ChallengeCard({
  challenge,
  onPress,
  standing,
  footer,
}: {
  challenge: ChallengeWithPeople;
  onPress?: () => void;
  /** Head-to-head totals, when known — drives the "you lead" line. */
  standing?: Standing;
  footer?: React.ReactNode;
}) {
  const status = statusOf(challenge);
  const creator = displayNameOf(challenge.creator);
  const opponent = challenge.opponent ? displayNameOf(challenge.opponent) : null;

  const phase = challengePhase(challenge.start_date, challenge.end_date);
  const elapsed = Math.min(
    Math.max(daysBetween(challenge.start_date, todayKey()) + 1, 0),
    challenge.day_count
  );
  const showProgress = phase !== 'upcoming' && Boolean(challenge.opponent_id);

  const lead =
    standing && standing.mySeconds !== standing.theirSeconds
      ? standing.mySeconds > standing.theirSeconds
        ? { text: 'You lead', tint: colors.green, gap: standing.mySeconds - standing.theirSeconds }
        : {
            text: `${opponent === creator ? creator : opponent ?? 'Rival'} leads`,
            tint: colors.rival,
            gap: standing.theirSeconds - standing.mySeconds,
          }
      : null;

  return (
    <Card onPress={onPress} style={{ marginBottom: spacing.md }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Badge label={status.label} tone={status.tone} dot={status.tone === 'green'} />
        <Row style={{ gap: 5 }}>
          <Ionicons name="calendar-outline" size={12} color={colors.textFaint} />
          <Text style={type.caption}>{challenge.day_count} days</Text>
        </Row>
      </Row>

      <Text style={type.h2} numberOfLines={2}>
        {challenge.title}
      </Text>

      {challenge.description ? (
        <Text style={[type.bodySm, { marginTop: spacing.xs }]} numberOfLines={2}>
          {challenge.description}
        </Text>
      ) : null}

      <Row style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <Avatar name={creator} size={26} />
        <Text style={styles.player} numberOfLines={1}>
          {creator}
        </Text>
        <Text style={styles.vs}>vs</Text>
        {opponent ? (
          <>
            <Avatar name={opponent} size={26} tone="rival" />
            <Text style={styles.player} numberOfLines={1}>
              {opponent}
            </Text>
          </>
        ) : (
          <Text style={[styles.player, { color: colors.textFaint }]}>open slot</Text>
        )}
      </Row>

      {showProgress ? (
        <View style={{ marginTop: spacing.lg }}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 7 }}>
            <Text style={styles.progressLabel}>
              {phase === 'finished' ? 'Completed' : `Day ${elapsed} of ${challenge.day_count}`}
            </Text>
            {lead ? (
              <Text style={[styles.progressLabel, { color: lead.tint }]}>
                {lead.text} · {formatDuration(lead.gap)}
              </Text>
            ) : standing ? (
              <Text style={styles.progressLabel}>Dead even</Text>
            ) : null}
          </Row>
          <ProgressBar
            value={elapsed / challenge.day_count}
            tint={phase === 'finished' ? colors.rival : colors.primary}
            height={5}
          />
        </View>
      ) : (
        <Row style={{ marginTop: spacing.lg, gap: 5 }}>
          <Ionicons name="time-outline" size={12} color={colors.textFaint} />
          <Text style={type.caption}>
            {formatDateShort(challenge.start_date)} → {formatDateShort(challenge.end_date)}
          </Text>
        </Row>
      )}

      {footer ? <View style={{ marginTop: spacing.lg }}>{footer}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  player: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.text, flexShrink: 1 },
  vs: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 10,
    color: colors.textFaint,
    letterSpacing: 0.5,
  },
  progressLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.textDim },
});
