import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import RNAnimated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { onboardingScenes } from '@/features/wingman/data';
import { useWingman } from '@/features/wingman/provider';
import {
  IconGlyph,
  StickerCard,
  WingmanButton,
  WingmanLabel,
  WingmanToggle,
} from '@/features/wingman/primitives';
import {
  stickerShadow,
  withAlpha,
  wingmanFonts,
  wingmanLayout,
  wingmanTypography,
} from '@/features/wingman/theme';

const onboardingBirdAssets = {
  hello: require('@/assets/onboarding-birds/happy-sparkles-clean.png'),
  text: require('@/assets/onboarding-birds/love-heart-clean.png'),
  apps: require('@/assets/onboarding-birds/coding-laptop-clean.png'),
  flows: require('@/assets/onboarding-birds/checklist-yes-clean.png'),
  privacy: require('@/assets/onboarding-birds/thinking-bubble-clean.png'),
  trailThinking: require('@/assets/onboarding-birds/thinking-bubble-clean.png'),
  trailSad: require('@/assets/onboarding-birds/sad-tear-clean.png'),
  trailLove: require('@/assets/onboarding-birds/love-heart-clean.png'),
  trailChecklist: require('@/assets/onboarding-birds/checklist-yes-clean.png'),
} as const;

const onboardingHeroBirds = {
  hello: onboardingBirdAssets.hello,
  text: onboardingBirdAssets.text,
  apps: onboardingBirdAssets.apps,
  flows: onboardingBirdAssets.flows,
  privacy: onboardingBirdAssets.privacy,
} as const;

const onboardingTitleWidths: Record<string, number> = {
  hello: 310,
  text: 340,
  apps: 360,
  flows: 330,
  privacy: 320,
};

// Two little Pip pals per scene — they drift around the edges for extra life.
const scenePipPals: Record<string, [number, number]> = {
  hello: [require('@/assets/pip/pip-wave.png'), require('@/assets/pip/pip-excited.png')],
  text: [require('@/assets/pip/pip-love.png'), require('@/assets/pip/pip-happy.png')],
  apps: [require('@/assets/pip/pip-coding.png'), require('@/assets/pip/pip-cool.png')],
  flows: [require('@/assets/pip/pip-checkmark.png'), require('@/assets/pip/pip-clap.png')],
  privacy: [require('@/assets/pip/pip-ninja.png'), require('@/assets/pip/pip-thumbsup.png')],
};

/** A small Pip that floats up/down (and sways a touch) forever. */
function FloatingPip({
  source,
  size,
  duration,
  delay = 0,
  style,
}: {
  source: number;
  size: number;
  duration: number;
  delay?: number;
  style?: React.ComponentProps<typeof View>['style'];
}) {
  const drift = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(drift, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [delay, drift, duration]);

  return (
    <View pointerEvents="none" style={style}>
      <RNAnimated.View entering={ZoomIn.delay(220 + delay).duration(320)}>
        <Animated.View
          style={{
            transform: [
              { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -9] }) },
              { rotate: drift.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] }) },
            ],
          }}>
          <Image source={source} contentFit="contain" style={{ width: size, height: size }} />
        </Animated.View>
      </RNAnimated.View>
    </View>
  );
}

