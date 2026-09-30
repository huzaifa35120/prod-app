import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../lib/theme';

/** App mark: a lime block with the initial. Flat, no gradient, no emoji. */
export function LogoMark({ size = 52 }: { size?: number }) {
  return (
    <View style={[styles.mark, { width: size, height: size, borderRadius: radius.md }]}>
      <Text style={[styles.glyph, { fontSize: size * 0.54 }]}>C</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  glyph: {
    fontFamily: fonts.display,
    color: colors.accentInk,
    letterSpacing: -2,
    marginTop: -2,
  },
});
