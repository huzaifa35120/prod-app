import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
// Direct import: the package root pulls in every icon font family.
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, radius, spacing } from '../lib/theme';
import { formatDate, toDateKey } from '../lib/format';

/**
 * Native date picker. iOS shows the compact inline control; Android opens the
 * system dialog from a button. See DateField.web.tsx for the browser version.
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
  const [open, setOpen] = useState(Platform.OS === 'ios');

  return (
    <View>
      {Platform.OS === 'android' ? (
        <Pressable style={styles.button} onPress={() => setOpen(true)}>
          <Ionicons name="calendar-outline" size={18} color={colors.accent} />
          <Text style={styles.buttonText}>{formatDate(toDateKey(value))}</Text>
        </Pressable>
      ) : null}

      {open ? (
        <View style={Platform.OS === 'ios' ? styles.iosWrap : undefined}>
          <DateTimePicker
            value={value}
            mode="date"
            display={Platform.OS === 'ios' ? 'compact' : 'default'}
            themeVariant="dark"
            minimumDate={minimumDate}
            onChange={(_event, selected) => {
              if (Platform.OS === 'android') setOpen(false);
              if (selected) onChange(selected);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.line,
    paddingVertical: spacing.md,
  },
  buttonText: { color: colors.text, fontSize: 17, fontFamily: fonts.bodyMd },
  iosWrap: { alignSelf: 'flex-start' },
});
