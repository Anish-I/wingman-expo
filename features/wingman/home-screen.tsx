import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppCard } from '@/features/wingman/app-card';
import { useWingman } from '@/features/wingman/provider';
import {
  IconGlyph,
  StickerCard,
  WingmanLabel,
} from '@/features/wingman/primitives';
import { withAlpha, wingmanFonts, wingmanLayout } from '@/features/wingman/theme';

const heroPipSource = require('@/assets/onboarding-birds/coding-laptop-clean.png');

const shortcuts = [
  {
    id: 'shortcut-1',
    title: 'Draft an email',
    emoji: '✉️',
    color: '#DCEDFF',
    borderColor: '#3B82F6',
    prompt: 'Draft an email to Maya about the launch plan',
  },
  {
    id: 'shortcut-2',
    title: 'Summarize inbox',
    emoji: '📥',
    color: '#FFE58A',
    borderColor: '#D99B00',
    prompt: 'Summarize my inbox',
  },
  {
    id: 'shortcut-3',
    title: 'Plan my week',
    emoji: '🗓️',
    color: '#E7E1FF',
    borderColor: '#8B7CF6',
    prompt: 'Plan my week',
  },
  {
    id: 'shortcut-4',
    title: 'Find a time',
    emoji: '⏰',
    color: '#FFE2D6',
    borderColor: '#F26A46',
    prompt: 'Find time for a 30 minute meeting next week',
  },
] as const;