function OnboardingDetail({ scene }: { scene: (typeof onboardingScenes)[number] }) {
  const { colors, resolvedTheme } = useWingman();

  if (scene.chips) {
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {scene.chips.map((chip, index) => (
          <RNAnimated.View key={chip} entering={ZoomIn.delay(180 + index * 90).duration(260)}>
            <StickerCard
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderColor: colors.ink,
                alignSelf: 'flex-start',
              }}>
              <Text
                style={{
                  color: colors.ink,
                  fontFamily: wingmanFonts.text,
                  fontSize: 13,
                  fontWeight: '800',
                }}>
                {chip}
              </Text>
            </StickerCard>
          </RNAnimated.View>
        ))}
      </View>
    );
  }

  if (scene.sample && scene.reply) {
    return (
      <View style={{ gap: 10, maxWidth: 320 }}>
        <View
          style={{
            alignSelf: 'flex-end',
            maxWidth: '85%',
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: 20,
            borderBottomRightRadius: 6,
            backgroundColor: colors.sky500,
            borderWidth: 1.5,
            borderColor: colors.sky700,
            boxShadow: '0 4px 0 rgba(29, 78, 216, 0.20), 0 10px 24px rgba(59, 130, 246, 0.34)',
            borderCurve: 'continuous',
          }}>
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: wingmanFonts.text,
              fontSize: 15,
              fontWeight: '500',
              lineHeight: 21,
            }}>
            {scene.sample}
          </Text>
        </View>
        <StickerCard
          style={{
            maxWidth: '85%',
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderColor: colors.ink,
            alignSelf: 'flex-start',
            borderBottomLeftRadius: 6,
          }}>
          <Text
            style={{
              color: colors.ink,
              fontFamily: wingmanFonts.text,
              fontSize: 15,
              fontWeight: '500',
              lineHeight: 21,
            }}>
            {scene.reply}
          </Text>
        </StickerCard>
      </View>
    );
  }

  if (scene.apps) {
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {scene.apps.map((app, index) => (
          <RNAnimated.View key={app.name} entering={FadeInDown.delay(160 + index * 80).duration(280)} style={{ width: '47%' }}>
          <StickerCard
            style={{
              minHeight: 112,
              padding: 12,
              gap: 8,
              justifyContent: 'space-between',
              borderColor: colors.ink,
              boxShadow: stickerShadow(resolvedTheme),
            }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: withAlpha(app.color, 0.4),
                backgroundColor: withAlpha(app.color, 0.14),
                alignItems: 'center',
                justifyContent: 'center',
                borderCurve: 'continuous',
              }}>
              <Text style={{ fontSize: 20 }}>{app.emoji}</Text>
            </View>
            <Text
              style={{
                color: colors.ink,
                fontFamily: wingmanFonts.text,
                fontSize: 12,
                fontWeight: '800',
              }}>
              {app.name}
            </Text>
          </StickerCard>
          </RNAnimated.View>
        ))}
      </View>
    );
  }

  if (scene.flows) {
    return (
      <View style={{ gap: 10 }}>
        {scene.flows.map((flow, index) => (
          <RNAnimated.View key={flow.title} entering={FadeInDown.delay(160 + index * 90).duration(280)}>
          <StickerCard
            style={{
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderColor: colors.ink,
            }}>
            <Text style={{ fontSize: 22 }}>{flow.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.ink,
                  fontFamily: wingmanFonts.text,
                  fontSize: 14,
                  fontWeight: '800',
                }}>
                {flow.title}
              </Text>
              <Text
                style={{
                  color: colors.fgMuted,
                  fontFamily: wingmanFonts.text,
                  fontSize: 12,
                  fontWeight: '700',
                }}>
                {flow.time}
              </Text>
            </View>
            <WingmanToggle value onValueChange={() => undefined} />
          </StickerCard>
          </RNAnimated.View>
        ))}
      </View>
    );
  }

  if (scene.points) {
    const [primaryPoint, ...secondaryPoints] = scene.points;

    return (
      <View style={{ gap: 10 }}>
        {primaryPoint ? (
          <StickerCard
            style={{
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              borderColor: colors.ink,
            }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: colors.mint500,
                backgroundColor: colors.mint100,
                alignItems: 'center',
                justifyContent: 'center',
                borderCurve: 'continuous',
              }}>
              <IconGlyph name={primaryPoint.icon as 'lock-closed'} color={colors.mint500} size={19} />
            </View>
            <Text
              style={{
                color: colors.ink,
                fontFamily: wingmanFonts.text,
                fontSize: 15,
                fontWeight: '800',
                flex: 1,
              }}>
              {primaryPoint.label}
            </Text>
          </StickerCard>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {secondaryPoints.map((point) => (
            <StickerCard
              key={point.label}
              style={{
                flex: 1,
                minHeight: 116,
                padding: 14,
                gap: 12,
                borderColor: colors.ink,
                justifyContent: 'space-between',
              }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  borderWidth: 1.5,
                  borderColor: colors.mint500,
                  backgroundColor: colors.mint100,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderCurve: 'continuous',
                }}>
                <IconGlyph name={point.icon as 'lock-closed'} color={colors.mint500} size={17} />
              </View>
              <Text
                style={{
                  color: colors.ink,
                  fontFamily: wingmanFonts.text,
                  fontSize: 13,
                  fontWeight: '800',
                  lineHeight: 18,
                }}>
                {point.label}
              </Text>
            </StickerCard>
          ))}
        </View>
      </View>
    );
  }

  return null;
}

