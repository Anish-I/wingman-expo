import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import React from 'react';
import {
  type ImageStyle,
  Pressable,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PipVariant } from '@/features/wingman/data';
import { useWingman } from '@/features/wingman/provider';
import {
  coralShadow,
  skyShadow,
  stickerShadow,
  sunShadow,
  withAlpha,
  type ThemeMode,
  wingmanFonts,
  wingmanLayout,
} from '@/features/wingman/theme';

const pipAssets: Record<PipVariant, number> = {
  '404': require('@/assets/pip/pip-404.png'),
  alert: require('@/assets/pip/pip-alert.png'),
  angry: require('@/assets/pip/pip-angry.png'),
  business: require('@/assets/pip/pip-business.png'),
  calendar: require('@/assets/pip/pip-calendar.png'),
  checkmark: require('@/assets/pip/pip-checkmark.png'),
  clap: require('@/assets/pip/pip-clap.png'),
  coding: require('@/assets/pip/pip-coding.png'),
  coffee: require('@/assets/pip/pip-coffee.png'),
  cool: require('@/assets/pip/pip-cool.png'),
  crying: require('@/assets/pip/pip-crying.png'),
  dab: require('@/assets/pip/pip-dab.png'),
  eating: require('@/assets/pip/pip-eating.png'),
  excited: require('@/assets/pip/pip-excited.png'),
  fail: require('@/assets/pip/pip-fail.png'),
  flying: require('@/assets/pip/pip-flying.png'),
  gg: require('@/assets/pip/pip-gg.png'),
  happy: require('@/assets/pip/pip-happy.png'),
  headband: require('@/assets/pip/pip-headband.png'),
  hypnotized: require('@/assets/pip/pip-hypnotized.png'),
  love: require('@/assets/pip/pip-love.png'),
  ninja: require('@/assets/pip/pip-ninja.png'),
  overwhelmed: require('@/assets/pip/pip-overwhelmed.png'),
  question: require('@/assets/pip/pip-question.png'),
  sad: require('@/assets/pip/pip-sad.png'),
  sleeping: require('@/assets/pip/pip-sleeping.png'),
  surprised: require('@/assets/pip/pip-surprised.png'),
  thinking: require('@/assets/pip/pip-thinking.png'),
  thumbsup: require('@/assets/pip/pip-thumbsup.png'),
  wave: require('@/assets/pip/pip-wave.png'),
  worried: require('@/assets/pip/pip-worried.png'),
};

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const iconMap = {
  search: { ion: 'search', fallback: '⌕' },
  sparkles: { ion: 'sparkles', fallback: '✦' },
  mic: { ion: 'mic', fallback: '◉' },
  mail: { ion: 'mail', fallback: '✉' },
  time: { ion: 'time', fallback: '⏰' },
  music: { ion: 'musical-notes', fallback: '♪' },
  plus: { ion: 'add', fallback: '+' },
  'arrow-down': { ion: 'arrow-down', fallback: '↓' },
  'arrow-up': { ion: 'arrow-up', fallback: '↑' },
  'arrow-right': { ion: 'arrow-forward', fallback: '→' },
  'chevron-left': { ion: 'chevron-back', fallback: '‹' },
  'chevron-right': { ion: 'chevron-forward', fallback: '›' },
  edit: { ion: 'create-outline', fallback: '✎' },
  ellipsis: { ion: 'ellipsis-horizontal', fallback: '⋯' },
  checkmark: { ion: 'checkmark', fallback: '✓' },
  'lock-closed': { ion: 'lock-closed', fallback: '🔒' },
  'eye-off': { ion: 'eye-off', fallback: '🙈' },
  trash: { ion: 'trash', fallback: '🗑' },
  home: { ion: 'home', fallback: '⌂' },
  chat: { ion: 'chatbubble-ellipses', fallback: '💬' },
  activity: { ion: 'time', fallback: '◎' },
  flows: { ion: 'flash', fallback: '✦' },
  settings: { ion: 'settings', fallback: '⚙' },
  moon: { ion: 'moon', fallback: '☾' },
  sun: { ion: 'sunny', fallback: '☀' },
  notifications: { ion: 'notifications', fallback: '🔔' },
  'shield-checkmark': { ion: 'shield-checkmark', fallback: '🛡' },
  'help-circle': { ion: 'help-circle', fallback: '?' },
  phone: { ion: 'call', fallback: '✆' },
  apps: { ion: 'grid', fallback: '▦' },
  apple: { ion: 'logo-apple', fallback: '' },
  google: { ion: 'logo-google', fallback: 'G' },
} satisfies Record<string, { ion: IoniconName; fallback: string }>;

