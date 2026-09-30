import React from 'react';
import { View } from 'react-native';
import { colors, fonts, spacing } from '../lib/theme';
import { parseDateKey, toDateKey } from '../lib/format';

/**
 * Web build of DateField. @react-native-community/datetimepicker has no web
 * support, so this falls back to a native <input type="date">, which
 * react-native-web renders through React DOM.
 */
export function DateField({
  value,
  onChange,
  minimumDate,
}: {
  value: Date;
  onChange: (next: Date) => void;
  minimumDate?: Date;
}) {
  return (
    <View>
      {React.createElement('input', {
        type: 'date',
        value: toDateKey(value),
        min: minimumDate ? toDateKey(minimumDate) : undefined,
        onChange: (e: { target: { value: string } }) => {
          if (e.target.value) onChange(parseDateKey(e.target.value));
        },
        style: {
          background: 'transparent',
          border: 'none',
          borderBottom: `1.5px solid ${colors.line}`,
          borderRadius: 0,
          padding: `${spacing.md}px 0`,
          color: colors.text,
          fontSize: 17,
          fontFamily: fonts.bodyMd,
          colorScheme: 'dark',
          width: '100%',
          boxSizing: 'border-box',
        },
      })}
    </View>
  );
}
