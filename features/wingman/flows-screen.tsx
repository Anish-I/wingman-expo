import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { ActivityIndicator, type GestureResponderEvent, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
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

import { confirmAction } from '@/features/wingman/confirm';
import { useWingman } from '@/features/wingman/provider';
import { usePipController } from '@/features/wingman/pip-controller';
import {
  IconGlyph,
  Pip,
  StateNotice,
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
  onDelete: (id: string, title: string) => void;
};

function FlowRow({ flow, index, onEdit, onToggle, onDelete }: FlowRowProps) {
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
      entering={FadeInDown.delay(60 + index * 35).duration(320).springify().damping(18)}
      layout={LinearTransition.springify().damping(20)}
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
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${flow.title}`}
                  onPress={async (event: GestureResponderEvent) => {
                    event.stopPropagation();
                    await Haptics.selectionAsync();
                    onDelete(flow.id, flow.title);
                  }}
                  style={({ pressed }) => ({
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.72 : 1,
                    borderCurve: 'continuous',
                  })}>
                  <IconGlyph name="trash" color={colors.fgMuted} size={13} />
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
  const { activeFlowsCount, colors, createFlow, dataError, dataLoading, deleteFlow, flows, generateFlow, refreshData, resolvedTheme, toggleFlow } = useWingman();
  const { play: pipPlay } = usePipController();
  const newFlowScale = useSharedValue(1);

  // "Generate with AI" modal state.
  const [genOpen, setGenOpen] = React.useState(false);
  const [genPrompt, setGenPrompt] = React.useState('');
  const [genBusy, setGenBusy] = React.useState(false);
  const [genError, setGenError] = React.useState<string | null>(null);

  const handleGenerateFlow = React.useCallback(async () => {
    const prompt = genPrompt.trim();
    if (!prompt || genBusy) return;
    setGenBusy(true);
    setGenError(null);
    try {
      const result = await generateFlow(prompt);
      if (result) {
        setGenOpen(false);
        setGenPrompt('');
        if (result.note) {
          // Flow was saved paused (e.g. a missing recipient email it wouldn't guess).
          // Tell the user what's needed and offer to jump into the builder to finish it.
          pipPlay('thinking', { say: 'Almost there…' });
          const open = await confirmAction({
            title: 'Saved — needs a detail',
            message: result.note,
            confirmLabel: 'Open flow',
            cancelLabel: 'Later',
          });
          if (open) {
            router.push(`/flow-builder?flowId=${encodeURIComponent(result.flow.id)}` as never);
          }
        } else {
          pipPlay('excited', { say: 'New flow! 🪶' });
        }
      } else {
        setGenError('Could not create a flow. Try rewording it.');
      }
    } catch (error) {
      setGenError(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setGenBusy(false);
    }
  }, [genPrompt, genBusy, generateFlow, pipPlay, router]);

  const handleToggleFlow = React.useCallback((id: string, next: boolean) => {
    void toggleFlow(id, next);
    // Pip reacts to both directions: pumped when a flow goes live, dozing when
    // it's paused.
    if (next) pipPlay('excited', { say: 'On it! 🪶' });
    else pipPlay('sleeping', { say: 'Resting 😴' });
  }, [pipPlay, toggleFlow]);

  const handleDeleteFlow = React.useCallback((id: string, title: string) => {
    void (async () => {
      const ok = await confirmAction({
        title: 'Delete this flow?',
        message: `“${title}” will be removed and stop running. This can't be undone.`,
        confirmLabel: 'Delete',
        destructive: true,
      });
      if (!ok) return;
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {
        // Haptics are best-effort.
      }
      void deleteFlow(id);
      pipPlay('wave', { say: 'Bye, flow 👋' });
    })();
  }, [deleteFlow, pipPlay]);

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
          // Clears the pinned full-width Generate bar that floats just above the tab bar.
          paddingBottom: Math.max(insets.bottom, 16) + 78,
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
            </View>
          </Animated.View>

          <Animated.View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              rowGap: 7,
            }}
            layout={LinearTransition.springify().damping(20)}>
            {flows.map((flow, index) => (
              <FlowRow
                key={flow.id}
                flow={flow}
                index={index}
                onEdit={(id) => {
                  router.push(`/flow-builder?flowId=${encodeURIComponent(id)}` as never);
                }}
                onToggle={handleToggleFlow}
                onDelete={handleDeleteFlow}
              />
            ))}
          </Animated.View>

          {flows.length === 0 ? (
            dataError ? (
              <StateNotice
                tone="error"
                title="Couldn't load your flows"
                body={dataError}
                actionLabel="Try again"
                onAction={() => void refreshData()}
              />
            ) : dataLoading ? (
              <StateNotice tone="loading" title="Loading your flows…" />
            ) : (
              <StateNotice
                pip="excited"
                title="No flows yet"
                body="Tap New flow to build your first automation — pick a schedule and what Pip should do."
                actionLabel="New flow"
                onAction={() => void handleCreateFlow()}
              />
            )
          ) : null}
        </View>
      </ScrollView>

      {/* Pinned full-width "Generate a flow" bar — sits just above the tab bar.
          This screen is laid out ABOVE the tab bar, so `bottom` here is measured
          from the tab-bar top (no insets needed — the tab bar already owns them).
          The GlobalPip mascot floats ~26px above the tab-bar top and rises over
          this bar's right corner; the label is centered so Pip never covers it. */}
      <Animated.View
        entering={FadeIn.delay(160).duration(300)}
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: wingmanLayout.screenPadding,
          right: wingmanLayout.screenPadding,
          bottom: 16,
        }}>
        <Pressable
          onPress={() => {
            setGenError(null);
            setGenOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Generate a flow with AI"
          style={({ pressed }) => ({
            height: 46,
            borderRadius: 23,
            borderWidth: 1.5,
            borderColor: withAlpha(colors.sky500, 0.5),
            backgroundColor: colors.card,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: pressed ? 0.85 : 1,
            boxShadow: stickerShadow(resolvedTheme),
            borderCurve: 'continuous',
          })}>
          <Text style={{ fontSize: 15 }}>✨</Text>
          <Text
            style={{
              color: colors.sky700,
              fontFamily: wingmanFonts.text,
              fontSize: 14,
              fontWeight: '800',
              letterSpacing: 0,
            }}>
            Generate a flow
          </Text>
        </Pressable>
      </Animated.View>

      <Modal visible={genOpen} transparent animationType="fade" onRequestClose={() => setGenOpen(false)}>
        <Pressable
          onPress={() => (genBusy ? null : setGenOpen(false))}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 }}>
          <Pressable
            onPress={(e: GestureResponderEvent) => e.stopPropagation()}
            style={{
              backgroundColor: colors.card,
              borderRadius: 22,
              borderWidth: 1.5,
              borderColor: colors.border,
              padding: 18,
              gap: 12,
              boxShadow: stickerShadow(resolvedTheme),
              borderCurve: 'continuous',
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 18 }}>✨</Text>
              <Text style={{ color: colors.ink, fontFamily: wingmanFonts.text, fontSize: 16, fontWeight: '800' }}>
                Generate a flow
              </Text>
            </View>
            <Text style={{ color: colors.fgSecondary, fontFamily: wingmanFonts.text, fontSize: 13, lineHeight: 18 }}>
              Describe what Pip should automate — the trigger and what should happen.
            </Text>
            <TextInput
              value={genPrompt}
              onChangeText={setGenPrompt}
              editable={!genBusy}
              multiline
              placeholder="e.g. Every weekday at 8am, read my calendar and email me a summary"
              placeholderTextColor={colors.fgMuted}
              style={{
                minHeight: 84,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: colors.border,
                backgroundColor: colors.cardAlt,
                padding: 12,
                color: colors.ink,
                fontFamily: wingmanFonts.text,
                fontSize: 14,
                textAlignVertical: 'top',
              }}
            />
            {genError ? (
              <Text style={{ color: colors.coral500, fontFamily: wingmanFonts.text, fontSize: 12, fontWeight: '700' }}>
                {genError}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 2 }}>
              <Pressable
                onPress={() => (genBusy ? null : setGenOpen(false))}
                style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 9, opacity: pressed ? 0.7 : 1 })}>
                <Text style={{ color: colors.fgSecondary, fontFamily: wingmanFonts.text, fontSize: 13, fontWeight: '700' }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void handleGenerateFlow()}
                disabled={genBusy || !genPrompt.trim()}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  borderRadius: 14,
                  backgroundColor: colors.sky500,
                  borderWidth: 1.5,
                  borderColor: colors.sky700,
                  opacity: genBusy || !genPrompt.trim() ? 0.55 : pressed ? 0.85 : 1,
                  borderCurve: 'continuous',
                })}>
                {genBusy ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
                <Text style={{ color: '#FFFFFF', fontFamily: wingmanFonts.text, fontSize: 13, fontWeight: '800' }}>
                  {genBusy ? 'Building…' : 'Generate'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