type IconName = keyof typeof iconMap;

export function Pip({
  variant = 'happy',
  size = 56,
  style,
}: {
  variant?: PipVariant;
  size?: number;
  style?: ImageStyle;
}) {
  return (
    <Image
      source={pipAssets[variant]}
      contentFit="contain"
      style={[
        {
          width: size,
          height: size,
        },
        style,
      ]}
    />
  );
}

export function PipCircle({
  variant = 'happy',
  size = 36,
  ring = true,
  backgroundColor,
}: {
  variant?: PipVariant;
  size?: number;
  ring?: boolean;
  backgroundColor?: string;
}) {
  const { colors, resolvedTheme } = useWingman();

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: backgroundColor ?? colors.sky100,
        borderWidth: ring ? 2 : 0,
        borderColor: colors.card,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        boxShadow: stickerShadow(resolvedTheme),
      }}>
      <Pip
        variant={variant}
        size={size * 1.18}
        style={{ transform: [{ translateY: size * 0.02 }] }}
      />
    </View>
  );
}

export function IconGlyph({
  name,
  color,
  size = 18,
  style,
}: {
  name: IconName;
  color: string;
  size?: number;
  style?: TextStyle | ImageStyle;
}) {
  const icon = iconMap[name];

  return (
    <Ionicons
      accessible={false}
      importantForAccessibility="no"
      name={icon.ion}
      color={color}
      size={size}
      style={[
        {
          textAlign: 'center',
          includeFontPadding: false,
        },
        style as TextStyle,
      ]}
    />
  );
}

export function StickerCard({
  children,
  style,
  backgroundColor,
  borderColor,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  backgroundColor?: string;
  borderColor?: string;
}) {
  const { colors, resolvedTheme } = useWingman();

  return (
    <View
      style={[
        {
          backgroundColor: backgroundColor ?? colors.card,
          borderColor: borderColor ?? colors.border,
          borderWidth: 1.5,
          borderRadius: wingmanLayout.radiusLg,
          boxShadow: stickerShadow(resolvedTheme),
          borderCurve: 'continuous',
        },
        style,
      ]}>
      {children}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'social' | 'ghost' | 'sun' | 'coral';

export function WingmanButton({
  children,
  onPress,
  variant = 'primary',
  iconLeft,
  iconRight,
  fullWidth = false,
  disabled = false,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  iconLeft?: IconName;
  iconRight?: IconName;
  fullWidth?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const { colors, resolvedTheme } = useWingman();

  const palette = {
    primary: {
      backgroundColor: colors.sky500,
      borderColor: colors.sky700,
      textColor: '#FFFFFF',
      shadow: skyShadow(),
    },
    secondary: {
      backgroundColor: colors.ink,
      borderColor: colors.ink,
      textColor: colors.fgInverse,
      shadow: stickerShadow(resolvedTheme),
    },
    social: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      textColor: colors.ink,
      shadow: stickerShadow(resolvedTheme),
    },
    ghost: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      textColor: colors.ink,
      shadow: 'none',
    },
    sun: {
      backgroundColor: colors.sun400,
      borderColor: colors.sun500,
      textColor: colors.ink,
      shadow: sunShadow(),
    },
    coral: {
      backgroundColor: colors.coral500,
      borderColor: colors.coral500,
      textColor: '#FFFFFF',
      shadow: coralShadow(),
    },
  }[variant];

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 54,
          paddingHorizontal: 22,
          borderRadius: 16,
          borderWidth: variant === 'ghost' ? 0 : 1.5,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          width: fullWidth ? '100%' : undefined,
          position: 'relative',
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
          boxShadow: palette.shadow,
          opacity: disabled ? 0.45 : 1,
          transform: [{ translateY: pressed && !disabled ? 2 : 0 }],
          borderCurve: 'continuous',
        },
        style,
      ]}>
      {iconLeft ? (
        <IconGlyph
          name={iconLeft}
          color={palette.textColor}
          size={18}
          style={fullWidth ? { position: 'absolute', left: 18 } : undefined}
        />
      ) : null}
      <Text
        style={{
          color: palette.textColor,
          fontFamily: wingmanFonts.text,
          fontWeight: '800',
          fontSize: 16,
          letterSpacing: 0.1,
          textAlign: 'center',
          paddingHorizontal: fullWidth && (iconLeft || iconRight) ? 24 : 0,
        }}>
        {children}
      </Text>
      {iconRight ? (
        <IconGlyph
          name={iconRight}
          color={palette.textColor}
          size={18}
          style={fullWidth ? { position: 'absolute', right: 18 } : undefined}
        />
      ) : null}
    </Pressable>
  );
}

