import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Body, Button, Field, Hero, Screen } from '../../components/ui';
import { LogoMark } from '../../components/LogoMark';
import { useAuth } from '../../lib/auth';
import { errorMessage } from '../../lib/supabase';
import { colors, spacing, type } from '../../lib/theme';

export default function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      // The root navigator redirects once the session lands.
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.xl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LogoMark />
          <View style={{ height: spacing.xl }} />
          <Hero>Welcome back</Hero>
          <View style={{ height: spacing.sm }} />
          <Body muted>Pick up where you and your rival left off.</Body>

          <View style={{ height: spacing.xxl }} />

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
            onSubmitEditing={submit}
            returnKeyType="go"
            error={error ?? undefined}
          />

          <Button title="Sign in" onPress={submit} loading={busy} />

          <View style={{ height: spacing.xl }} />
          <Link href="/(auth)/sign-up" asChild>
            <Pressable>
              <Text style={[type.bodySm, { textAlign: 'center' }]}>
                No account yet?{' '}
                <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>
                  Sign up
                </Text>
              </Text>
            </Pressable>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
