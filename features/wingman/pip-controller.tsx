import { usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PipVariant } from '@/features/wingman/data';
import { useWingman } from '@/features/wingman/provider';
import { Pip } from '@/features/wingman/primitives';
import { stickerShadow, withAlpha, wingmanFonts } from '@/features/wingman/theme';

/**
 * Pip companion controller.
 *
 * Phase 1 (Light Pip): one persistent, app-level mascot that idles in the corner
 * and reacts to real events (greets on open, claps on a flow run, etc.).
 *
 * Why a controller + a single global overlay instead of per-screen Pips: this is
 * the seam Phase 3 (Full Pip — flies around, controls navigation) extends. The
 * mascot is already mounted once above the whole app and driven by an imperative
 * `play()` API, so Phase 3 adds movement/navigation to THIS controller rather
 * than rebuilding the mascot. Keep all Pip behavior flowing through here.
 */

export type PipEmote =
  | 'idle' | 'wave' | 'clap' | 'excited' | 'love'
  | 'thinking' | 'sad' | 'cool' | 'sleeping';

const EMOTE_VARIANT: Record<PipEmote, PipVariant> = {
  idle: 'happy',
  wave: 'wave',
  clap: 'clap',
  excited: 'excited',
  love: 'love',
  thinking: 'thinking',
  sad: 'sad',
  cool: 'cool',
  sleeping: 'sleeping',
};

type PlayOptions = { say?: string; ms?: number };

type PipState = { emote: PipEmote; tick: number; say: string | null; visible: boolean };

type PipControllerValue = {
  /** Play a one-shot emote (optionally with a speech bubble), then settle to idle. */
  play: (emote: PipEmote, opts?: PlayOptions) => void;
  /** Force-hide/show the mascot (e.g. during a full-screen flow). */
  setVisible: (visible: boolean) => void;
  state: PipState;
};

const NOOP: PipControllerValue = {
  play: () => {},
  setVisible: () => {},
  state: { emote: 'idle', tick: 0, say: null, visible: true },
};

const PipControllerContext = React.createContext<PipControllerValue | null>(null);

/** Call from anywhere to make Pip react. Safe outside the provider (no-ops). */
export function usePipController(): PipControllerValue {
  return React.useContext(PipControllerContext) ?? NOOP;
}

const DEFAULT_EMOTE_MS = 2200;

export function PipControllerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<PipState>({ emote: 'idle', tick: 0, say: null, visible: true });
  const resetRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const play = React.useCallback((emote: PipEmote, opts?: PlayOptions) => {
    setState((s) => ({ ...s, emote, tick: s.tick + 1, say: opts?.say ?? null }));
    if (resetRef.current) clearTimeout(resetRef.current);
    if (emote !== 'idle') {
      resetRef.current = setTimeout(() => {
        setState((s) => ({ ...s, emote: 'idle', say: null }));
      }, opts?.ms ?? DEFAULT_EMOTE_MS);
    }
  }, []);

  const setVisible = React.useCallback((visible: boolean) => {
    setState((s) => ({ ...s, visible }));
  }, []);

  React.useEffect(() => () => {
    if (resetRef.current) clearTimeout(resetRef.current);
  }, []);

  const value = React.useMemo<PipControllerValue>(() => ({ play, setVisible, state }), [play, setVisible, state]);

  return (
    <PipControllerContext.Provider value={value}>
      {children}
    </PipControllerContext.Provider>
  );
}

// Routes that have their own Pip presence (or shouldn't show the mascot).
const HIDDEN_ROUTE_HINTS = ['chat', 'flow-builder', 'onboarding', 'sign-in', 'create-account', 'ui-critique', 'pip-idle'];

/**
 * The single global mascot overlay. Mount once inside the app shell (above the
 * navigator). Reads controller state; renders an idle-bobbing Pip that pops +
 * swaps expression on each emote, with an optional speech bubble.
 */
export function GlobalPip() {
  const ctx = React.useContext(PipControllerContext);
  const { authStage, colors, resolvedTheme } = useWingman();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const bob = useSharedValue(0);
  const pop = useSharedValue(1);
  const greetedRef = React.useRef(false);

  const hiddenRoute = HIDDEN_ROUTE_HINTS.some((hint) => pathname.includes(hint));
  const show = authStage === 'authenticated' && (ctx?.state.visible ?? true) && !hiddenRoute;

  // Gentle idle bob, always running while mounted.
  React.useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [bob]);

  // Pop on each emote.
  const tick = ctx?.state.tick ?? 0;
  React.useEffect(() => {
    if (tick === 0) return;
    pop.value = withSequence(
      withSpring(1.22, { damping: 9, stiffness: 220 }),
      withSpring(1, { damping: 12, stiffness: 220 }),
    );
  }, [tick, pop]);

  // Greet once when Pip first appears for an authenticated session.
  React.useEffect(() => {
    if (show && ctx && !greetedRef.current) {
      greetedRef.current = true;
      const t = setTimeout(() => ctx.play('wave', { say: 'Coo! 👋', ms: 2400 }), 650);
      return () => clearTimeout(t);
    }
    if (authStage !== 'authenticated') greetedRef.current = false;
  }, [show, ctx, authStage]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }, { scale: pop.value }],
  }));

  if (!ctx || !show) return null;

  const variant = EMOTE_VARIANT[ctx.state.emote];
  const say = ctx.state.say;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: 10,
        bottom: Math.max(insets.bottom, 12) + 76,
        alignItems: 'flex-end',
        zIndex: 50,
      }}>
      {say ? (
        <View
          style={{
            maxWidth: 180,
            marginBottom: 6,
            marginRight: 6,
            paddingHorizontal: 11,
            paddingVertical: 7,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.card,
            boxShadow: stickerShadow(resolvedTheme),
            borderCurve: 'continuous',
          }}>
          <Text
            numberOfLines={2}
            style={{
              color: colors.ink,
              fontFamily: wingmanFonts.text,
              fontSize: 12,
              fontWeight: '800',
            }}>
            {say}
          </Text>
        </View>
      ) : null}

      <Animated.View style={animatedStyle}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pip"
          onPress={() => {
            Haptics.selectionAsync().catch(() => undefined);
            ctx.play('love', { say: 'Hi! 💙', ms: 1600 });
          }}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: withAlpha(colors.sky500, resolvedTheme === 'dark' ? 0.18 : 0.12),
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: stickerShadow(resolvedTheme),
            borderCurve: 'continuous',
          }}>
          <Pip variant={variant} size={46} />
        </Pressable>
      </Animated.View>
    </View>
  );
}
