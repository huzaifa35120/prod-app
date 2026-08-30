import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
  type RefreshControlProps,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, elevation, glow, gradients, radius, spacing, type } from '../lib/theme';
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

export function Divider({ style }: { style?: ViewStyle }) {
  return <View style={[styles.divider, style]} />;
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
  children,
  muted,
  center,
  size,
  style,
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

export function SectionTitle({
  children,
  right,
  tight,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
  tight?: boolean;
}) {
  return (
    <View style={[styles.sectionTitle, tight && { marginTop: spacing.lg }]}>
      <Text style={type.eyebrow}>{children}</Text>
      {right}
    </View>
  );
}

/* ================================================================== */
/*  Surfaces                                                           */
/* ================================================================== */

/** Scales down slightly while held. Used by Card and Button. */
function usePressScale(to = 0.97) {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  return {
    scale,
    onPressIn: () => spring(to),
    onPressOut: () => spring(1),
  };
}

export function Card({
  children,
  style,
  onPress,
  glowColor,
  flat,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  /** Casts a coloured halo — use sparingly, for the one thing that matters. */
  glowColor?: string;
  /** Drops the shadow and gradient, for nested/secondary surfaces. */
  flat?: boolean;
}) {
  const press = usePressScale();

  const inner = (
    <LinearGradient
      colors={flat ? [colors.surfaceHi, colors.surfaceHi] : gradients.surface}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, style]}
    >
      {children}
    </LinearGradient>
  );

  if (!onPress) {
    return (
      <View style={[!flat && elevation.card, glowColor ? glow(glowColor, 0.22) : null]}>{inner}</View>
    );
  }

  return (
    <Animated.View
      style={[
        { transform: [{ scale: press.scale }] },
        !flat && elevation.card,
        glowColor ? glow(glowColor, 0.22) : null,
      ]}
    >
      <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut}>
        {inner}
      </Pressable>
    </Animated.View>
  );
}

/* ================================================================== */
/*  Button                                                             */
/* ================================================================== */

type ButtonVariant = 'primary' | 'success' | 'secondary' | 'ghost' | 'danger';

const BUTTON_GRADIENTS: Record<ButtonVariant, readonly [string, string] | null> = {
  primary: gradients.primary,
  success: gradients.green,
  danger: null,
  secondary: null,
  ghost: null,
};

