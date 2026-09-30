import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, ProgressBar, Row, type Tone } from './ui';
import { colors, fonts, spacing, type } from '../lib/theme';
import { challengePhase, daysBetween, formatDateShort, formatDuration, todayKey } from '../lib/format';
import { displayNameOf, type ChallengeWithPeople } from '../lib/types';

export interface Standing {
  mySeconds: number;
  theirSeconds: number;
}

function statusOf(c: ChallengeWithPeople): { label: string; tone: Tone } {
  if (c.status === 'cancelled') return { label: 'Cancelled', tone: 'danger' };
  if (!c.opponent_id) return { label: 'Needs a rival', tone: 'neutral' };

  const phase = challengePhase(c.start_date, c.end_date);
  if (c.status === 'completed' || phase === 'finished') return { label: 'Final', tone: 'muted' };
  if (phase === 'upcoming') return { label: 'Soon', tone: 'neutral' };
  return { label: 'Live', tone: 'accent' };
}

/**
 * A row in the challenge list.
 *
 * Not a card — a full-bleed row divided by a hairline, with the day counter
 * set as the dominant number. The list should scan vertically like a fixture
 * list rather than a stack of panels.
 */
export function ChallengeCard({
  challenge, onPress, standing, footer,
}: {
  challenge: ChallengeWithPeople;
  onPress?: () => void;
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
  const live = phase !== 'upcoming' && Boolean(challenge.opponent_id);

  const lead =
    standing && standing.mySeconds !== standing.theirSeconds
      ? standing.mySeconds > standing.theirSeconds
        ? { text: 'You lead', tint: colors.accent, gap: standing.mySeconds - standing.theirSeconds }
        : { text: `${opponent ?? 'Rival'} leads`, tint: colors.rival, gap: standing.theirSeconds - standing.mySeconds }
      : null;

  const body = (
    <View style={styles.row}>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <Badge label={status.label} tone={status.tone} solid={status.tone === 'accent'} />
        <Text style={styles.meta}>
          {live ? `DAY ${elapsed} / ${challenge.day_count}` : `${challenge.day_count} DAYS`}
        </Text>
      </Row>

      <Text style={[type.h2, { marginBottom: 3 }]} numberOfLines={1}>
        {challenge.title}
      </Text>

      <Text style={styles.players} numberOfLines={1}>
        {creator}
        <Text style={{ color: colors.textFaint }}>  vs  </Text>
        {opponent ?? <Text style={{ color: colors.textFaint }}>open slot</Text>}
      </Text>

      {live ? (
        <View style={{ marginTop: spacing.lg }}>
          <ProgressBar
            value={elapsed / challenge.day_count}
            tint={phase === 'finished' ? colors.textFaint : colors.accent}
            height={2}
          />
          {lead ? (
            <Text style={[styles.lead, { color: lead.tint }]}>
              {lead.text} · {formatDuration(lead.gap)}
            </Text>
          ) : standing ? (
            <Text style={styles.lead}>Level</Text>
          ) : null}
        </View>
      ) : (
        <Text style={[styles.meta, { marginTop: spacing.md }]}>
          {formatDateShort(challenge.start_date)} — {formatDateShort(challenge.end_date)}
        </Text>
      )}

      {footer ? <View style={{ marginTop: spacing.lg }}>{footer}</View> : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.lg + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  meta: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.textFaint,
    fontVariant: ['tabular-nums'],
  },
  players: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim },
  lead: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    color: colors.textFaint,
    marginTop: spacing.sm,
    letterSpacing: 0.2,
  },
});
