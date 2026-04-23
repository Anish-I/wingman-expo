import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useWingman } from '@/features/wingman/provider';
import {
  IconGlyph,
  Pip,
  StickerCard,
  WingmanLabel,
} from '@/features/wingman/primitives';
import { withAlpha, wingmanFonts, wingmanLayout } from '@/features/wingman/theme';

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
  const { briefing, colors, connectedAppsCount, currentUser } = useWingman();
  const formattedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const briefingItems = briefing?.items ?? [];
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
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingBottom: 96,
        paddingHorizontal: wingmanLayout.screenPadding,
        gap: 18,
      }}>
      <View style={{ paddingTop: 18 }}>
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
          <View style={{ position: 'absolute', right: 8, bottom: -4 }}>
            <Pip variant="wave" size={104} />
          </View>
        </LinearGradient>
      </View>

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
          {shortcuts.map((shortcut) => (
            <Pressable
              key={shortcut.id}
              onPress={() => void openChat(shortcut.prompt)}
              style={{
                width: '47%',
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
              }}>
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
          ))}
        </View>
      </View>

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

      <View style={{ gap: 10 }}>
        <WingmanLabel>Today&apos;s brief</WingmanLabel>
        <View style={{ gap: 10 }}>
          {briefingItems.map((item) => (
            <StickerCard
              key={item.id}
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
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