const BUTTON_INK: Record<ButtonVariant, string> = {
  primary: colors.primaryInk,
  success: colors.greenInk,
  secondary: colors.text,
  ghost: colors.textDim,
  danger: colors.red,
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
  small,
  icon,
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
  const press = usePressScale(0.96);
  const isDisabled = disabled || loading;
  const gradient = BUTTON_GRADIENTS[variant];
  const ink = BUTTON_INK[variant];

  const content = (
    <>
      {loading ? (
        <ActivityIndicator color={ink} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[type.button, { color: ink }, small && { fontSize: 13.5 }]} numberOfLines={1}>
            {title}
          </Text>
        </>
      )}
    </>
  );

  const shell: ViewStyle[] = [styles.button, small ? styles.buttonSmall : null, style].filter(
    Boolean
  ) as ViewStyle[];

  return (
    <Animated.View
      style={[
        { transform: [{ scale: press.scale }] },
        isDisabled && { opacity: 0.4 },
        !isDisabled && gradient ? glow(gradient[1], 0.32) : null,
        style?.flex ? { flex: style.flex } : null,
      ]}
    >
      <Pressable
        onPress={isDisabled ? undefined : onPress}
        onPressIn={isDisabled ? undefined : press.onPressIn}
        onPressOut={isDisabled ? undefined : press.onPressOut}
      >
        {gradient ? (
          <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={shell}>
            {content}
          </LinearGradient>
        ) : (
          <View
            style={[
              ...shell,
              variant === 'secondary' && styles.buttonSecondary,
              variant === 'danger' && styles.buttonDanger,
            ]}
          >
            {content}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

/* ================================================================== */
/*  Inputs                                                             */
/* ================================================================== */

export function Field({
  label,
  hint,
  error,
  ...props
}: TextInputProps & { label?: string; hint?: string; error?: string }) {
  const [focused, setFocused] = React.useState(false);

  return (
    <View style={{ marginBottom: spacing.lg }}>
      {label ? <Text style={[type.eyebrow, { marginBottom: spacing.sm }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[
          styles.input,
          focused && styles.inputFocused,
          error ? { borderColor: colors.redEdge } : null,
          props.multiline && { height: 104, paddingTop: spacing.md + 2, textAlignVertical: 'top' },
          props.style,
        ]}
      />
      {error ? (
        <Text style={[type.caption, { color: colors.red, marginTop: spacing.sm }]}>{error}</Text>
      ) : hint ? (
        <Text style={[type.caption, { marginTop: spacing.sm }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

/* ================================================================== */
/*  Bits                                                               */
/* ================================================================== */

export type Tone = 'neutral' | 'green' | 'blue' | 'amber' | 'red' | 'rival';

const TONES: Record<Tone, { bg: string; fg: string; edge: string }> = {
  neutral: { bg: colors.surfaceMax, fg: colors.textDim, edge: colors.borderHi },
  green: { bg: colors.greenDim, fg: colors.green, edge: colors.greenEdge },
  blue: { bg: colors.primaryDim, fg: colors.primary, edge: colors.primaryEdge },
  amber: { bg: colors.amberDim, fg: colors.amber, edge: colors.amberEdge },
  red: { bg: colors.redDim, fg: colors.red, edge: colors.redEdge },
  rival: { bg: colors.rivalDim, fg: colors.rival, edge: colors.rivalEdge },
};

export function Badge({
  label,
  tone = 'neutral',
  dot,
}: {
  label: string;
  tone?: Tone;
  dot?: boolean;
}) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg, borderColor: t.edge }]}>
      {dot ? <View style={[styles.badgeDot, { backgroundColor: t.fg }]} /> : null}
      <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function Avatar({
  name,
  size = 40,
  tone = 'blue',
}: {
  name: string;
  size?: number;
  tone?: 'blue' | 'rival';
}) {
  const palette = tone === 'rival' ? gradients.rival : gradients.primary;
  return (
    <LinearGradient
      colors={palette}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: size - 3,
          height: size - 3,
          borderRadius: (size - 3) / 2,
          backgroundColor: colors.bgSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: tone === 'rival' ? colors.rival : colors.primary,
            fontFamily: 'SpaceGrotesk_700Bold',
            fontSize: size * 0.36,
          }}
        >
          {initialsOf(name)}
        </Text>
      </View>
    </LinearGradient>
  );
}

/** Horizontal meter. `value` is 0–1. */
export function ProgressBar({
  value,
  tint = colors.primary,
  height = 6,
  track = colors.surfaceMax,
}: {
  value: number;
  tint?: string;
  height?: number;
  track?: string;
}) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View style={{ height, borderRadius: radius.pill, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: tint }} />
    </View>
  );
}

export function StatTile({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint?: string;
}) {
  // Values like "19h 39m" are far wider than "14", and three tiles across a
  // 320pt phone leaves little room — so step the size down as it grows.
  const size = value.length > 6 ? 15 : value.length > 4 ? 17 : 19;

  return (
    <View style={styles.statTile}>
      <Text
        style={[type.numeral, { fontSize: size }, tint ? { color: tint } : null]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Text style={{ fontSize: 32 }}>{icon}</Text>
      </View>
      <Text style={[type.h2, { marginBottom: spacing.sm }]}>{title}</Text>
      {subtitle ? (
        <Text style={[type.bodySm, { textAlign: 'center', maxWidth: 300 }]}>{subtitle}</Text>
      ) : null}
      {action ? <View style={{ marginTop: spacing.xl, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
      {label ? <Text style={[type.caption, { marginTop: spacing.lg }]}>{label}</Text> : null}
    </View>
  );
}

/* ================================================================== */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scrollBody: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },

  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.xxl,
  },

  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg + 2,
    overflow: 'hidden',
  },

  button: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 15,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonSmall: { paddingVertical: 9, paddingHorizontal: spacing.lg, minHeight: 38, borderRadius: radius.sm },
  buttonSecondary: {
    backgroundColor: colors.surfaceMax,
    borderWidth: 1,
    borderColor: colors.borderHi,
  },
  buttonDanger: { backgroundColor: colors.redDim, borderWidth: 1, borderColor: colors.redEdge },

  input: {
    backgroundColor: colors.surfaceHi,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 15,
    color: colors.text,
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  inputFocused: { borderColor: colors.primaryEdge, backgroundColor: colors.surfaceMax },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.2 },

  statTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: 5,
  },
  statLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
  },

  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
