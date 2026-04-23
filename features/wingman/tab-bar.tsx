import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWingman } from '@/features/wingman/provider';
import { wingmanFonts } from '@/features/wingman/theme';

const tabConfig = {
  index: { label: 'Home', icon: 'home-outline' },
  chat: { label: 'Chat', icon: 'chatbubble-ellipses-outline' },
  flows: { label: 'Flows', icon: 'flash-outline' },
  activity: { label: 'Activity', icon: 'time-outline' },
  settings: { label: 'Settings', icon: 'settings-outline' },
} as const;

export function WingmanTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors } = useWingman();

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 14),
        flexDirection: 'row',
        justifyContent: 'space-around',
      }}>
      {state.routes.map((route: any, index: number) => {
        const focused = state.index === index;
        const config = tabConfig[route.name as keyof typeof tabConfig];
        const { options } = descriptors[route.key];

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarButtonTestID}
            onPress={onPress}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              paddingTop: 6,
            }}>
            <View
              style={{
                width: 24,
                height: 3,
                borderRadius: 999,
                backgroundColor: focused ? colors.sky500 : 'transparent',
                marginBottom: 4,
              }}
            />
            <Ionicons
              name={config.icon}
              color={focused ? colors.sky500 : colors.fgMuted}
              size={20}
            />
            <Text
              style={{
                color: focused ? colors.sky500 : colors.fgMuted,
                fontFamily: wingmanFonts.text,
                fontSize: 10,
                fontWeight: '800',
                letterSpacing: 0.3,
              }}>
              {config.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
