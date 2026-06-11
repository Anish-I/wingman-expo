import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
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
                  fontSize: 14,
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
            backgroundColor: colors.sky700,
            borderWidth: 1.5,
            borderColor: '#1E40AF',
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
              {app.icon ? (
                <MaterialCommunityIcons
                  name={app.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
                  size={22}
                  color={app.color}
                />
              ) : (
                <Text style={{ fontSize: 20 }}>{app.emoji}</Text>
              )}
            </View>
            <Text
              style={{
                color: colors.ink,
                fontFamily: wingmanFonts.text,
                fontSize: 14,
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
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: withAlpha(scene.accent, 0.4),
                backgroundColor: withAlpha(scene.accent, 0.12),
                alignItems: 'center',
                justifyContent: 'center',
                borderCurve: 'continuous',
              }}>
              <Text style={{ fontSize: 19 }}>{flow.emoji}</Text>
            </View>
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
                width: 40,
                height: 40,
                borderRadius: 12,
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
                fontSize: 14,
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
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: colors.mint500,
                  backgroundColor: colors.mint100,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderCurve: 'continuous',
                }}>
                <IconGlyph name={point.icon as 'lock-closed'} color={colors.mint500} size={19} />
              </View>
              <Text
                style={{
                  color: colors.ink,
                  fontFamily: wingmanFonts.text,
                  fontSize: 14,
                  fontWeight: '800',
                  lineHeight: 19,
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
}: {
  scene: (typeof onboardingScenes)[number];
  active: boolean;
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
        <WingmanLabel color={scene.accent} textColor="#3D4566">
          {scene.eyebrow}
        </WingmanLabel>
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
    <Pressable onPress={onPress} hitSlop={{ top: 18, bottom: 18, left: 5, right: 5 }}>
      <RNAnimated.View
        style={[
          {
            height: 8,
            borderRadius: 999,
            backgroundColor: active ? accent : withAlpha('#1B2240', 0.34),
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
        width: 120,
        height: 120,
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
              width: 110,
              height: 110,
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
  const isLastScene = sceneIndex === onboardingScenes.length - 1;

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
        <Pressable
          onPress={finishOnboarding}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
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
          paddingTop: insets.top + 104,
          paddingBottom: 132,
          paddingHorizontal: wingmanLayout.screenPadding,
          justifyContent: 'flex-start',
          backgroundColor: currentScene.bg,
        }}>
        <RNAnimated.View
          entering={(transitionDirection > 0 ? FadeInUp : FadeInDown).duration(200)}
          style={{ gap: 14 }}>
          <SceneBody scene={currentScene} active />
        </RNAnimated.View>
      </Pressable>

      <View
        style={{
          position: 'absolute',
          left: wingmanLayout.screenPadding,
          right: wingmanLayout.screenPadding + 124,
          bottom: 30 + insets.bottom,
          zIndex: 10,
        }}>
        <WingmanButton
          fullWidth
          onPress={isLastScene ? continueToCreateAccount : goToNextScene}
          iconRight="arrow-right"
          style={{ backgroundColor: '#1D4ED8', borderColor: '#1E40AF' }}>
          {isLastScene ? 'Continue' : 'Next'}
        </WingmanButton>
      </View>

      <View
        style={{
          position: 'absolute',
          right: 12,
          bottom: 30 + insets.bottom,
          zIndex: 10,
        }}>
        <OnboardingBirdRibbon
          sceneId={currentScene.id}
          onPress={() => {
            if (sceneIndex < onboardingScenes.length - 1) {
              goToNextScene();
              return;
            }

            continueToCreateAccount();
          }}
        />
      </View>
    </View>
  );
}
