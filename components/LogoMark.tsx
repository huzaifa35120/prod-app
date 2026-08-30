import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius } from '../lib/theme';

/** App mark: a gradient tile with a flame, used on the auth screens. */
export function LogoMark({ size = 62 }: { size?: number }) {
  return (
    <LinearGradient
      colors={gradients.primary}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: size * 0.3, shadowColor: colors.primary },
      ]}
    >
      <Text style={{ fontSize: size * 0.46 }}>🔥</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
});
