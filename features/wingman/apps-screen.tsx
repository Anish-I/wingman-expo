import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppCard } from '@/features/wingman/app-card';
import { useWingman } from '@/features/wingman/provider';
import {
  IconGlyph,
  ScreenHeader,
  StickerCard,
} from '@/features/wingman/primitives';
import { wingmanFonts, wingmanLayout } from '@/features/wingman/theme';

export function AppsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { connected } = useLocalSearchParams<{ connected?: string }>();
  const { apps, beginConnection, colors, connectedAppsCount, refreshData } = useWingman();
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    if (connected) {
      void refreshData();
    }
  }, [connected, refreshData]);

  const needle = query.trim().toLowerCase();
  const filteredApps = apps.filter(
    (app) =>
      app.name.toLowerCase().includes(needle) ||
      app.category.toLowerCase().includes(needle),
  );
  const handleConnect = React.useCallback(async (appId: string) => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await beginConnection(appId);
  }, [beginConnection]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingBottom: Math.max(insets.bottom, 16) + 40,
        gap: 14,
      }}>
      <ScreenHeader
        title="Apps"
        subtitle={`${connectedAppsCount} connected · ${apps.length} available`}
        onBack={() => router.back()}
      />

      <View style={{ paddingHorizontal: wingmanLayout.screenPadding }}>
        <StickerCard
          style={{
            minHeight: 44,
            paddingHorizontal: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 9,
          }}>
          <IconGlyph name="search" color={colors.fgMuted} size={16} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search apps…"
            placeholderTextColor={colors.fgMuted}
            style={{
              flex: 1,
              color: colors.ink,
              fontFamily: wingmanFonts.text,
              fontSize: 13,
              fontWeight: '600',
              minHeight: 40,
            }}
          />
        </StickerCard>
      </View>

      <View
        style={{
          paddingHorizontal: wingmanLayout.screenPadding,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        }}>
        {filteredApps.map((app, index) => (
          <AppCard
            key={app.id}
            app={app}
            index={index}
            onConnect={handleConnect}
          />
        ))}
      </View>
    </ScrollView>
  );
}
