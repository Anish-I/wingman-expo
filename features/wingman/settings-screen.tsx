import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { confirmAction, notify } from '@/features/wingman/confirm';
import { useWingman } from '@/features/wingman/provider';
import { usePipController } from '@/features/wingman/pip-controller';
import {
  IconGlyph,
  ScreenHeader,
  SectionGroup,
  SegmentedControl,
  SettingsRow,
  StickerCard,
  ThemeModePill,
  WingmanToggle,
} from '@/features/wingman/primitives';
import { withAlpha, wingmanFonts, wingmanLayout } from '@/features/wingman/theme';

// Quiet hours are stored as a human string the server's notifier understands
// ("10:30pm - 7:00am", or "Off"). The picker works in minutes-of-day on a
// 30-minute grid (48 slots).
const HALF_HOUR_SLOTS = Array.from({ length: 48 }, (_, i) => i * 30);
const DEFAULT_QUIET_START = 22 * 60; // 10:00pm
const DEFAULT_QUIET_END = 7 * 60; // 7:00am
const ROW_HEIGHT = 38;

function formatSlot(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const period = h24 < 12 ? 'am' : 'pm';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, '0')}${period}`;
}

function formatQuietWindow(start: number, end: number): string {
  return `${formatSlot(start)} - ${formatSlot(end)}`;
}

function parseQuietToken(token: string): number | null {
  const m = token.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (!m) return null;
  const hour = parseInt(m[1]!, 10);
  const minute = m[2] ? parseInt(m[2], 10) : 0;
  if (hour < 1 || hour > 12 || minute > 59) return null;
  return ((hour % 12) + (m[3] === 'pm' ? 12 : 0)) * 60 + minute;
}

function parseQuietWindow(value: string): { start: number; end: number } | null {
  if (!value || value.trim().toLowerCase() === 'off') return null;
  const parts = value.split('-').map((s) => s.trim());
  if (parts.length !== 2) return null;
  const start = parseQuietToken(parts[0]!);
  const end = parseQuietToken(parts[1]!);
  if (start == null || end == null) return null;
  // Snap to the 30-minute grid so picker selection always matches a slot.
  return { start: Math.round(start / 30) * 30 % 1440, end: Math.round(end / 30) * 30 % 1440 };
}

function quietDurationLabel(start: number, end: number): string {
  const span = (end - start + 1440) % 1440;
  const h = Math.floor(span / 60);
  const m = span % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    colors,
    currentUser,
    resolvedTheme,
    settings,
    setMemoryEnabled,
    setPushEnabled,
    setQuietHours,
    setThemeMode,
    themeMode,
    deleteAccount,
    sendTestNotification,
    pushSupported,
    signOut,
  } = useWingman();
  const { play: pipPlay } = usePipController();

  const onSendTest = React.useCallback(async () => {
    await Haptics.selectionAsync();
    const result = await sendTestNotification();
    if (result.ok) {
      notify('Sent', 'A test notification is on its way to this device.');
      pipPlay('wave', { say: 'Ping! 🔔' });
    } else {
      notify('Could not send', result.error ?? 'Push is not available here.');
      pipPlay('sad', { say: 'Hmm, no luck.' });
    }
  }, [sendTestNotification, pipPlay]);

  const onDeleteAccount = React.useCallback(() => {
    void (async () => {
      const confirmed = await confirmAction({
        title: 'Delete your Wingman account?',
        message: "This removes Pip's memory of you, your apps and your flows. This cannot be undone.",
        confirmLabel: 'Delete',
        destructive: true,
      });
      if (!confirmed) return;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await deleteAccount();
    })();
  }, [deleteAccount]);
  const [quietSheetOpen, setQuietSheetOpen] = React.useState(false);
  const openQuietHours = React.useCallback(async () => {
    await Haptics.selectionAsync();
    setQuietSheetOpen(true);
  }, []);
  const onSaveQuietHours = React.useCallback(
    async (next: string) => {
      await Haptics.selectionAsync();
      await setQuietHours(next);
      pipPlay(next.trim().toLowerCase() === 'off' ? 'cool' : 'sleeping', {
        say: next.trim().toLowerCase() === 'off' ? 'Always on ✨' : 'Night night 😴',
      });
    },
    [setQuietHours, pipPlay],
  );

  const onSignOut = React.useCallback(() => {
    void (async () => {
      const confirmed = await confirmAction({
        title: 'Sign out?',
        message: 'You can sign back in any time.',
        confirmLabel: 'Sign out',
        destructive: true,
      });
      if (!confirmed) return;
      try {
        await Haptics.selectionAsync();
      } catch {
        // best-effort
      }
      signOut();
      router.replace('/sign-in');
    })();
  }, [router, signOut]);

  const isDark = resolvedTheme === 'dark';
  const profileName = currentUser?.name?.trim() || '—';
  const profileContact = [currentUser?.phone?.trim(), currentUser?.email?.trim()].filter(Boolean).join(' · ') || '—';
  const initials = (currentUser?.name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '👤';

  return (
    <>
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingBottom: insets.bottom + 140,
        gap: 18,
      }}>
      <ScreenHeader title="Settings" />

      <Animated.View entering={FadeInDown.duration(380).springify().damping(18)}>
      <Pressable
        onPress={() => router.push('/edit-profile' as never)}
        accessibilityRole="button"
        accessibilityLabel="Edit profile">
      <StickerCard
        backgroundColor={isDark ? colors.cardAlt : colors.card}
        borderColor={isDark ? colors.borderStrong : colors.sky200}
        style={{
          marginHorizontal: wingmanLayout.screenPadding,
          padding: 16,
          borderRadius: 22,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}>
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 16,
            backgroundColor: withAlpha(colors.sky500, 0.18),
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text
            style={{
              color: colors.sky700,
              fontFamily: wingmanFonts.text,
              fontSize: 16,
              fontWeight: '800',
            }}>
            {initials}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: colors.fgPrimary,
              fontFamily: wingmanFonts.display,
              fontSize: 19,
              fontWeight: '700',
            }}>
            {profileName}
          </Text>
          <Text
            style={{
              color: colors.fgSecondary,
              fontFamily: wingmanFonts.text,
              fontSize: 12,
              fontWeight: '700',
            }}>
            {profileContact}
          </Text>
        </View>
        <IconGlyph name="chevron-right" color={colors.fgSecondary} size={18} />
      </StickerCard>
      </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).duration(380).springify().damping(18)}>
      <SectionGroup label="Preferences">
        <SettingsRow
          icon="notifications"
          label="Push"
          color={colors.sky500}
          right={(
            <WingmanToggle
              value={settings.pushEnabled}
              onValueChange={async (value) => {
                await Haptics.selectionAsync();
                setPushEnabled(value);
                pipPlay(value ? 'excited' : 'sleeping', {
                  say: value ? 'Pings on! 🔔' : 'Going quiet 🤫',
                });
              }}
            />
          )}
        />
        <SettingsRow
          icon="moon"
          label="Quiet hours"
          color={colors.lav500}
          value={settings.quietHours}
          onPress={() => {
            void openQuietHours();
          }}
        />
        {settings.pushEnabled ? (
          <SettingsRow
            icon="notifications"
            label="Send a test notification"
            color={colors.mint500}
            value={pushSupported ? undefined : 'Web only'}
            onPress={() => {
              void onSendTest();
            }}
          />
        ) : null}
      </SectionGroup>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(380).springify().damping(18)}>
      <SectionGroup label="Appearance">
        <SettingsRow
          icon={resolvedTheme === 'dark' ? 'moon' : 'sun'}
          label="Theme"
          color={resolvedTheme === 'dark' ? colors.lav500 : colors.sun500}
          right={<ThemeModePill themeMode={themeMode} />}
        />
        <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
          <SegmentedControl
            value={themeMode}
            onChange={(mode) => {
              void Haptics.selectionAsync();
              setThemeMode(mode);
            }}
            options={[
              { label: 'Light', value: 'light' },
              { label: 'Dark', value: 'dark' },
              { label: 'Auto', value: 'auto' },
            ]}
          />
        </View>
      </SectionGroup>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(180).duration(380).springify().damping(18)}>
      <SectionGroup label="Privacy">
        <SettingsRow
          icon="shield-checkmark"
          label="Memory"
          color={colors.mint500}
          right={(
            <WingmanToggle
              value={settings.memoryEnabled}
              onValueChange={async (value) => {
                await Haptics.selectionAsync();
                setMemoryEnabled(value);
                pipPlay(value ? 'love' : 'thinking', {
                  say: value ? "I'll remember 💙" : 'Forgetting… 🫧',
                });
              }}
            />
          )}
        />
        <SettingsRow
          icon="apps"
          label="Connected apps"
          color={colors.sky500}
          onPress={() => router.push('/apps')}
        />
      </SectionGroup>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(210).duration(380).springify().damping(18)}>
      <SectionGroup label="Account">
        <SettingsRow
          icon="arrow-right"
          label="Sign out"
          color={colors.fgSecondary}
          onPress={onSignOut}
        />
        <SettingsRow
          icon="trash"
          label="Delete account"
          color={colors.coral500}
          destructive
          onPress={onDeleteAccount}
        />
      </SectionGroup>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(240).duration(380).springify().damping(18)}>
      <SectionGroup label="Support">
        <SettingsRow icon="help-circle" label="Help center" color={colors.coral500} comingSoon />
        <SettingsRow icon="mail" label="Contact Pip's humans" color={colors.sky500} comingSoon />
        <SettingsRow icon="shield-checkmark" label="Privacy policy" color={colors.mint500} comingSoon />
      </SectionGroup>
      </Animated.View>

      <Pressable style={{ paddingHorizontal: wingmanLayout.screenPadding }}>
        <Text
          style={{
            color: colors.fgMuted,
            fontFamily: wingmanFonts.text,
            fontSize: 11,
            fontWeight: '700',
            textAlign: 'center',
          }}>
          Wingman v2.0 · Made in Brooklyn
        </Text>
      </Pressable>
    </ScrollView>
    <QuietHoursSheet
      visible={quietSheetOpen}
      value={settings.quietHours}
      onClose={() => setQuietSheetOpen(false)}
      onSave={onSaveQuietHours}
    />
    </>
  );
}

function TimeColumn({
  label,
  selected,
  disabled,
  onSelect,
}: {
  label: string;
  selected: number;
  disabled: boolean;
  onSelect: (minutes: number) => void;
}) {
  const { colors } = useWingman();
  const scrollRef = React.useRef<ScrollView>(null);

  React.useEffect(() => {
    const index = Math.max(0, HALF_HOUR_SLOTS.indexOf(selected));
    const y = Math.max(0, index * ROW_HEIGHT - ROW_HEIGHT * 2);
    const timer = setTimeout(() => scrollRef.current?.scrollTo({ y, animated: false }), 0);
    return () => clearTimeout(timer);
  }, [selected]);

  return (
    <View style={{ flex: 1, opacity: disabled ? 0.4 : 1 }}>
      <Text
        style={{
          color: colors.fgMuted,
          fontFamily: wingmanFonts.text,
          fontSize: 11,
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 6,
          textAlign: 'center',
        }}>
        {label}
      </Text>
      <ScrollView
        ref={scrollRef}
        scrollEnabled={!disabled}
        style={{
          maxHeight: ROW_HEIGHT * 5,
          borderWidth: 1.5,
          borderColor: colors.border,
          borderRadius: 14,
          backgroundColor: colors.bg,
        }}
        showsVerticalScrollIndicator={false}>
        {HALF_HOUR_SLOTS.map((slot) => {
          const isSelected = slot === selected;
          return (
            <Pressable
              key={slot}
              disabled={disabled}
              onPress={() => onSelect(slot)}
              style={{
                height: ROW_HEIGHT,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isSelected ? withAlpha(colors.lav500, 0.16) : 'transparent',
              }}>
              <Text
                style={{
                  color: isSelected ? colors.lav500 : colors.fgPrimary,
                  fontFamily: wingmanFonts.text,
                  fontSize: 14,
                  fontWeight: isSelected ? '800' : '600',
                }}>
                {formatSlot(slot)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function QuietHoursSheet({
  visible,
  value,
  onClose,
  onSave,
}: {
  visible: boolean;
  value: string;
  onClose: () => void;
  onSave: (next: string) => void | Promise<void>;
}) {
  const { colors } = useWingman();
  const [off, setOff] = React.useState(false);
  const [start, setStart] = React.useState(DEFAULT_QUIET_START);
  const [end, setEnd] = React.useState(DEFAULT_QUIET_END);

  // Re-sync local state every time the sheet opens with the persisted value.
  React.useEffect(() => {
    if (!visible) return;
    const parsed = parseQuietWindow(value);
    setOff(parsed == null);
    setStart(parsed?.start ?? DEFAULT_QUIET_START);
    setEnd(parsed?.end ?? DEFAULT_QUIET_END);
  }, [visible, value]);

  const sameTime = start === end;
  const canSave = off || !sameTime;

  const summary = off
    ? 'Notifications can arrive any time.'
    : sameTime
      ? 'Start and end can’t be the same time.'
      : `Pip stays silent ${formatSlot(start)}–${formatSlot(end)} · ${quietDurationLabel(start, end)}.`;

  const handleSave = () => {
    if (!canSave) return;
    void onSave(off ? 'Off' : formatQuietWindow(start, end));
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(27,34,64,0.45)', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 18,
            paddingTop: 12,
            paddingBottom: 28,
            borderTopWidth: 1.5,
            borderColor: colors.border,
            gap: 14,
          }}>
          <View
            style={{ alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 2 }}
          />
          <Text
            style={{ color: colors.ink, fontFamily: wingmanFonts.display, fontSize: 18, fontWeight: '700' }}>
            Quiet hours
          </Text>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: colors.border,
              backgroundColor: colors.bg,
            }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: colors.fgPrimary, fontFamily: wingmanFonts.text, fontSize: 14, fontWeight: '700' }}>
                Notify any time
              </Text>
              <Text style={{ color: colors.fgMuted, fontFamily: wingmanFonts.text, fontSize: 12, fontWeight: '600' }}>
                Turn off the nightly silent window
              </Text>
            </View>
            <WingmanToggle value={off} onValueChange={(next) => setOff(next)} />
          </View>

          <View style={{ flexDirection: 'row', gap: 14 }}>
            <TimeColumn label="From" selected={start} disabled={off} onSelect={setStart} />
            <TimeColumn label="To" selected={end} disabled={off} onSelect={setEnd} />
          </View>

          <Text
            style={{
              color: sameTime && !off ? colors.coral500 : colors.fgSecondary,
              fontFamily: wingmanFonts.text,
              fontSize: 12,
              fontWeight: '700',
              textAlign: 'center',
            }}>
            {summary}
          </Text>

          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={{
              opacity: canSave ? 1 : 0.5,
              backgroundColor: colors.lav500,
              borderRadius: 16,
              paddingVertical: 14,
              alignItems: 'center',
            }}>
            <Text style={{ color: '#fff', fontFamily: wingmanFonts.text, fontSize: 15, fontWeight: '800' }}>
              Save
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
