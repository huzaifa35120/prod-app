import React from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts } from '../../lib/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Room for the icon and label ABOVE the system inset. react-navigation only
 * adds the inset for you when no explicit height is set, so we add it back.
 */
const BAR_CONTENT_HEIGHT = 68;

function TabIcon({ name, color, focused }: { name: IconName; color: ColorValue; focused: boolean }) {
  return (
    <View style={styles.icon}>
      <Ionicons name={name} size={20} color={color} />
      {/* an underline, not a pill — matches the section rules elsewhere */}
      <View style={[styles.marker, focused && { backgroundColor: colors.accent }]} />
    </View>
  );
}

export default function TabsLayout() {
  // Android draws edge-to-edge from SDK 52 and iOS has the home indicator, so
  // the bar must reserve the bottom inset or the gesture area lands on it.
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.bar,
          { height: BAR_CONTENT_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
        ],
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: { paddingTop: 9 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'today' : 'today-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="challenges"
        options={{
          title: 'Challenges',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'flag' : 'flag-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'people' : 'people-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'person' : 'person-outline'} color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.bg,
    borderTopColor: colors.line,
    borderTopWidth: 1,
    paddingTop: 2,
  },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  icon: { alignItems: 'center', gap: 4 },
  marker: { width: 14, height: 2, backgroundColor: 'transparent' },
});