export function WingmanLabel({
  children,
  color,
  textColor,
}: {
  children: React.ReactNode;
  color?: string;
  textColor?: string;
}) {
  const { colors } = useWingman();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          backgroundColor: color ?? colors.sky500,
        }}
      />
      <Text
        style={{
          color: textColor ?? colors.fgMuted,
          fontFamily: wingmanFonts.text,
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        }}>
        {children}
      </Text>
    </View>
  );
}

export function StatusPill({
  children,
  color,
  backgroundColor,
}: {
  children: React.ReactNode;
  color: string;
  backgroundColor: string;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor,
      }}>
      <Text
        style={{
          color,
          fontFamily: wingmanFonts.text,
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 0.4,
        }}>
        {children}
      </Text>
    </View>
  );
}

export function WingmanToggle({
  value,
  onValueChange,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { colors } = useWingman();
  const progress = useDerivedValue(
    () => withSpring(value ? 1 : 0, { damping: 16, stiffness: 220, mass: 0.6 }),
    [value],
  );

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.section, colors.sky500],
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.borderStrong, colors.sky700],
    ),
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 18 }],
  }));

  return (
    <Pressable
      onPress={(event) => {
        event.stopPropagation();
        onValueChange(!value);
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}>
      <Animated.View
        style={[
          {
            width: 46,
            height: 28,
            borderRadius: 999,
            borderWidth: 1.5,
            padding: 2,
            justifyContent: 'center',
            borderCurve: 'continuous',
          },
          trackStyle,
        ]}>
        <Animated.View
          style={[
            {
              width: 22,
              height: 22,
              borderRadius: 999,
              backgroundColor: '#FFFFFF',
            },
            knobStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
}) {
  const { colors, resolvedTheme } = useWingman();
  const [width, setWidth] = React.useState(0);
  const activeIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const segmentWidth = width > 0 ? (width - 8) / options.length : 0;

  return (
    <View
      onLayout={(event) => {
        setWidth(event.nativeEvent.layout.width);
      }}
      style={{
        padding: 4,
        borderRadius: 16,
        flexDirection: 'row',
        position: 'relative',
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: colors.section,
        borderCurve: 'continuous',
      }}>
      {segmentWidth > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 4,
            left: 4 + activeIndex * segmentWidth,
            width: segmentWidth,
            bottom: 4,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.card,
            boxShadow: stickerShadow(resolvedTheme),
            borderCurve: 'continuous',
          }}
        />
      ) : null}
      {options.map((option) => {
        const active = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              minHeight: 40,
              borderRadius: 12,
              borderWidth: 0,
              backgroundColor: 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              borderCurve: 'continuous',
            }}>
            <Text
              style={{
                color: active ? colors.ink : colors.fgMuted,
                fontFamily: wingmanFonts.text,
                fontSize: 13,
                fontWeight: '800',
              }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({
  label,
  icon,
  tint,
  active = false,
  onPress,
}: {
  label: string;
  icon?: IconName;
  tint: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const { colors, resolvedTheme } = useWingman();

  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: active ? tint : colors.border,
        backgroundColor: active ? tint : colors.card,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        boxShadow: active ? 'none' : stickerShadow(resolvedTheme),
        borderCurve: 'continuous',
      }}>
      {icon ? (
        <IconGlyph
          name={icon}
          color={active ? '#FFFFFF' : tint}
          size={14}
        />
      ) : null}
      <Text
        style={{
          color: active ? '#FFFFFF' : colors.ink,
          fontFamily: wingmanFonts.text,
          fontSize: 13,
          fontWeight: '800',
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  eyebrow,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useWingman();

  return (
    <View
      style={{
        paddingTop: Math.max(insets.top + 14, 18),
        paddingHorizontal: wingmanLayout.screenPadding,
        paddingBottom: 16,
        gap: 10,
      }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              borderWidth: 1.5,
              borderColor: colors.border,
              backgroundColor: colors.card,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <IconGlyph name="chevron-left" color={colors.ink} size={20} />
          </Pressable>
        ) : (
          <View />
        )}
        {right ?? <View />}
      </View>

      {eyebrow ? <WingmanLabel>{eyebrow}</WingmanLabel> : null}

      <View style={{ gap: 6 }}>
        <Text
          style={{
            color: colors.fgPrimary,
            fontFamily: wingmanFonts.display,
            fontSize: 30,
            fontWeight: '700',
            letterSpacing: -0.8,
            lineHeight: 32,
          }}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              color: colors.fgSecondary,
              fontFamily: wingmanFonts.text,
              fontSize: 14,
              fontWeight: '500',
              lineHeight: 20,
            }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function SectionGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const { colors, resolvedTheme } = useWingman();
  const items = React.Children.toArray(children);

  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          color: colors.fgMuted,
          fontFamily: wingmanFonts.text,
          fontSize: 12,
          fontWeight: '800',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          paddingHorizontal: wingmanLayout.screenPadding,
        }}>
        {label}
      </Text>
      <View
        style={{
          marginHorizontal: wingmanLayout.screenPadding,
          borderRadius: wingmanLayout.radiusLg,
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: colors.card,
          overflow: 'hidden',
          boxShadow: stickerShadow(resolvedTheme),
          borderCurve: 'continuous',
        }}>
        {items.map((child, index) => (
          <React.Fragment key={`group-item-${index}`}>
            {index > 0 ? (
              <View
                style={{
                  height: 1,
                  marginHorizontal: 14,
                  backgroundColor: colors.border,
                }}
              />
            ) : null}
            {child}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

export function SettingsRow({
  icon,
  label,
  color,
  value,
  right,
  onPress,
  destructive = false,
}: {
  icon: IconName;
  label: string;
  color: string;
  value?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const { colors } = useWingman();

  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          borderWidth: 1.5,
          borderColor: withAlpha(color, 0.45),
          backgroundColor: withAlpha(color, 0.16),
          alignItems: 'center',
          justifyContent: 'center',
          borderCurve: 'continuous',
        }}>
        <IconGlyph name={icon} color={color} size={16} />
      </View>
      <Text
        style={{
          flex: 1,
          color: destructive ? colors.coral500 : colors.ink,
          fontFamily: wingmanFonts.text,
          fontSize: 15,
          fontWeight: '700',
        }}>
        {label}
      </Text>
      {value ? (
        <Text
          style={{
            color: colors.fgMuted,
            fontFamily: wingmanFonts.text,
            fontSize: 12,
            fontWeight: '700',
          }}>
          {value}
        </Text>
      ) : null}
      {right ?? <IconGlyph name="chevron-right" color={colors.fgMuted} size={16} />}
    </Pressable>
  );
}

export function TypingDots({ color }: { color: string }) {
  return (
    <Text
      style={{
        color,
        fontFamily: wingmanFonts.text,
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 4,
      }}>
      ...
    </Text>
  );
}

export function ThemeModePill({ themeMode }: { themeMode: ThemeMode }) {
  const { colors } = useWingman();

  const label = themeMode === 'auto' ? 'Auto' : themeMode === 'dark' ? 'Dark' : 'Light';

  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: withAlpha(colors.sky500, 0.12),
      }}>
      <Text
        style={{
          color: colors.sky700,
          fontFamily: wingmanFonts.text,
          fontSize: 11,
          fontWeight: '800',
        }}>
        {label}
      </Text>
    </View>
  );
}
