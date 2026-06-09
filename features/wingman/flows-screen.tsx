import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { type GestureResponderEvent, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWingman } from '@/features/wingman/provider';
import {
  IconGlyph,
  Pip,
  WingmanLabel,
  WingmanToggle,
} from '@/features/wingman/primitives';
import {
  skyShadow,
  stickerShadow,
  withAlpha,
  wingmanFonts,
  wingmanLayout,
} from '@/features/wingman/theme';

type FlowRowProps = {
  flow: ReturnType<typeof useWingman>['flows'][number];
  index: number;
  onEdit: (id: string) => void;
  onToggle: (id: string, next: boolean) => void;
};

function FlowRow({ flow, index, onEdit, onToggle }: FlowRowProps) {
  const { colors, resolvedTheme } = useWingman();
  const active = flow.active;

  const activeProgress = useSharedValue(active ? 1 : 0);
  const pressScale = useSharedValue(1);

  React.useEffect(() => {
    activeProgress.value = withTiming(active ? 1 : 0, { duration: 240 });
  }, [active, activeProgress]);

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
    opacity: 0.72 + activeProgress.value * 0.28,
  }));

  const accentStripStyle = useAnimatedStyle(() => ({
    opacity: activeProgress.value,
    transform: [{ scaleY: 0.55 + activeProgress.value * 0.45 }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(60 + index * 35).duration(320)}
      layout={LinearTransition}
      style={{ width: '48.85%' }}>
      <Pressable
        onPressIn={() => {
          pressScale.value = withSpring(0.985, { damping: 18, stiffness: 320 });
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1, { damping: 18, stiffness: 320 });
        }}
        onPress={async () => {
          await Haptics.selectionAsync();
          onToggle(flow.id, !active);
        }}>
        <Animated.View
          style={[
            {
              minHeight: 106,
              backgroundColor: active ? colors.card : colors.cardAlt,
              borderColor: active ? withAlpha(flow.color, 0.55) : colors.border,
              borderWidth: 1.5,
              borderRadius: wingmanLayout.radiusMd,
              padding: 10,
              boxShadow: stickerShadow(resolvedTheme),
              borderCurve: 'continuous',
              overflow: 'hidden',
            },
            animatedCardStyle,
          ]}>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 4,
                backgroundColor: flow.color,
                borderTopLeftRadius: wingmanLayout.radiusMd,
                borderBottomLeftRadius: wingmanLayout.radiusMd,
              },
              accentStripStyle,
            ]}
          />

          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  borderWidth: 1.5,
                  borderColor: withAlpha(flow.color, active ? 0.5 : 0.25),
                  backgroundColor: withAlpha(flow.color, active ? 0.18 : 0.08),
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderCurve: 'continuous',
                }}>
                <Text style={{ fontSize: 17 }}>{flow.emoji}</Text>
              </View>
              <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                <Text
                  numberOfLines={2}
                  style={{
                    color: colors.ink,
                    fontFamily: wingmanFonts.display,
                    fontSize: 14,
                    fontWeight: '700',
                    lineHeight: 17,
                    letterSpacing: 0,
                  }}>
                  {flow.title}
                </Text>
              </View>
            </View>

            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: active ? flow.color : colors.fgMuted,
                }}
              />
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  color: active ? flow.color : colors.fgMuted,
                  fontFamily: wingmanFonts.text,
                  fontSize: 10,
                  fontWeight: '800',
                  letterSpacing: 0,
                }}>
                {flow.trigger}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  color: colors.fgMuted,
                  fontFamily: wingmanFonts.text,
                  fontSize: 10,
                  fontWeight: '700',
                  letterSpacing: 0,
                }}>
                {flow.runs} {flow.runs === 1 ? 'run' : 'runs'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${flow.title}`}
                  onPress={async (event: GestureResponderEvent) => {
                    event.stopPropagation();
                    await Haptics.selectionAsync();
                    onEdit(flow.id);
                  }}
                  style={({ pressed }) => ({
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: active ? withAlpha(flow.color, 0.38) : colors.border,
                    backgroundColor: active ? withAlpha(flow.color, 0.12) : colors.card,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.72 : 1,
                    borderCurve: 'continuous',
                  })}>
                  <IconGlyph name="edit" color={active ? flow.color : colors.fgMuted} size={13} />
                </Pressable>
                <View style={{ transform: [{ scale: 0.72 }], marginRight: -7 }}>
                  <WingmanToggle
                    value={active}
                    onValueChange={async () => {
                      await Haptics.selectionAsync();
                      onToggle(flow.id, !active);
                    }}
                  />
                </View>
              </View>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function FlowStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        minHeight: 54,
        borderRadius: wingmanLayout.radiusMd,
        backgroundColor: withAlpha('#FFFFFF', 0.18),
        paddingHorizontal: 10,
        paddingVertical: 8,
        justifyContent: 'center',
        borderCurve: 'continuous',
      }}>
      <Text
        numberOfLines={1}
        style={{
          color: withAlpha('#FFFFFF', 0.76),
          fontFamily: wingmanFonts.text,
          fontSize: 9,
          fontWeight: '800',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            backgroundColor: tone,
          }}
        />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.82}
          style={{
            color: '#FFFFFF',
            fontFamily: wingmanFonts.display,
            fontSize: 20,
            fontWeight: '700',
            letterSpacing: 0,
          }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function CompactHeader({
  activeFlowsCount,
  flowCount,
  totalRuns,
  pausedCount,
}: {
  activeFlowsCount: number;
  flowCount: number;
  totalRuns: number;
  pausedCount: number;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useWingman();

  return (
    <View
      style={{
        paddingTop: Math.max(insets.top + 14, 18),
        paddingHorizontal: wingmanLayout.screenPadding,
        gap: 10,
      }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 14,
        }}>
        <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
          <WingmanLabel>Automation</WingmanLabel>
          <Text
            style={{
              color: colors.fgPrimary,
              fontFamily: wingmanFonts.display,
              fontSize: 30,
              fontWeight: '700',
              lineHeight: 32,
              letterSpacing: 0,
            }}>
            Flows
          </Text>
        </View>
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 142,
            height: 50,
            alignItems: 'flex-end',
            justifyContent: 'center',
            overflow: 'visible',
          }}>
          <Pip variant="headband" size={62} />
        </View>
      </View>

      <LinearGradient
        colors={[colors.sky400, colors.sky600]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          minHeight: 72,
          borderRadius: wingmanLayout.radiusLg,
          borderWidth: 1.5,
          borderColor: colors.sky700,
          padding: 10,
          flexDirection: 'row',
          gap: 8,
          boxShadow: skyShadow(),
          borderCurve: 'continuous',
          overflow: 'hidden',
        }}>
        <FlowStat label="Active" value={`${activeFlowsCount}/${flowCount}`} tone={colors.mint300} />
        <FlowStat label="Runs" value={totalRuns} tone={colors.sun300} />
        <FlowStat label="Paused" value={pausedCount} tone={withAlpha('#FFFFFF', 0.75)} />
      </LinearGradient>
    </View>
  );
}

export function FlowsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeFlowsCount, colors, createFlow, flows, toggleFlow } = useWingman();
  const newFlowScale = useSharedValue(1);

  const totalRuns = flows.reduce((sum, flow) => sum + flow.runs, 0);
  const pausedCount = flows.length - activeFlowsCount;

  const newFlowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: newFlowScale.value }],
  }));

  const handleCreateFlow = React.useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Haptics are best-effort on web and unsupported devices.
    }
    const flow = await createFlow();
    if (flow) {
      router.push(`/flow-builder?flowId=${encodeURIComponent(flow.id)}` as never);
    }
  }, [createFlow, router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 16) + 86,
          gap: 10,
        }}>
        <CompactHeader
          activeFlowsCount={activeFlowsCount}
          flowCount={flows.length}
          totalRuns={totalRuns}
          pausedCount={pausedCount}
        />

        <View style={{ paddingHorizontal: wingmanLayout.screenPadding, gap: 8 }}>
          <Animated.View
            entering={FadeIn.delay(120).duration(300)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}>
            <WingmanLabel>Your automations</WingmanLabel>
            <Animated.View style={newFlowAnimatedStyle}>
              <Pressable
                onPressIn={() => {
                  newFlowScale.value = withSpring(0.94, { damping: 14, stiffness: 360 });
                }}
                onPressOut={() => {
                  newFlowScale.value = withSpring(1, { damping: 14, stiffness: 320 });
                }}
                onPress={handleCreateFlow}
                accessibilityRole="button"
                accessibilityLabel="Create a new flow"
                style={({ pressed }) => ({
                  height: 34,
                  paddingLeft: 11,
                  paddingRight: 13,
                  borderRadius: 17,
                  borderWidth: 1.5,
                  borderColor: colors.sky700,
                  backgroundColor: colors.sky500,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  opacity: pressed ? 0.82 : 1,
                  boxShadow: skyShadow(),
                  borderCurve: 'continuous',
                })}>
                <IconGlyph name="plus" color="#FFFFFF" size={16} />
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontFamily: wingmanFonts.text,
                    fontSize: 12,
                    fontWeight: '800',
                    letterSpacing: 0,
                  }}>
                  New flow
                </Text>
              </Pressable>
            </Animated.View>
          </Animated.View>

          <Animated.View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              rowGap: 7,
            }}
            layout={LinearTransition}>
            {flows.map((flow, index) => (
              <FlowRow
                key={flow.id}
                flow={flow}
                index={index}
                onEdit={(id) => {
                  router.push(`/flow-builder?flowId=${encodeURIComponent(id)}` as never);
                }}
                onToggle={(id, next) => {
                  void toggleFlow(id, next);
                }}
              />
            ))}
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}