function SceneBody({
  scene,
  active,
  onContinue,
}: {
  scene: (typeof onboardingScenes)[number];
  active: boolean;
  onContinue: () => void;
}) {
  const progress = useSharedValue(active ? 1 : 0);

  React.useEffect(() => {
    progress.value = withSpring(active ? 1 : 0, { damping: 18, stiffness: 140, mass: 0.9 });
  }, [active, progress]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 22 }],
    opacity: 0.55 + progress.value * 0.45,
  }));

  return (
    <RNAnimated.View style={[{ gap: 14 }, containerStyle]}>
      <RNAnimated.View entering={FadeInDown.duration(240)}>
        <WingmanLabel color={scene.accent}>{scene.eyebrow}</WingmanLabel>
      </RNAnimated.View>
      <RNAnimated.View entering={FadeInDown.delay(60).duration(280)}>
        <Text
          style={{
            color: '#1B2240',
            ...wingmanTypography.onboardingTitle,
            maxWidth: onboardingTitleWidths[scene.id] ?? 320,
          }}>
          {scene.title}
        </Text>
      </RNAnimated.View>
      <RNAnimated.View entering={FadeInDown.delay(120).duration(280)}>
        <Text
          style={{
            color: '#2D3555',
            ...wingmanTypography.onboardingBody,
            maxWidth: 330,
          }}>
          {scene.body}
        </Text>
      </RNAnimated.View>
      <View style={{ marginTop: 12 }}>
        <OnboardingDetail scene={scene} />
      </View>
      {scene.id === 'privacy' ? (
        <RNAnimated.View entering={FadeInUp.delay(320).duration(300)} style={{ marginTop: 18, maxWidth: 190 }}>
          <WingmanButton fullWidth onPress={onContinue} iconRight="arrow-right">
            Continue
          </WingmanButton>
        </RNAnimated.View>
      ) : null}
    </RNAnimated.View>
  );
}

function PagerDot({
  active,
  accent,
  onPress,
}: {
  active: boolean;
  accent: string;
  onPress: () => void;
}) {
  const progress = useSharedValue(active ? 1 : 0);

  React.useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: 220 });
  }, [active, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: 8 + progress.value * 14,
  }));

  return (
    <Pressable onPress={onPress}>
      <RNAnimated.View
        style={[
          {
            height: 8,
            borderRadius: 999,
            backgroundColor: active ? accent : withAlpha('#1B2240', 0.18),
          },
          animatedStyle,
        ]}
      />
    </Pressable>
  );
}

function OnboardingBirdRibbon({
  sceneId,
  onPress,
}: {
  sceneId: string;
  onPress: () => void;
}) {
  const heroSource = onboardingHeroBirds[sceneId as keyof typeof onboardingHeroBirds] ?? onboardingHeroBirds.hello;
  const bob = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [bob]);

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 152,
        height: 152,
      }}>
      <Animated.View
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          transform: [
            {
              translateY: bob.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -10],
              }),
            },
            {
              rotate: bob.interpolate({
                inputRange: [0, 1],
                outputRange: ['-2deg', '2.5deg'],
              }),
            },
          ],
        }}>
        <RNAnimated.View key={sceneId} entering={ZoomIn.duration(340)}>
          <Image
            source={heroSource}
            contentFit="contain"
            style={{
              width: 138,
              height: 138,
            }}
          />
        </RNAnimated.View>
      </Animated.View>
    </Pressable>
  );
}

