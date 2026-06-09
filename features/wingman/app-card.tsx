import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { AppIntegration } from '@/features/wingman/data';
import { useWingman } from '@/features/wingman/provider';
import { StickerCard } from '@/features/wingman/primitives';
import { withAlpha, wingmanFonts } from '@/features/wingman/theme';

export function AppCard({
  app,
  index,
  onConnect,
  width = '48.6%',
}: {
  app: AppIntegration;
  index: number;
  onConnect: (appId: string) => Promise<void>;
  width?: number | `${number}%`;
}) {
  const { colors, resolvedTheme } = useWingman();
  // Server omits `available` in mock mode and older payloads — treat as connectable.
  const available = app.available !== false;

  return (
    <Animated.View
      entering={FadeInDown.delay(35 + index * 28).duration(300)}
      style={{ width }}>
      <StickerCard
        backgroundColor={app.connected ? withAlpha(app.color, resolvedTheme === 'dark' ? 0.16 : 0.07) : colors.card}
        borderColor={app.connected ? withAlpha(app.color, 0.58) : colors.border}
        style={{
          minHeight: 92,
          padding: 10,
          justifyContent: 'space-between',
          gap: 6,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9 }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              borderWidth: 1.5,
              borderColor: withAlpha(app.color, app.connected ? 0.46 : 0.28),
              backgroundColor: withAlpha(app.color, app.connected ? 0.17 : 0.1),
              alignItems: 'center',
              justifyContent: 'center',
              borderCurve: 'continuous',
            }}>
            <Text style={{ fontSize: 17 }}>{app.emoji}</Text>
          </View>

          <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <Text
              numberOfLines={1}
              style={{
                color: colors.ink,
                fontFamily: wingmanFonts.display,
                fontSize: 15,
                fontWeight: '700',
                lineHeight: 18,
                letterSpacing: 0,
              }}>
              {app.name}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                color: colors.fgMuted,
                fontFamily: wingmanFonts.text,
                fontSize: 10,
                fontWeight: '800',
                letterSpacing: 0,
              }}>
              {app.category}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {app.connected ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  backgroundColor: colors.mint500,
                }}
              />
              <Text
                style={{
                  color: colors.mint500,
                  fontFamily: wingmanFonts.text,
                  fontSize: 10,
                  fontWeight: '900',
                  letterSpacing: 0,
                }}>
                Connected
              </Text>
            </View>
          ) : (
            <Text
              style={{
                color: colors.fgMuted,
                fontFamily: wingmanFonts.text,
                fontSize: 10,
                fontWeight: '800',
              }}>
              {available ? 'Available' : 'Coming soon'}
            </Text>
          )}

          {!app.connected ? (
            available ? (
              <Pressable
                onPress={() => {
                  void onConnect(app.id);
                }}
                style={({ pressed }) => ({
                  minHeight: 28,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: colors.sky500,
                  borderWidth: 1.5,
                  borderColor: colors.sky700,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.75 : 1,
                  borderCurve: 'continuous',
                })}>
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontFamily: wingmanFonts.text,
                    fontSize: 10,
                    fontWeight: '900',
                  }}>
                  Connect
                </Text>
              </Pressable>
            ) : (
              <View
                style={{
                  minHeight: 28,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: withAlpha(colors.fgMuted, 0.12),
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderCurve: 'continuous',
                }}>
                <Text
                  style={{
                    color: colors.fgMuted,
                    fontFamily: wingmanFonts.text,
                    fontSize: 10,
                    fontWeight: '900',
                  }}>
                  Soon
                </Text>
              </View>
            )
          ) : null}
        </View>
      </StickerCard>
    </Animated.View>
  );
}
