import React from 'react';
import { useWindowDimensions, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWingman } from '@/features/wingman/provider';
import {
  ScreenHeader,
  SegmentedControl,
  StickerCard,
  WingmanButton,
  WingmanLabel,
} from '@/features/wingman/primitives';
import { wingmanFonts, wingmanLayout } from '@/features/wingman/theme';

type CritiqueTarget = 'home' | 'chat' | 'apps' | 'flows' | 'settings' | 'onboarding-auth';

export function UiCritiqueScreen() {
  const { critiqueUi, colors, resolvedTheme } = useWingman();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [screenId, setScreenId] = React.useState<CritiqueTarget>('home');
  const [loading, setLoading] = React.useState(false);
  const [report, setReport] = React.useState<Awaited<ReturnType<typeof critiqueUi>> | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const runCritique = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await critiqueUi({
        screenId,
        theme: resolvedTheme,
        viewport: { width, height },
      });
      setReport(result);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Critique failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingBottom: insets.bottom + 100,
        gap: 18,
      }}>
      <ScreenHeader
        title="UI critique lab"
        subtitle="Developer-only design review surface powered by the internal critique agent."
      />

      <View style={{ paddingHorizontal: wingmanLayout.screenPadding, gap: 16 }}>
        <Animated.View entering={FadeInDown.duration(380)}>
        <StickerCard style={{ padding: 16, gap: 12 }}>
          <WingmanLabel color={colors.sky500}>Target surface</WingmanLabel>
          <SegmentedControl
            value={screenId}
            onChange={(value) => setScreenId(value as CritiqueTarget)}
            options={[
              { label: 'Home', value: 'home' },
              { label: 'Chat', value: 'chat' },
              { label: 'Apps', value: 'apps' },
            ]}
          />
          <SegmentedControl
            value={screenId}
            onChange={(value) => setScreenId(value as CritiqueTarget)}
            options={[
              { label: 'Flows', value: 'flows' },
              { label: 'Settings', value: 'settings' },
              { label: 'Onboard', value: 'onboarding-auth' },
            ]}
          />
          <WingmanButton onPress={() => { void runCritique(); }} iconRight="arrow-right">
            {loading ? 'Critiquing…' : 'Run critique'}
          </WingmanButton>
        </StickerCard>
        </Animated.View>

        {error ? (
          <Animated.View entering={FadeInDown.duration(280)}>
          <StickerCard style={{ padding: 14 }}>
            <Text
              style={{
                color: colors.coral500,
                fontFamily: wingmanFonts.text,
                fontSize: 13,
                fontWeight: '700',
              }}>
              {error}
            </Text>
          </StickerCard>
          </Animated.View>
        ) : null}

        {report ? (
          <Animated.View entering={FadeInDown.duration(380)}>
          <StickerCard style={{ padding: 16, gap: 14 }}>
            <View style={{ gap: 6 }}>
              <WingmanLabel color={report.verdict === 'pass' ? colors.mint500 : colors.sun500}>Verdict</WingmanLabel>
              <Text
                style={{
                  color: colors.ink,
                  fontFamily: wingmanFonts.display,
                  fontSize: 24,
                  fontWeight: '700',
                }}>
                {`${report.score} · ${report.verdict}`}
              </Text>
            </View>

            <View style={{ gap: 8 }}>
              <Text
                style={{
                  color: colors.fgSecondary,
                  fontFamily: wingmanFonts.text,
                  fontSize: 12,
                  fontWeight: '800',
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}>
                Findings
              </Text>
              {report.findings.map((finding) => (
                <Text
                  key={finding}
                  style={{
                    color: colors.ink,
                    fontFamily: wingmanFonts.text,
                    fontSize: 14,
                    fontWeight: '500',
                    lineHeight: 20,
                  }}>
                  {`• ${finding}`}
                </Text>
              ))}
            </View>

            <View style={{ gap: 8 }}>
              <Text
                style={{
                  color: colors.fgSecondary,
                  fontFamily: wingmanFonts.text,
                  fontSize: 12,
                  fontWeight: '800',
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}>
                Recommendations
              </Text>
              {report.recommendations.map((recommendation) => (
                <Text
                  key={recommendation}
                  style={{
                    color: colors.ink,
                    fontFamily: wingmanFonts.text,
                    fontSize: 14,
                    fontWeight: '500',
                    lineHeight: 20,
                  }}>
                  {`• ${recommendation}`}
                </Text>
              ))}
            </View>
          </StickerCard>
          </Animated.View>
        ) : null}
      </View>
    </ScrollView>
  );
}
