import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWingman } from '@/features/wingman/provider';
import {
  IconGlyph,
  ScreenHeader,
  StickerCard,
  WingmanToggle,
} from '@/features/wingman/primitives';
import { withAlpha, wingmanFonts, wingmanLayout } from '@/features/wingman/theme';

export function FlowsScreen() {
  const insets = useSafeAreaInsets();
  const { activeFlowsCount, colors, createFlow, flows, toggleFlow } = useWingman();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingBottom: 150,
          gap: 12,
        }}>
        <ScreenHeader
          title="Flows"
          subtitle={`${activeFlowsCount} active · Let Pip handle the boring stuff`}
        />
        <View style={{ gap: 10, paddingHorizontal: wingmanLayout.screenPadding }}>
          {flows.map((flow) => (
            <StickerCard
              key={flow.id}
              style={{
                padding: 14,
                gap: 10,
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: withAlpha(flow.color, 0.38),
                    backgroundColor: withAlpha(flow.color, 0.14),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Text style={{ fontSize: 20 }}>{flow.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.ink,
                      fontFamily: wingmanFonts.display,
                      fontSize: 17,
                      fontWeight: '700',
                    }}>
                    {flow.title}
                  </Text>
                  <Text
                    style={{
                      color: colors.fgSecondary,
                      fontFamily: wingmanFonts.text,
                      fontSize: 13,
                      fontWeight: '500',
                    }}>
                    {flow.description}
                  </Text>
                </View>
                <WingmanToggle
                  value={flow.active}
                  onValueChange={async () => {
                    await Haptics.selectionAsync();
                    await toggleFlow(flow.id, !flow.active);
                  }}
                />
              </View>

              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  paddingTop: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}>
                <View
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: colors.cardAlt,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                  <IconGlyph name="time" color={colors.fgMuted} size={12} />
                  <Text
                    style={{
                      color: colors.fgMuted,
                      fontFamily: wingmanFonts.text,
                      fontSize: 11,
                      fontWeight: '700',
                    }}>
                    {flow.trigger}
                  </Text>
                </View>
                <Text
                  style={{
                    color: colors.fgMuted,
                    fontFamily: wingmanFonts.text,
                    fontSize: 11,
                    fontWeight: '700',
                  }}>
                  · {flow.runs} runs
                </Text>
              </View>
            </StickerCard>
          ))}
        </View>
      </ScrollView>

      <Pressable
        onPress={() => {
          void createFlow();
        }}
        style={{
          position: 'absolute',
          right: wingmanLayout.screenPadding,
          bottom: Math.max(insets.bottom, 10) + 6,
          width: 58,
          height: 58,
          borderRadius: 20,
          borderWidth: 1.5,
          borderColor: colors.sky700,
          backgroundColor: colors.sky500,
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 0 rgba(29, 78, 216, 0.20), 0 10px 24px rgba(59, 130, 246, 0.34)',
        }}>
        <IconGlyph name="plus" color="#FFFFFF" size={24} />
      </Pressable>
    </View>
  );
}
