import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
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
import { stickerShadow, withAlpha, wingmanFonts, wingmanLayout } from '@/features/wingman/theme';

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

function OnboardingDetail({ scene }: { scene: (typeof onboardingScenes)[number] }) {
  const { colors, resolvedTheme } = useWingman();

  if (scene.chips) {
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {scene.chips.map((chip) => (
          <StickerCard
            key={chip}
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
          <StickerCard
            key={app.name}
            style={{
              width: '47%',
              minHeight: 112,
              padding: 12,
              gap: 8,
              justifyContent: 'space-between',
              transform: [{ rotate: `${index % 2 === 0 ? -1 : 1}deg` }],
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
        ))}
      </View>
    );
  }

  if (scene.flows) {
    return (
      <View style={{ gap: 10 }}>
        {scene.flows.map((flow, index) => (
          <StickerCard
            key={flow.title}
            style={{
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderColor: colors.ink,
              transform: [{ rotate: `${index % 2 === 0 ? -0.8 : 0.8}deg` }],
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
        ))}
      </View>
    );
  }

  if (scene.points) {
    return (
      <View style={{ gap: 10 }}>
        {scene.points.map((point) => (
          <StickerCard
            key={point.label}
            style={{
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderColor: colors.ink,
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
                fontSize: 14,
                fontWeight: '700',
                flex: 1,
              }}>
              {point.label}
            </Text>
          </StickerCard>
        ))}
      </View>
    );
  }

  return null;
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
                outputRange: [0, -6],
              }),
            },
          ],
        }}>
        <Image
          source={heroSource}
          contentFit="contain"
          style={{
            width: 138,
            height: 138,
          }}
        />
      </Animated.View>
    </Pressable>
  );
}

export function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { completeOnboarding } = useWingman();
  const scrollViewRef = React.useRef<ScrollView>(null);
  const [scrollY, setScrollY] = React.useState(0);

  const sceneHeight = Math.max(height, 760);
  const sceneIndex = Math.min(
    onboardingScenes.length - 1,
    Math.max(0, Math.round(scrollY / sceneHeight)),
  );
  const currentScene = onboardingScenes[sceneIndex];
  const localProgress = (scrollY % sceneHeight) / sceneHeight;
  const pipOffset = 24 - localProgress * 12;

  const scrollToScene = (nextSceneIndex: number) => {
    scrollViewRef.current?.scrollTo({
      y: nextSceneIndex * sceneHeight,
      animated: true,
    });
  };

  const snapToNearestScene = (offsetY: number) => {
    const nextSceneIndex = Math.min(
      onboardingScenes.length - 1,
      Math.max(0, Math.round(offsetY / sceneHeight)),
    );

    scrollToScene(nextSceneIndex);
  };

  const finishOnboarding = () => {
    completeOnboarding();
    router.replace('/sign-in');
  };

  return (
    <View
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
          {onboardingScenes.map((scene, index) => {
            const active = index === sceneIndex;
            return (
              <Pressable
                key={scene.id}
                onPress={() => scrollToScene(index)}
                style={{
                  width: active ? 22 : 8,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: active ? currentScene.accent : withAlpha('#1B2240', 0.18),
                }}
              />
            );
          })}
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

      <ScrollView
        ref={scrollViewRef}
        pagingEnabled
        snapToInterval={sceneHeight}
        snapToAlignment="start"
        disableIntervalMomentum
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          snapToNearestScene(event.nativeEvent.contentOffset.y);
        }}
        onScrollEndDrag={(event) => {
          snapToNearestScene(event.nativeEvent.contentOffset.y);
        }}
        onScroll={(event) => {
          setScrollY(event.nativeEvent.contentOffset.y);
        }}
        scrollEventThrottle={16}>
        {onboardingScenes.map((scene, index) => (
          <View
            key={scene.id}
            style={{
              minHeight: sceneHeight,
              paddingTop: insets.top + 74,
              paddingBottom: 132,
              paddingHorizontal: wingmanLayout.screenPadding,
              justifyContent: 'center',
              backgroundColor: scene.bg,
            }}>
            <View
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
              }}>
              <Text
                style={{
                  color: '#7C8299',
                  fontFamily: wingmanFonts.text,
                  fontSize: 11,
                  fontWeight: '800',
                  letterSpacing: 0.8,
                }}>
                {`${String(index + 1).padStart(2, '0')} / ${String(onboardingScenes.length).padStart(2, '0')}`}
              </Text>
            </View>

            <View
              style={{
                gap: 14,
                transform: [{ translateY: index === sceneIndex ? 0 : 18 }],
                opacity: index === sceneIndex ? 1 : 0.85,
              }}>
              <WingmanLabel color={scene.accent}>{scene.eyebrow}</WingmanLabel>
              <Text
                style={{
                  color: '#1B2240',
                  fontFamily: wingmanFonts.display,
                  fontSize: 38,
                  fontWeight: '700',
                  lineHeight: 40,
                  letterSpacing: -1.1,
                  maxWidth: 300,
                }}>
                {scene.title}
              </Text>
              <Text
                style={{
                  color: '#2D3555',
                  fontFamily: wingmanFonts.text,
                  fontSize: 16,
                  fontWeight: '500',
                  lineHeight: 24,
                  maxWidth: 330,
                }}>
                {scene.body}
              </Text>
              <View style={{ marginTop: 12 }}>
                <OnboardingDetail scene={scene} />
              </View>
              {scene.id === 'privacy' ? (
                <View style={{ marginTop: 18, maxWidth: 190 }}>
                  <WingmanButton onPress={() => router.replace('/create-account' as never)} iconRight="arrow-right">
                    Continue
                  </WingmanButton>
                </View>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          right: 12,
          bottom: 42 + insets.bottom,
          zIndex: 10,
          transform: [{ translateY: pipOffset * 0.45 }],
        }}>
        <OnboardingBirdRibbon
          sceneId={currentScene.id}
          onPress={() => {
            if (sceneIndex < onboardingScenes.length - 1) {
              scrollToScene(sceneIndex + 1);
              return;
            }

            finishOnboarding();
          }}
        />
      </View>
    </View>
  );
}
