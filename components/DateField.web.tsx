import React from 'react';
import { View } from 'react-native';
import { colors, spacing } from '../lib/theme';
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
          backgroundColor: colors.surfaceHi,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          padding: `${spacing.md + 2}px ${spacing.lg}px`,
          color: colors.text,
          fontSize: 16,
          colorScheme: 'dark',
          width: '100%',
          boxSizing: 'border-box',
        },
      })}
    </View>
  );
}
