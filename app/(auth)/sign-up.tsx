import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Body, Button, Field, Hero, Screen } from '../../components/ui';
import { LogoMark } from '../../components/LogoMark';
import { useAuth } from '../../lib/auth';
import { errorMessage } from '../../lib/supabase';
import { colors, spacing, type } from '../../lib/theme';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export default function SignUp() {
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit() {
    const handle = username.trim().toLowerCase();
    if (!USERNAME_RE.test(handle)) {
      setError('Username must be 3–20 characters: lowercase letters, numbers or underscore.');
      return;
    }
    if (!email.trim()) {
      setError('Enter your email.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const signedIn = await signUp(email, password, handle, displayName || handle);
      if (!signedIn) {
        setNotice(
          'Account created. Check your inbox to confirm your email address, then sign in.'
        );
      }
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
        >
          <LogoMark />
          <View style={{ height: spacing.xl }} />
          <Hero>Create account</Hero>
          <View style={{ height: spacing.sm }} />
          <Body muted>Then add a friend and put something on the line.</Body>

          <View style={{ height: spacing.xxl }} />

          <Field
            label="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Alex Carter"
            autoCapitalize="words"
          />
          <Field
            label="Username"
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="alexc"
            autoCapitalize="none"
            autoCorrect={false}
            hint="How friends will find you. Lowercase letters, numbers and underscores."
          />
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
            placeholder="At least 6 characters"
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
          />

          {error ? (
            <Text style={[type.bodySm, { color: colors.red, marginBottom: spacing.lg }]}>{error}</Text>
          ) : null}
          {notice ? (
            <Text style={[type.bodySm, { color: colors.green, marginBottom: spacing.lg }]}>{notice}</Text>
          ) : null}

          <Button title="Create account" onPress={submit} loading={busy} />

          <View style={{ height: spacing.xl }} />
          <Link href="/(auth)/sign-in" asChild>
            <Pressable>
              <Text style={[type.bodySm, { textAlign: 'center' }]}>
                Already have an account?{' '}
                <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>
                  Sign in
                </Text>
              </Text>
            </Pressable>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
