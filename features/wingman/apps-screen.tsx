import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useWingman } from '@/features/wingman/provider';
import {
  IconGlyph,
  ScreenHeader,
  StatusPill,
  StickerCard,
} from '@/features/wingman/primitives';
import { withAlpha, wingmanFonts, wingmanLayout } from '@/features/wingman/theme';

export function AppsScreen() {
  const router = useRouter();
  const { connected } = useLocalSearchParams<{ connected?: string }>();
  const { apps, beginConnection, colors, connectedAppsCount, refreshData } = useWingman();
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    if (connected) {
      void refreshData();
    }
  }, [connected, refreshData]);

  const filteredApps = apps.filter((app) =>
    app.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingBottom: 60,
        gap: 14,
      }}>
      <ScreenHeader
        title="Apps"
        subtitle={`${connectedAppsCount} connected · 1,000+ available`}
        onBack={() => router.back()}
      />

      <View style={{ paddingHorizontal: wingmanLayout.screenPadding }}>
        <StickerCard
          style={{
            minHeight: 48,
            paddingHorizontal: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}>
          <IconGlyph name="search" color={colors.fgMuted} size={18} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search 1,000+ apps…"
            placeholderTextColor={colors.fgMuted}
            style={{
              flex: 1,
              color: colors.ink,
              fontFamily: wingmanFonts.text,
              fontSize: 14,
              fontWeight: '600',
            }}
          />
        </StickerCard>
      </View>

      <View
        style={{
          paddingHorizontal: wingmanLayout.screenPadding,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
        }}>
        {filteredApps.map((app) => (
          <StickerCard
            key={app.id}
            backgroundColor={app.connected ? withAlpha(app.color, 0.08) : colors.card}
            borderColor={app.connected ? app.color : colors.border}
            style={{
              width: '47%',
              minHeight: 132,
              padding: 12,
              justifyContent: 'space-between',
              gap: 8,
            }}>
            <View style={{ gap: 10 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: withAlpha(app.color, 0.4),
                  backgroundColor: withAlpha(app.color, 0.16),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{ fontSize: 20 }}>{app.emoji}</Text>
              </View>
              <View style={{ gap: 2 }}>
                <Text
                  style={{
                    color: colors.ink,
                    fontFamily: wingmanFonts.display,
                    fontSize: 16,
                    fontWeight: '700',
                  }}>
                  {app.name}
                </Text>
                <Text
                  style={{
                    color: colors.fgMuted,
                    fontFamily: wingmanFonts.text,
                    fontSize: 11,
                    fontWeight: '700',
                  }}>
                  {app.category}
                </Text>
              </View>
            </View>

            {app.connected ? (
              <StatusPill
                color={colors.mint500}
                backgroundColor={colors.mint100}>
                Connected
              </StatusPill>
            ) : (
              <Pressable
                onPress={async () => {
                  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  await beginConnection(app.id);
                }}
                style={{
                  alignSelf: 'flex-start',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: colors.sky500,
                  borderWidth: 1.5,
                  borderColor: colors.sky700,
                }}>
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontFamily: wingmanFonts.text,
                    fontSize: 12,
                    fontWeight: '800',
                  }}>
                  Connect
                </Text>
              </Pressable>
            )}
          </StickerCard>
        ))}
      </View>
    </ScrollView>
  );
}
