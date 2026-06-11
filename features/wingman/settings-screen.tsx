import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWingman } from '@/features/wingman/provider';
import { wingmanSupportLinks } from '@/features/wingman/data';
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

const quietHourOptions = ['10pm - 7am', '9pm - 6am', '11pm - 8am', 'Off'] as const;

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

  const onSendTest = React.useCallback(async () => {
    await Haptics.selectionAsync();
    const result = await sendTestNotification();
    if (result.ok) {
      Alert.alert('Sent', 'A test notification is on its way to this device.');
    } else {
      Alert.alert('Could not send', result.error ?? 'Push is not available here.');
    }
  }, [sendTestNotification]);

  const openLink = React.useCallback(async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Linking.openURL(url).catch(() => Alert.alert('Could not open link.'));
    }
  }, []);

  const onDeleteAccount = React.useCallback(() => {
    Alert.alert(
      'Delete your Wingman account?',
      "This removes Pip's memory of you, your apps and your flows. This cannot be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await deleteAccount();
          },
        },
      ],
    );
  }, [deleteAccount]);
  const cycleQuietHours = React.useCallback(async () => {
    await Haptics.selectionAsync();
    const currentIndex = quietHourOptions.indexOf(settings.quietHours as (typeof quietHourOptions)[number]);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % quietHourOptions.length : 0;
    setQuietHours(quietHourOptions[nextIndex]!);
  }, [setQuietHours, settings.quietHours]);

  const onSignOut = React.useCallback(() => {
    Alert.alert('Sign out?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await Haptics.selectionAsync();
          } catch {
            // best-effort
          }
          signOut();
          router.replace('/sign-in');
        },
      },
    ]);
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
            void cycleQuietHours();
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
        <SettingsRow
          icon="help-circle"
          label="Help center"
          color={colors.coral500}
          onPress={() => openLink(wingmanSupportLinks.helpCenter)}
        />
        <SettingsRow
          icon="mail"
          label="Contact Pip's humans"
          color={colors.sky500}
          onPress={() => Linking.openURL(`mailto:${wingmanSupportLinks.contactEmail}?subject=Hello%20Pip`)}
        />
        <SettingsRow
          icon="shield-checkmark"
          label="Privacy policy"
          color={colors.mint500}
          onPress={() => openLink(wingmanSupportLinks.privacyPolicy)}
        />
      </SectionGroup>
      </Animated.View>

      {__DEV__ ? (
        <Animated.View entering={FadeInDown.delay(300).duration(380).springify().damping(18)}>
        <SectionGroup label="Developer">
          <SettingsRow
            icon="chat"
            label="UI critique lab"
            color={colors.sky500}
            onPress={() => router.push('/ui-critique' as never)}
          />
        </SectionGroup>
        </Animated.View>
      ) : null}

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
  );
}
