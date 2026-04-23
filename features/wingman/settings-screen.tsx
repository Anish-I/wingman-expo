import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useWingman } from '@/features/wingman/provider';
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

export function SettingsScreen() {
  const router = useRouter();
  const {
    colors,
    currentUser,
    resolvedTheme,
    settings,
    setMemoryEnabled,
    setPushEnabled,
    setThemeMode,
    themeMode,
  } = useWingman();
  const isDark = resolvedTheme === 'dark';
  const profileName = currentUser?.name ?? 'Sam Ortega';
  const profilePhone = currentUser?.phone ?? '+1 (555) 123-4567';
  const profileEmail = currentUser?.email ?? 'sam@wingman.dev';

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingBottom: 140,
        gap: 18,
      }}>
      <ScreenHeader title="Settings" />

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
            SO
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
            {`${profilePhone} · ${profileEmail}`}
          </Text>
        </View>
        <IconGlyph name="chevron-right" color={colors.fgSecondary} size={18} />
      </StickerCard>

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
        />
      </SectionGroup>

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
        <SettingsRow
          icon="trash"
          label="Delete account"
          color={colors.coral500}
          destructive
        />
      </SectionGroup>

      <SectionGroup label="Support">
        <SettingsRow icon="help-circle" label="Help center" color={colors.coral500} />
        <SettingsRow icon="mail" label="Contact Pip's humans" color={colors.sky500} />
        <SettingsRow icon="shield-checkmark" label="Privacy policy" color={colors.mint500} />
      </SectionGroup>

      {__DEV__ ? (
        <SectionGroup label="Developer">
          <SettingsRow
            icon="chat"
            label="UI critique lab"
            color={colors.sky500}
            onPress={() => router.push('/ui-critique' as never)}
          />
          <SettingsRow
            icon="mail"
            label="Demo account"
            color={colors.sun500}
            value="sam@wingman.dev"
          />
        </SectionGroup>
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
          Wingman v2.0 · Made with pigeons in Brooklyn
        </Text>
      </Pressable>
    </ScrollView>
  );
}
