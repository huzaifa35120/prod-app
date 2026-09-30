import React, { useRef } from 'react';
import {
  ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, TextInput,
  TextInputProps, TextStyle, View, ViewStyle, type RefreshControlProps,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, fonts, GUTTER, radius, spacing, type } from '../lib/theme';
import { initialsOf } from '../lib/format';

/* ================================================================== */
/*  Layout                                                             */
/* ================================================================== */

export function Screen({
  children,
  scroll = false,
  edges = ['top'],
  contentStyle,
  refreshControl,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: ViewStyle;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollBody, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Spacer({ h }: { h: number }) {
  return <View style={{ height: h }} />;
}

/** The main structural device — used instead of wrapping things in cards. */
export function Rule({ style, bright }: { style?: ViewStyle; bright?: boolean }) {
  return <View style={[styles.rule, bright && { backgroundColor: colors.textFaint }, style]} />;
}

/* ================================================================== */
/*  Text                                                               */
/* ================================================================== */

export function Hero({ children }: { children: React.ReactNode }) {
  return <Text style={type.hero}>{children}</Text>;
}
export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={type.h1}>{children}</Text>;
}
export function H2({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[type.h2, style]}>{children}</Text>;
}
export function H3({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[type.h3, style]}>{children}</Text>;
}

export function Body({
  children, muted, center, size, style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  center?: boolean;
  size?: number;
  style?: TextStyle;
}) {
  return (
    <Text
      style={[
        type.body,
        muted && { color: colors.textDim },
        center && { textAlign: 'center' },
        size ? { fontSize: size, lineHeight: Math.round(size * 1.45) } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Caption({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[type.caption, style]}>{children}</Text>;
}

/**
 * Section marker: a wide-tracked label with a hairline running to the edge.
 * This replaces the old "everything is a titled card" pattern.
 */
export function SectionTitle({
  children,
  right,
  style,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.section, style]}>
      <Text style={type.eyebrow}>{children}</Text>
      <View style={styles.sectionRule} />
      {right}
    </View>
  );
}

/* ================================================================== */
/*  Surfaces                                                           */
/* ================================================================== */

function usePressScale(to = 0.985) {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  return { scale, onPressIn: () => spring(to), onPressOut: () => spring(1) };
}

/**
 * A panel. Deliberately plain — flat fill, hairline border, small radius.
 * Prefer plain Views and Rules where a box is not actually needed.
 */
export function Card({
  children, style, onPress, accent,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  /** Left edge bar, for the one item that matters on a screen. */
  accent?: string;
}) {
  const press = usePressScale();
  const inner = (
    <View style={[styles.card, accent ? { borderLeftWidth: 3, borderLeftColor: accent } : null, style]}>
      {children}
    </View>
  );

  if (!onPress) return inner;
  return (
    <Animated.View style={{ transform: [{ scale: press.scale }] }}>
      <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut}>
        {inner}
      </Pressable>
    </Animated.View>
  );
}

/* ================================================================== */
/*  Button                                                             */
/* ================================================================== */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title, onPress, variant = 'primary', loading, disabled, style, small, icon,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  small?: boolean;
  icon?: React.ReactNode;
}) {
  const press = usePressScale(0.97);
  const isDisabled = disabled || loading;

  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: colors.accent, fg: colors.accentInk, border: colors.accent },
    secondary: { bg: 'transparent', fg: colors.text, border: colors.line },
    ghost: { bg: 'transparent', fg: colors.textDim, border: 'transparent' },
    danger: { bg: 'transparent', fg: colors.danger, border: colors.danger },
  };
  const p = palette[variant];

  return (
    <Animated.View
      style={[
        { transform: [{ scale: press.scale }] },
        isDisabled && { opacity: 0.35 },
        style?.flex ? { flex: style.flex } : null,
      ]}
    >
      <Pressable
        onPress={isDisabled ? undefined : onPress}
        onPressIn={isDisabled ? undefined : press.onPressIn}
        onPressOut={isDisabled ? undefined : press.onPressOut}
        style={[
          styles.button,
          small && styles.buttonSmall,
          { backgroundColor: p.bg, borderColor: p.border },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={p.fg} size="small" />
        ) : (
          <>
            {icon}
            <Text style={[type.button, { color: p.fg }, small && { fontSize: 12.5 }]} numberOfLines={1}>
              {title}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

/* ================================================================== */
/*  Inputs                                                             */
/* ================================================================== */

export function Field({
  label, hint, error, ...props
}: TextInputProps & { label?: string; hint?: string; error?: string }) {
  const [focused, setFocused] = React.useState(false);

  return (
    <View style={{ marginBottom: spacing.xl }}>
      {label ? <Text style={[type.eyebrow, { marginBottom: spacing.sm }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        {...props}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
        style={[
          styles.input,
          focused && { borderBottomColor: colors.accent },
          error ? { borderBottomColor: colors.danger } : null,
          props.multiline && { height: 92, textAlignVertical: 'top', paddingTop: spacing.md },
          props.style,
        ]}
      />
      {error ? (
        <Text style={[type.caption, { color: colors.danger, marginTop: spacing.sm }]}>{error}</Text>
      ) : hint ? (
        <Text style={[type.caption, { marginTop: spacing.sm }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

/* ================================================================== */
/*  Bits                                                               */
/* ================================================================== */

export type Tone = 'neutral' | 'accent' | 'rival' | 'danger' | 'muted';

const TONES: Record<Tone, string> = {
  neutral: colors.textDim,
  accent: colors.accent,
  rival: colors.rival,
  danger: colors.danger,
  muted: colors.textFaint,
};

/** A tag, not a pill — square edges, hairline border, uppercase. */
export function Badge({ label, tone = 'neutral', solid }: { label: string; tone?: Tone; solid?: boolean }) {
  const c = TONES[tone];
  return (
    <View
      style={[
        styles.badge,
        solid ? { backgroundColor: c, borderColor: c } : { borderColor: c },
      ]}
    >
      <Text style={[styles.badgeText, { color: solid ? colors.accentInk : c }]}>{label}</Text>
    </View>
  );
}

export function Avatar({
  name, size = 36, tone = 'accent',
}: {
  name: string;
  size?: number;
  tone?: 'accent' | 'rival' | 'plain';
}) {
  const c = tone === 'rival' ? colors.rival : tone === 'plain' ? colors.textDim : colors.accent;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: c,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: c,
          fontFamily: fonts.display,
          fontSize: size * 0.38,
          letterSpacing: -0.3,
        }}
      >
        {initialsOf(name)}
      </Text>
    </View>
  );
}

/** Flat meter. `value` is 0–1. */
export function ProgressBar({
  value, tint = colors.accent, height = 3, track = colors.line,
}: {
  value: number;
  tint?: string;
  height?: number;
  track?: string;
}) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View style={{ height, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: tint }} />
    </View>
  );
}

/** A number with a label under it. No box — just type. */
export function Stat({
  label, value, tint, align = 'left',
}: {
  label: string;
  value: string;
  tint?: string;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <View style={{ flex: 1, alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start' }}>
      <Text
        style={[type.statMd, tint ? { color: tint } : null]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}
      >
        {value}
      </Text>
      <Text style={[type.eyebrow, { marginTop: 3 }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  title, subtitle, action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyBar} />
      <Text style={[type.h2, { marginBottom: spacing.sm }]}>{title}</Text>
      {subtitle ? (
        <Text style={[type.bodySm, { maxWidth: 320 }]}>{subtitle}</Text>
      ) : null}
      {action ? <View style={{ marginTop: spacing.xl, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.accent} />
      {label ? <Text style={[type.caption, { marginTop: spacing.lg }]}>{label}</Text> : null}
    </View>
  );
}

/* ================================================================== */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scrollBody: { padding: GUTTER, paddingBottom: spacing.xxxl * 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rule: { height: 1, backgroundColor: colors.line },

  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
  sectionRule: { flex: 1, height: 1, backgroundColor: colors.line },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },

  button: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 15,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonSmall: {
    paddingVertical: 8,
    paddingHorizontal: spacing.lg,
    minHeight: 34,
    borderRadius: radius.sm,
  },

  // Underline, not a box — lighter and less "form-like".
  input: {
    borderBottomWidth: 1.5,
    borderBottomColor: colors.line,
    paddingVertical: spacing.md,
    paddingHorizontal: 0,
    color: colors.text,
    fontSize: 17,
    fontFamily: fonts.bodyMd,
  },

  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontFamily: fonts.bodySemi,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  empty: { paddingVertical: spacing.xxxl },
  emptyBar: {
    width: 32,
    height: 3,
    backgroundColor: colors.accent,
    marginBottom: spacing.xl,
  },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
