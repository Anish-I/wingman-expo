import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useWingman } from '@/features/wingman/provider';
import { PipCircle, ScreenHeader, StickerCard } from '@/features/wingman/primitives';
import { wingmanFonts, wingmanLayout } from '@/features/wingman/theme';

export function ActivityScreen() {
  const { colors, events } = useWingman();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingBottom: 88,
      }}>
      <ScreenHeader
        title="Activity"
        subtitle="Everything Pip's been up to"
      />
      <View
        style={{
          paddingHorizontal: wingmanLayout.screenPadding,
          paddingTop: 4,
        }}>
        <View
          style={{
            position: 'absolute',
            left: 36,
            top: 14,
            bottom: 0,
            width: 2,
            backgroundColor: colors.borderStrong,
          }}
        />
        <View style={{ gap: 12 }}>
          {events.map((event) => (
            <View
              key={event.id}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 14,
              }}>
              <View style={{ zIndex: 2, marginTop: 2 }}>
                <PipCircle variant={event.pip} size={38} ring />
              </View>
              <StickerCard
                style={{
                  flex: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 16,
                }}>
                <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}>
                  <Text
                    style={{
                      color: colors.ink,
                      fontFamily: wingmanFonts.display,
                      fontSize: 15,
                      fontWeight: '700',
                      flex: 1,
                    }}>
                    {event.title}
                  </Text>
                  <Text
                    style={{
                      color: colors.fgMuted,
                      fontFamily: wingmanFonts.text,
                      fontSize: 10,
                      fontWeight: '800',
                      letterSpacing: 0.3,
                    }}>
                    {event.when}
                  </Text>
                </View>
                <Text
                  style={{
                    color: colors.fgSecondary,
                    fontFamily: wingmanFonts.text,
                    fontSize: 12,
                    fontWeight: '500',
                    marginTop: 4,
                  }}>
                  {event.subtitle}
                </Text>
              </StickerCard>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
