import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

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
  const { briefing, colors, connectedAppsCount, currentUser } = useWingman();
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
        entering={FadeInDown.duration(460).springify().damping(18)}
        style={{ paddingTop: Math.max(insets.top + 14, 18) }}>
        <LinearGradient
          colors={[colors.sky400, colors.sky600]}
          start={{ x: 0.05, y: 0 }}
          end={{ x: 0.95, y: 1 }}
          style={{
            padding: 18,
            borderRadius: 24,
            borderWidth: 1.5,
            borderColor: colors.sky700,
            overflow: 'hidden',
            boxShadow: '0 4px 0 rgba(29, 78, 216, 0.20), 0 10px 24px rgba(59, 130, 246, 0.34)',
            borderCurve: 'continuous',
          }}>
          <View
            style={{
              position: 'absolute',
              top: -34,
              right: -28,
              width: 146,
              height: 146,
              borderRadius: 999,
              backgroundColor: withAlpha(colors.sun300, 0.34),
            }}
          />
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: colors.sun300 }} />
              <Text
                style={{
                  color: withAlpha('#FFFFFF', 0.84),
                  fontFamily: wingmanFonts.text,
                  fontSize: 12,
                  fontWeight: '800',
                  letterSpacing: 1.1,
                  textTransform: 'uppercase',
                }}>
                {`Today - ${formattedDate}`}
              </Text>
            </View>
            <Text
              style={{
                color: '#FFFFFF',
                fontFamily: wingmanFonts.display,
                fontSize: 28,
                fontWeight: '700',
                lineHeight: 30,
                letterSpacing: -0.8,
                maxWidth: 220,
              }}>
              {`Morning, ${greetingName}!\nHere's the plan.`}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(briefing?.chips ?? ['0 meetings', '0 flows running', '0 apps connected']).map((pill) => (
                <View
                  key={pill}
                  style={{
                    paddingHorizontal: 11,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: withAlpha('#FFFFFF', 0.22),
                  }}>
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontFamily: wingmanFonts.text,
                      fontSize: 12,
                      fontWeight: '800',
                    }}>
                    {pill}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          <View style={{ position: 'absolute', right: 2, bottom: -2 }}>
            <Image
              source={heroPipSource}
              contentFit="contain"
              style={{
                width: 126,
                height: 112,
              }}
            />
          </View>
        </LinearGradient>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).duration(380).springify().damping(18)}>
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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {shortcuts.map((shortcut, index) => (
            <Animated.View
              key={shortcut.id}
              entering={FadeInDown.delay(140 + index * 60).duration(380).springify().damping(18)}
              style={{ width: '47%' }}>
            <Pressable
              onPress={() => void openChat(shortcut.prompt)}
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.97 : 1 }],
                minHeight: 78,
                paddingHorizontal: 12,
                paddingVertical: 12,
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: shortcut.borderColor,
                backgroundColor: shortcut.color,
                justifyContent: 'center',
                alignItems: 'center',
                gap: 10,
                boxShadow: '0 3px 0 rgba(27, 34, 64, 0.10)',
                borderCurve: 'continuous',
              })}>
              <Text style={{ fontSize: 21, textAlign: 'center' }}>{shortcut.emoji}</Text>
              <Text
                style={{
                  color: shortcutInk,
                  fontFamily: wingmanFonts.display,
                  fontSize: 15,
                  fontWeight: '700',
                  lineHeight: 18,
                  textAlign: 'center',
                }}>
                {shortcut.title}
              </Text>
            </Pressable>
            </Animated.View>
          ))}
        </View>
      </View>

      <Animated.View entering={FadeInDown.delay(180).duration(380).springify().damping(18)}>
      <Pressable onPress={() => router.push('/apps')}>
        <StickerCard
          style={{
            padding: 16,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: withAlpha(colors.sky500, 0.4),
              backgroundColor: withAlpha(colors.sky500, 0.12),
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <IconGlyph name="apps" color={colors.sky500} size={18} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.ink,
                fontFamily: wingmanFonts.display,
                fontSize: 18,
                fontWeight: '700',
              }}>
              Browse apps
            </Text>
            <Text
              style={{
                color: colors.fgSecondary,
                fontFamily: wingmanFonts.text,
                fontSize: 13,
                fontWeight: '600',
              }}>
              {connectedAppsCount} connected, 1,000+ available
            </Text>
          </View>
          <IconGlyph name="chevron-right" color={colors.fgMuted} size={18} />
        </StickerCard>
      </Pressable>
      </Animated.View>

      <View style={{ gap: 10 }}>
        <WingmanLabel>Today&apos;s brief</WingmanLabel>
        <View style={{ gap: 10 }}>
          {briefingItems.map((item, index) => (
            <Animated.View
              key={item.id}
              entering={FadeInDown.delay(200 + index * 70).duration(380).springify().damping(18)}>
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