export function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { apps, beginConnection, briefing, colors, connectedAppsCount, currentUser } = useWingman();
  const formattedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const briefingItems = briefing?.items.length
    ? briefing.items
    : [
        {
          id: 'fallback-brief-1',
          time: '8:30',
          title: 'Inbox triage ready',
          subtitle: 'Pip can summarize priority messages.',
          emoji: '📥',
          color: colors.sky500,
        },
        {
          id: 'fallback-brief-2',
          time: '9:00',
          title: 'Calendar scan',
          subtitle: 'No conflicts found for your morning.',
          emoji: '📅',
          color: colors.sun500,
        },
        {
          id: 'fallback-brief-3',
          time: 'Now',
          title: 'Workflow ideas',
          subtitle: 'Try a digest, reminder, or PR notifier.',
          emoji: '⚡',
          color: colors.lav500,
        },
      ];
  const greetingName = currentUser?.name.split(' ')[0] ?? 'Sam';
  const shortcutInk = '#1B2240';

  const hour = new Date().getHours();
  const dayPart = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';

  // Keep hero chips to one truthful row: meetings + flows from the briefing,
  // apps count computed live (the server chip can lag behind Composio).
  const heroChips = React.useMemo(() => {
    const briefingChips = briefing?.chips ?? [];
    const keep = briefingChips.filter((chip) => !chip.includes('app')).slice(0, 2);
    return [...keep, `${connectedAppsCount} ${connectedAppsCount === 1 ? 'app' : 'apps'} connected`];
  }, [briefing?.chips, connectedAppsCount]);

  // Connected apps first, then connectable suggestions, then "soon" apps as a
  // last resort — the grid should never render empty.
  const homeApps = React.useMemo(() => {
    const connected = apps.filter((app) => app.connected);
    const ready = apps.filter((app) => !app.connected && app.available !== false);
    const soon = apps.filter((app) => !app.connected && app.available === false);
    return [...connected, ...ready, ...soon].slice(0, 4);
  }, [apps]);

  const handleConnect = React.useCallback(
    async (appId: string) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await beginConnection(appId);
    },
    [beginConnection],
  );

  const openChat = async (prompt?: string) => {
    await Haptics.selectionAsync();

    if (prompt) {
      router.push(`/(tabs)/chat?prompt=${encodeURIComponent(prompt)}` as never);
      return;
    }

    router.push('/(tabs)/chat');
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingBottom: Math.max(insets.bottom, 16) + 110,
        paddingHorizontal: wingmanLayout.screenPadding,
        gap: 18,
      }}>
      <Animated.View
        entering={FadeInDown.duration(460)}
        style={{ paddingTop: Math.max(insets.top + 14, 18) }}>
        <LinearGradient
          colors={[colors.sky400, colors.sky600]}
          start={{ x: 0.05, y: 0 }}
          end={{ x: 0.95, y: 1 }}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderRadius: 22,
            borderWidth: 1.5,
            borderColor: colors.sky700,
            overflow: 'hidden',
            boxShadow: '0 4px 0 rgba(29, 78, 216, 0.20), 0 10px 24px rgba(59, 130, 246, 0.34)',
            borderCurve: 'continuous',
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, gap: 8 }}>
              <Text
                style={{
                  color: withAlpha('#FFFFFF', 0.8),
                  fontFamily: wingmanFonts.text,
                  fontSize: 11,
                  fontWeight: '800',
                  letterSpacing: 1.1,
                  textTransform: 'uppercase',
                }}>
                {`Today · ${formattedDate}`}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  color: '#FFFFFF',
                  fontFamily: wingmanFonts.display,
                  fontSize: 24,
                  fontWeight: '700',
                  lineHeight: 28,
                  letterSpacing: -0.6,
                }}>
                {`${dayPart}, ${greetingName}!`}
              </Text>
              <Text
                style={{
                  color: withAlpha('#FFFFFF', 0.88),
                  fontFamily: wingmanFonts.text,
                  fontSize: 13,
                  fontWeight: '600',
                }}>
                Here&apos;s the plan.
              </Text>
            </View>
            <Image
              source={heroPipSource}
              contentFit="contain"
              style={{
                width: 84,
                height: 76,
              }}
            />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {heroChips.map((pill) => (
              <View
                key={pill}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: withAlpha('#FFFFFF', 0.22),
                }}>
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontFamily: wingmanFonts.text,
                    fontSize: 11,
                    fontWeight: '800',
                  }}>
                  {pill}
                </Text>
              </View>
            ))}
          </View>
        </LinearGradient>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).duration(380)}>
      <Pressable onPress={() => void openChat()}>
        <StickerCard
          style={{
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}>
          <IconGlyph name="sparkles" color={colors.sky500} size={18} />
          <Text
            style={{
              flex: 1,
              color: colors.fgMuted,
              fontFamily: wingmanFonts.text,
              fontSize: 14,
              fontWeight: '600',
            }}>
            Ask Pip anything…
          </Text>
          <IconGlyph name="arrow-right" color={colors.fgMuted} size={18} />
        </StickerCard>
      </Pressable>
      </Animated.View>

      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: colors.sky500 }} />
            <Text
              style={{
                color: colors.fgSecondary,
                fontFamily: wingmanFonts.text,
                fontSize: 12,
                fontWeight: '800',
                letterSpacing: 1.1,
                textTransform: 'uppercase',
              }}>
              Your apps
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/apps')}
            hitSlop={8}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.6 : 1 })}>
            <Text
              style={{
                color: colors.sky500,
                fontFamily: wingmanFonts.text,
                fontSize: 12,
                fontWeight: '800',
              }}>
              {`${connectedAppsCount} connected · See all`}
            </Text>
            <IconGlyph name="chevron-right" color={colors.sky500} size={14} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {homeApps.map((app, index) => (
            <AppCard key={app.id} app={app} index={index} onConnect={handleConnect} width="48.6%" />
          ))}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: colors.coral500 }} />
          <Text
            style={{
              color: colors.fgSecondary,
              fontFamily: wingmanFonts.text,
              fontSize: 12,
              fontWeight: '800',
              letterSpacing: 1.1,
              textTransform: 'uppercase',
            }}>
            Quick shortcuts
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {shortcuts.map((shortcut, index) => (
            <Animated.View
              key={shortcut.id}
              entering={FadeInDown.delay(140 + index * 60).duration(380)}
              style={{ width: '48.6%' }}>
            <Pressable
              onPress={() => void openChat(shortcut.prompt)}
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.97 : 1 }],
                minHeight: 52,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: shortcut.borderColor,
                backgroundColor: shortcut.color,
                flexDirection: 'row',
                justifyContent: 'flex-start',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 3px 0 rgba(27, 34, 64, 0.10)',
                borderCurve: 'continuous',
              })}>
              <Text style={{ fontSize: 17 }}>{shortcut.emoji}</Text>
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  color: shortcutInk,
                  fontFamily: wingmanFonts.display,
                  fontSize: 14,
                  fontWeight: '700',
                  lineHeight: 17,
                }}>
                {shortcut.title}
              </Text>
            </Pressable>
            </Animated.View>
          ))}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <WingmanLabel>Today&apos;s brief</WingmanLabel>
        <View style={{ gap: 10 }}>
          {briefingItems.map((item, index) => (
            <Animated.View
              key={item.id}
              entering={FadeInDown.delay(200 + index * 70).duration(380)}>
            <StickerCard
              style={{
                padding: 14,
                borderRadius: 18,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: item.color,
                  backgroundColor: withAlpha(item.color, 0.14),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.ink,
                    fontFamily: wingmanFonts.text,
                    fontSize: 14,
                    fontWeight: '800',
                  }}>
                  {item.title}
                </Text>
                <Text
                  style={{
                    color: colors.fgMuted,
                    fontFamily: wingmanFonts.text,
                    fontSize: 12,
                    fontWeight: '600',
                  }}>
                  {item.subtitle}
                </Text>
              </View>
              <Text
                style={{
                  color: colors.ink,
                  fontFamily: wingmanFonts.display,
                  fontSize: 15,
                  fontWeight: '700',
                }}>
                {item.time}
              </Text>
            </StickerCard>
            </Animated.View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
