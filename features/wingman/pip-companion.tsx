import { Image } from 'expo-image';
import React from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  type View as RNView,
} from 'react-native';

export type PipAnchorRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Mode = 'walking' | 'flying-up' | 'nested' | 'flying-down';
type SpriteAnimation = 'walk' | 'glide' | 'clap' | 'wave' | 'idle' | 'idleSparkle' | 'idleBounce';

const SPRITE_FRAMES = [
  require('@/assets/pip-anim/pip-frame-00.png'),
  require('@/assets/pip-anim/pip-frame-01.png'),
  require('@/assets/pip-anim/pip-frame-02.png'),
  require('@/assets/pip-anim/pip-frame-03.png'),
  require('@/assets/pip-anim/pip-frame-04.png'),
  require('@/assets/pip-anim/pip-frame-05.png'),
  require('@/assets/pip-anim/pip-frame-06.png'),
  require('@/assets/pip-anim/pip-frame-07.png'),
  require('@/assets/pip-anim/pip-frame-08.png'),
  require('@/assets/pip-anim/pip-frame-09.png'),
  require('@/assets/pip-anim/pip-frame-10.png'),
  require('@/assets/pip-anim/pip-frame-11.png'),
  require('@/assets/pip-anim/pip-frame-12.png'),
  require('@/assets/pip-anim/pip-frame-13.png'),
  require('@/assets/pip-anim/pip-frame-14.png'),
] as const;

const SPRITE_ANIMATIONS: Record<SpriteAnimation, { frames: readonly number[]; frameMs: number }> = {
  walk: { frames: [0, 1, 2, 3], frameMs: 125 },
  glide: { frames: [8], frameMs: 500 },
  clap: { frames: [6, 7], frameMs: 140 },
  idle: { frames: [8, 9], frameMs: 500 },
  wave: { frames: [10, 10, 11], frameMs: 125 },
  idleSparkle: { frames: [12, 13], frameMs: 240 },
  idleBounce: { frames: [14, 8], frameMs: 260 },
};

const WALK_SPEED_PX_PER_SEC = 38;
const HOP_PERIOD_MS = 720;
const HOP_HEIGHT_PX = 3;
const PAUSE_MIN_MS = 1250;
const PAUSE_RANGE_MS = 2200;
const FLY_UP_MS = 440;
const FLY_DOWN_MS = 390;
const ARC_LIFT_UP = 56;
const ARC_LIFT_DOWN = 32;
const BURST_MS = 700;
const IDLE_EMOTE_ODDS = 0.14;
const FLOOR_CLEARANCE_PX = -2;
const NEST_SCALE = 0.62;
const WAVE_ODDS = 0.12;
const GLIDE_ODDS = 0.34;

export type PipCompanionProps = {
  floor: PipAnchorRect | null;
  nest: PipAnchorRect | null;
  focused?: boolean;
  sendTick?: number;
  size?: number;
};

