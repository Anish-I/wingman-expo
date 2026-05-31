import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
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

const tabIndicatorWidth = 32;

export function WingmanTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors } = useWingman();

  const [layoutWidth, setLayoutWidth] = React.useState(0);
  const itemCount = state.routes.length;
  const itemWidth = itemCount > 0 ? layoutWidth / itemCount : 0;
  const indicatorPosition = useSharedValue(state.index);

  React.useEffect(() => {
    indicatorPosition.value = withSpring(state.index, {
      damping: 18,
      stiffness: 220,
      mass: 0.6,
    });
  }, [state.index, indicatorPosition]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          indicatorPosition.value * itemWidth + (itemWidth - tabIndicatorWidth) / 2,
      },
    ],
  }));

  return (
    <View
      onLayout={(event) => setLayoutWidth(event.nativeEvent.layout.width)}
      style={{
        backgroundColor: colors.card,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 10,
        paddingBottom: Math.max(insets.bottom, 12),
        flexDirection: 'row',
      }}>
      {itemWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 0,
              top: 6,
              width: tabIndicatorWidth,
              height: 4,
              borderRadius: 999,
              backgroundColor: colors.sky500,
            },
            indicatorStyle,
          ]}
        />
      ) : null}
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
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              paddingTop: 10,
              opacity: pressed ? 0.6 : 1,
            })}>
            <Ionicons
              name={config.icon}
              color={focused ? colors.sky500 : colors.fgMuted}
              size={22}
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
