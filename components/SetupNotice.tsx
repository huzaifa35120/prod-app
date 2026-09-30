import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Body, Card, H1, Screen } from './ui';
import { colors, radius, spacing } from '../lib/theme';

const STEPS = [
  'Create a free project at supabase.com/dashboard.',
  'Open the SQL Editor and run supabase/migrations/0001_init.sql from this repo.',
  'In Project Settings → API, copy the Project URL and the anon public key.',
  'Copy .env.example to .env and paste both values in.',
  'Restart the bundler with: npx expo start -c',
];

/** Shown instead of the app when .env has not been filled in yet. */
export default function SetupNotice() {
  return (
    <Screen scroll>
      <H1>Almost there</H1>
      <View style={{ height: spacing.sm }} />
      <Body muted>
        This app needs a Supabase project before it can run. It takes about three minutes.
      </Body>

      <Card style={{ marginTop: spacing.xl }}>
        {STEPS.map((step, i) => (
          <View key={step} style={[styles.step, i === STEPS.length - 1 && { marginBottom: 0 }]}>
            <View style={styles.num}>
              <Text style={styles.numText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </Card>

      <Card style={{ marginTop: spacing.lg, backgroundColor: colors.surfaceHi }}>
        <Text style={styles.code}>
          EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co{'\n'}
          EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
        </Text>
      </Card>

      <View style={{ height: spacing.lg }} />
      <Body muted size={13}>
        The full walkthrough, including the two settings you need to change for testing, is in
        README.md.
      </Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  num: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primaryDim,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: { color: colors.primary, fontWeight: '800', fontSize: 12 },
  stepText: { color: colors.text, fontSize: 14, lineHeight: 20, flex: 1 },
  code: {
    color: colors.green,
    fontFamily: 'Menlo',
    fontSize: 11,
    lineHeight: 18,
  },
});