export function PipCompanion({
  floor,
  nest,
  focused = false,
  sendTick = 0,
  size = 52,
}: PipCompanionProps) {
  const posX = React.useRef(new Animated.Value(0)).current;
  const posY = React.useRef(new Animated.Value(0)).current;
  const hop = React.useRef(new Animated.Value(0)).current;
  const scale = React.useRef(new Animated.Value(1)).current;

  const [animationName, setAnimationName] = React.useState<SpriteAnimation>('idle');
  const [frameOffset, setFrameOffset] = React.useState(0);
  const [ready, setReady] = React.useState(false);
  const [facing, setFacing] = React.useState<1 | -1>(-1);

  const posRef = React.useRef({ x: 0, y: 0 });
  const modeRef = React.useRef<Mode>('walking');
  const walkTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const walkAnimRef = React.useRef<Animated.CompositeAnimation | null>(null);
  const burstTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const waveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const initRef = React.useRef(false);
  const startWalkStepRef = React.useRef<(targetX: number) => void>(() => {});
  const startGlideStepRef = React.useRef<(targetX: number) => void>(() => {});
  const startIdleEmoteThenWalkRef = React.useRef<(targetX: number) => void>(() => {});
  const startWaveThenWalkRef = React.useRef<(targetX: number) => void>(() => {});

  React.useEffect(() => {
    const xId = posX.addListener(({ value }) => {
      posRef.current.x = value;
    });
    const yId = posY.addListener(({ value }) => {
      posRef.current.y = value;
    });
    return () => {
      posX.removeListener(xId);
      posY.removeListener(yId);
    };
  }, [posX, posY]);

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(hop, {
          toValue: 1,
          duration: HOP_PERIOD_MS / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(hop, {
          toValue: 0,
          duration: HOP_PERIOD_MS / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [hop]);

  React.useEffect(() => {
    const spec = SPRITE_ANIMATIONS[animationName];
    setFrameOffset(0);
    if (spec.frames.length <= 1) return;

    const interval = setInterval(() => {
      setFrameOffset((current) => (current + 1) % spec.frames.length);
    }, spec.frameMs);

    return () => clearInterval(interval);
  }, [animationName]);

  const startWaveThenWalk = React.useCallback((targetX: number) => {
    setAnimationName('wave');
    const duration = SPRITE_ANIMATIONS.wave.frames.length * SPRITE_ANIMATIONS.wave.frameMs;
    if (waveTimerRef.current) clearTimeout(waveTimerRef.current);
    waveTimerRef.current = setTimeout(() => {
      startWalkStepRef.current(targetX);
    }, duration);
  }, []);

  React.useEffect(() => {
    startWaveThenWalkRef.current = startWaveThenWalk;
  }, [startWaveThenWalk]);

  const startIdleEmoteThenWalk = React.useCallback((targetX: number) => {
    const nextAnimation: SpriteAnimation = Math.random() < 0.5 ? 'idleSparkle' : 'idleBounce';
    setAnimationName(nextAnimation);
    const duration = SPRITE_ANIMATIONS[nextAnimation].frames.length * SPRITE_ANIMATIONS[nextAnimation].frameMs;
    if (waveTimerRef.current) clearTimeout(waveTimerRef.current);
    waveTimerRef.current = setTimeout(() => {
      startWalkStepRef.current(targetX);
    }, duration);
  }, []);

  React.useEffect(() => {
    startIdleEmoteThenWalkRef.current = startIdleEmoteThenWalk;
  }, [startIdleEmoteThenWalk]);

  const scheduleWalkTick = React.useCallback(
    (delay = PAUSE_MIN_MS + Math.random() * PAUSE_RANGE_MS) => {
      if (walkTimerRef.current) clearTimeout(walkTimerRef.current);
      walkTimerRef.current = setTimeout(() => {
        if (modeRef.current !== 'walking' || !floor) return;
        const margin = 10;
        const minX = floor.x + margin;
        const maxX = floor.x + floor.width - size - margin;
        if (maxX <= minX) return;
        const currentX = posRef.current.x;

        let targetX = currentX - (44 + Math.random() * 42);
        const distance = Math.abs(targetX - currentX);
        const wrapped = targetX < minX || distance < 36;
        if (wrapped) {
          targetX = maxX;
        }

        const roll = Math.random();
        if (wrapped || roll < GLIDE_ODDS) {
          startGlideStepRef.current(targetX);
          return;
        }

        if (roll < GLIDE_ODDS + WAVE_ODDS) {
          startWaveThenWalkRef.current(targetX);
          return;
        }

        if (roll < GLIDE_ODDS + WAVE_ODDS + IDLE_EMOTE_ODDS) {
          startIdleEmoteThenWalkRef.current(targetX);
          return;
        }

        startWalkStepRef.current(targetX);
      }, delay);
    },
    [floor, size],
  );

  const startWalkStep = React.useCallback(
    (targetX: number) => {
      const currentX = posRef.current.x;
      const distance = Math.abs(targetX - currentX);
      const duration = Math.max(420, (distance / WALK_SPEED_PX_PER_SEC) * 1000);
      setFacing(targetX >= currentX ? 1 : -1);

      setAnimationName('walk');
      walkAnimRef.current?.stop();
      walkAnimRef.current = Animated.timing(posX, {
        toValue: targetX,
        duration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      });
      walkAnimRef.current.start(({ finished }) => {
        if (!finished) return;
        if (modeRef.current === 'walking') {
          setAnimationName('idle');
          scheduleWalkTick();
        }
      });
    },
    [posX, scheduleWalkTick],
  );

  React.useEffect(() => {
    startWalkStepRef.current = startWalkStep;
  }, [startWalkStep]);

  const startGlideStep = React.useCallback(
    (targetX: number) => {
      const currentX = posRef.current.x;
      const startY = posRef.current.y;
      const distance = Math.abs(targetX - currentX);
      const duration = Math.max(260, (distance / (WALK_SPEED_PX_PER_SEC * 2)) * 1000);
      const apexY = startY - Math.max(18, Math.min(42, distance * 0.28));

      modeRef.current = 'flying-down';
      setFacing(targetX >= currentX ? 1 : -1);
      setAnimationName('glide');
      walkAnimRef.current?.stop();
      walkAnimRef.current = Animated.parallel([
        Animated.timing(posX, {
          toValue: targetX,
          duration,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(posY, {
            toValue: apexY,
            duration: duration * 0.4,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(posY, {
            toValue: startY,
            duration: duration * 0.6,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]);
      walkAnimRef.current.start(({ finished }) => {
        if (!finished) return;
        modeRef.current = 'walking';
        setAnimationName('idle');
        scheduleWalkTick();
      });
    },
    [posX, posY, scheduleWalkTick],
  );

  React.useEffect(() => {
    startGlideStepRef.current = startGlideStep;
  }, [startGlideStep]);

  React.useEffect(() => {
    if (initRef.current || !floor) return;
    initRef.current = true;
    const margin = Math.max(12, size * 0.25);
    const x = floor.x + floor.width - size - margin;
    const y = floor.y - size - FLOOR_CLEARANCE_PX;
    posX.setValue(x);
    posY.setValue(y);
    posRef.current = { x, y };
    setReady(true);
    modeRef.current = 'walking';
    setAnimationName('idle');
    scheduleWalkTick(0);
  }, [floor, posX, posY, size, scheduleWalkTick]);

  const flyUp = React.useCallback(() => {
    if (!floor || !nest) return;
    modeRef.current = 'flying-up';
    if (walkTimerRef.current) clearTimeout(walkTimerRef.current);
    walkAnimRef.current?.stop();
    setAnimationName('glide');

    const startY = posRef.current.y;
    const endX = nest.x + nest.width / 2 - size / 2;
    const endY = nest.y + nest.height / 2 - size / 2;
    const apexY = Math.min(startY, endY) - ARC_LIFT_UP;
    setFacing(endX >= posRef.current.x ? 1 : -1);

    Animated.parallel([
      Animated.timing(posX, {
        toValue: endX,
        duration: FLY_UP_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(posY, {
          toValue: apexY,
          duration: FLY_UP_MS * 0.48,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(posY, {
          toValue: endY,
          duration: FLY_UP_MS * 0.52,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(scale, {
        toValue: NEST_SCALE,
        duration: FLY_UP_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;
      modeRef.current = 'nested';
      setAnimationName('idle');
    });
  }, [floor, nest, posX, posY, scale, size]);

  const flyDown = React.useCallback(() => {
    if (!floor || !nest) return;
    modeRef.current = 'flying-down';
    setAnimationName('glide');

    const startY = posRef.current.y;
    const margin = 10;
    const minX = floor.x + margin;
    const endX = Math.max(minX, posRef.current.x - (56 + Math.random() * 28));
    const endY = floor.y - size - FLOOR_CLEARANCE_PX;
    const apexY = Math.min(startY, endY) - ARC_LIFT_DOWN;
    setFacing(endX >= posRef.current.x ? 1 : -1);

    Animated.parallel([
      Animated.timing(posX, {
        toValue: endX,
        duration: FLY_DOWN_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(posY, {
          toValue: apexY,
          duration: FLY_DOWN_MS * 0.35,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(posY, {
          toValue: endY,
          duration: FLY_DOWN_MS * 0.65,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(scale, {
        toValue: 1,
        duration: FLY_DOWN_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;
      modeRef.current = 'walking';
      setAnimationName('idle');
      scheduleWalkTick(200);
    });
  }, [floor, nest, posX, posY, scale, size, scheduleWalkTick]);

  React.useEffect(() => {
    if (!ready || !floor || !nest) return;

    if (focused && (modeRef.current === 'walking' || modeRef.current === 'flying-down')) {
      flyUp();
    } else if (!focused && (modeRef.current === 'nested' || modeRef.current === 'flying-up')) {
      flyDown();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, ready, floor, nest]);

  const prevSendTickRef = React.useRef(sendTick);
  React.useEffect(() => {
    if (sendTick === prevSendTickRef.current) return;
    prevSendTickRef.current = sendTick;
    if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
    setAnimationName('clap');
    burstTimerRef.current = setTimeout(() => {
      setAnimationName('idle');
    }, BURST_MS);
  }, [sendTick]);

  React.useEffect(() => {
    if (!ready || !floor) return;
    if (modeRef.current !== 'walking') return;
    const targetY = floor.y - size - FLOOR_CLEARANCE_PX;
    if (Math.abs(posRef.current.y - targetY) < 0.5) return;
    Animated.timing(posY, {
      toValue: targetY,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [floor, ready, size, posY]);

  React.useEffect(() => {
    return () => {
      if (walkTimerRef.current) clearTimeout(walkTimerRef.current);
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      if (waveTimerRef.current) clearTimeout(waveTimerRef.current);
      walkAnimRef.current?.stop();
    };
  }, []);

  const hopOffset = hop.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -HOP_HEIGHT_PX],
  });

  const activeFrames = SPRITE_ANIMATIONS[animationName].frames;
  const frameSource = SPRITE_FRAMES[activeFrames[frameOffset % activeFrames.length]];

  return (
    <Animated.View
      pointerEvents="none"
      style={StyleSheet.absoluteFillObject}>
      {ready ? (
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: size,
            height: size,
            opacity: ready ? 1 : 0,
            transform: [
              { translateX: posX },
              { translateY: posY },
              { translateY: animationName === 'glide' ? 0 : hopOffset },
              { scale },
              { scaleX: facing },
            ],
          }}>
          <Image
            source={frameSource}
            contentFit="contain"
            style={{ width: size, height: size }}
          />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

export type PipCompanionRef = RNView;