export function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { completeOnboarding } = useWingman();
  const [sceneIndex, setSceneIndex] = React.useState(0);
  const [transitionDirection, setTransitionDirection] = React.useState(1);
  const sceneHeight = Math.max(height, 1);
  const currentScene = onboardingScenes[sceneIndex];

  const goToScene = React.useCallback((nextSceneIndex: number) => {
    const boundedIndex = Math.min(
      onboardingScenes.length - 1,
      Math.max(0, nextSceneIndex),
    );

    setSceneIndex((currentIndex) => {
      if (boundedIndex === currentIndex) {
        return currentIndex;
      }

      setTransitionDirection(boundedIndex > currentIndex ? 1 : -1);
      return boundedIndex;
    });
  }, []);

  const goToNextScene = React.useCallback(() => {
    setSceneIndex((currentIndex) => {
      const nextIndex = Math.min(onboardingScenes.length - 1, currentIndex + 1);
      if (nextIndex !== currentIndex) {
        setTransitionDirection(1);
      }
      return nextIndex;
    });
  }, []);

  const goToPreviousScene = React.useCallback(() => {
    setSceneIndex((currentIndex) => {
      const nextIndex = Math.max(0, currentIndex - 1);
      if (nextIndex !== currentIndex) {
        setTransitionDirection(-1);
      }
      return nextIndex;
    });
  }, []);

  const continueToCreateAccount = React.useCallback(() => {
    completeOnboarding();
    router.replace('/create-account' as never);
  }, [completeOnboarding, router]);

  const handleSceneTap = React.useCallback(() => {
    if (sceneIndex >= onboardingScenes.length - 1) {
      continueToCreateAccount();
      return;
    }

    goToNextScene();
  }, [continueToCreateAccount, goToNextScene, sceneIndex]);

  const panResponder = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => (
      Math.abs(gesture.dy) > 12 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.25
    ),
    onPanResponderRelease: (_, gesture) => {
      const shouldAdvance = gesture.dy < -34 || gesture.vy < -0.3;
      const shouldGoBack = gesture.dy > 34 || gesture.vy > 0.3;

      if (shouldAdvance) {
        goToNextScene();
      } else if (shouldGoBack) {
        goToPreviousScene();
      }
    },
  }), [goToNextScene, goToPreviousScene]);

  const finishOnboarding = () => {
    completeOnboarding();
    router.replace('/sign-in');
  };

  return (
    <View
      {...panResponder.panHandlers}
      style={{
        flex: 1,
        backgroundColor: currentScene.bg,
      }}>
      <View
        style={{
          position: 'absolute',
          top: insets.top + 14,
          left: wingmanLayout.screenPadding,
          right: wingmanLayout.screenPadding,
          zIndex: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {onboardingScenes.map((scene, index) => (
            <PagerDot
              key={scene.id}
              active={index === sceneIndex}
              accent={currentScene.accent}
              onPress={() => goToScene(index)}
            />
          ))}
        </View>
        <Pressable onPress={finishOnboarding}>
          <Text
            style={{
              color: '#2D3555',
              fontFamily: wingmanFonts.text,
              fontSize: 13,
              fontWeight: '800',
            }}>
            Skip
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={handleSceneTap}
        key={currentScene.id}
        style={{
          height: sceneHeight,
          paddingTop: insets.top + 74,
          paddingBottom: 132,
          paddingHorizontal: wingmanLayout.screenPadding,
          justifyContent: 'center',
          backgroundColor: currentScene.bg,
        }}>
        <RNAnimated.View
          entering={(transitionDirection > 0 ? FadeInUp : FadeInDown).duration(200)}
          style={{ gap: 14 }}>
          <SceneBody scene={currentScene} active onContinue={continueToCreateAccount} />
        </RNAnimated.View>
      </Pressable>

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: insets.top + 46,
          right: wingmanLayout.screenPadding,
          width: 64,
          paddingVertical: 5,
          borderRadius: 999,
          borderWidth: 1.5,
          borderColor: '#E8DBBF',
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          boxShadow: '0 3px 0 rgba(27, 34, 64, 0.10)',
          zIndex: 20,
        }}>
        <Text
          style={{
            color: '#7C8299',
            fontFamily: wingmanFonts.text,
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 0.8,
          }}>
          {`${String(sceneIndex + 1).padStart(2, '0')} / ${String(onboardingScenes.length).padStart(2, '0')}`}
        </Text>
      </View>

      {/* Pip pals — purely decorative flock, re-keyed per scene so they pop in fresh. */}
      <FloatingPip
        key={`pal-a-${currentScene.id}`}
        source={scenePipPals[currentScene.id]?.[0] ?? scenePipPals.hello[0]}
        size={52}
        duration={1400}
        style={{
          position: 'absolute',
          top: insets.top + 96,
          right: wingmanLayout.screenPadding + 4,
          zIndex: 5,
        }}
      />
      <FloatingPip
        key={`pal-b-${currentScene.id}`}
        source={scenePipPals[currentScene.id]?.[1] ?? scenePipPals.hello[1]}
        size={44}
        duration={1750}
        delay={350}
        style={{
          position: 'absolute',
          bottom: 64 + insets.bottom,
          left: wingmanLayout.screenPadding + 2,
          zIndex: 5,
        }}
      />

      <View
        style={{
          position: 'absolute',
          right: 12,
          bottom: 42 + insets.bottom,
          zIndex: 10,
        }}>
        <OnboardingBirdRibbon
          sceneId={currentScene.id}
          onPress={() => {
            if (sceneIndex < onboardingScenes.length - 1) {
              goToNextScene();
              return;
            }

            finishOnboarding();
          }}
        />
      </View>
    </View>
  );
}
