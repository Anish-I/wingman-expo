import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { AppIntegration } from '@/features/wingman/data';
import { useWingman } from '@/features/wingman/provider';
import { usePipController } from '@/features/wingman/pip-controller';
import {
  IconGlyph,
  ScreenHeader,
  StateNotice,
  StickerCard,
} from '@/features/wingman/primitives';
import { withAlpha, wingmanFonts, wingmanLayout } from '@/features/wingman/theme';

function AppCard({
  app,
  index,
  onConnect,
}: {
  app: AppIntegration;
  index: number;
  onConnect: (appId: string) => Promise<void>;
}) {
  const { colors, resolvedTheme } = useWingman();

  return (
    <Animated.View
      entering={FadeInDown.delay(35 + index * 28).duration(300).springify().damping(18)}
      style={{ width: '48.6%' }}>
      <StickerCard
        backgroundColor={app.connected ? withAlpha(app.color, resolvedTheme === 'dark' ? 0.16 : 0.07) : colors.card}
        borderColor={app.connected ? withAlpha(app.color, 0.58) : colors.border}
        style={{
          minHeight: 104,
          padding: 10,
          justifyContent: 'space-between',
          gap: 8,
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
              Available
            </Text>
          )}

          {!app.connected ? (
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
          ) : null}
        </View>
      </StickerCard>
    </Animated.View>
  );
}

export function AppsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { connected } = useLocalSearchParams<{ connected?: string }>();
  const { apps, beginConnection, colors, connectedAppsCount, dataError, dataLoading, refreshData } = useWingman();
  const { play: pipPlay } = usePipController();
  const [query, setQuery] = React.useState('');
  const [connectError, setConnectError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (connected) {
      void refreshData();
      pipPlay('excited', { say: 'Connected! 🎉', ms: 2600 });
    }
  }, [connected, refreshData, pipPlay]);

  const filteredApps = apps.filter((app) =>
    app.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const handleConnect = React.useCallback(async (appId: string) => {
    setConnectError(null);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Haptics are best-effort.
    }
    try {
      await beginConnection(appId);
    } catch (error) {
      setConnectError(error instanceof Error ? error.message : 'Could not start the connection.');
    }
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

      {connectError ? (
        <View style={{ paddingHorizontal: wingmanLayout.screenPadding }}>
          <StickerCard
            backgroundColor={withAlpha(colors.coral500, 0.1)}
            borderColor={withAlpha(colors.coral500, 0.45)}
            style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
            <Text style={{ color: colors.ink, fontFamily: wingmanFonts.text, fontSize: 12, fontWeight: '700', lineHeight: 18 }}>
              {connectError}
            </Text>
          </StickerCard>
        </View>
      ) : null}

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
            placeholder="Search 1,000+ apps…"
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

      {apps.length === 0 ? (
        dataError ? (
          <StateNotice
            tone="error"
            title="Couldn't load your apps"
            body={dataError}
            actionLabel="Try again"
            onAction={() => void refreshData()}
          />
        ) : dataLoading ? (
          <StateNotice tone="loading" title="Loading your apps…" />
        ) : (
          <StateNotice title="No apps to show" body="Connect an account to let Pip act on your behalf." />
        )
      ) : filteredApps.length === 0 ? (
        <StateNotice pip="question" title={`No apps match “${query.trim()}”`} body="Try a different name." />
      ) : null}
    </ScrollView>
  );
}
