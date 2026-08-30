import React from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius } from '../../lib/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Room for the icon pill (28) + label (~15) + padding, ABOVE the system inset.
 * react-navigation only adds the inset for you when no explicit height is set,
 * and the default bar is too short for the pill — so we set the height and add
 * the inset ourselves.
 */
const BAR_CONTENT_HEIGHT = 62;

function TabIcon({
  name,
  color,
  focused,
}: {
  name: IconName;
  color: ColorValue;
  focused: boolean;
}) {
  return (
    <View style={[styles.icon, focused && styles.iconActive]}>
      <Ionicons name={name} size={21} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  // Android draws edge-to-edge by default from SDK 52, and iOS has the home
  // indicator, so the bar must reserve the bottom inset or the system gesture
  // area lands on top of the tabs.
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.bar,
          { height: BAR_CONTENT_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
        ],
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: { paddingTop: 6 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Challenges',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'flame' : 'flame-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'compass' : 'compass-outline'} color={color} focused={focused} />
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
    backgroundColor: colors.bgSoft,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: 4,
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10.5,
    letterSpacing: 0.2,
    marginTop: 2,
  },
  icon: {
    width: 46,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActive: { backgroundColor: colors.primaryDim },
});
