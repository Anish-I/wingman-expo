import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWingman } from '@/features/wingman/provider';
import {
  IconGlyph,
  ScreenHeader,
  StickerCard,
  WingmanButton,
} from '@/features/wingman/primitives';
import { wingmanFonts, wingmanLayout } from '@/features/wingman/theme';

function Field({
  label,
  icon,
  hint,
  children,
}: {
  label: string;
  icon: 'mail' | 'phone' | 'chat';
  hint?: string;
  children: React.ReactNode;
}) {
  const { colors } = useWingman();
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.fgSecondary, fontFamily: wingmanFonts.text, fontSize: 12, fontWeight: '800' }}>
        {label}
      </Text>
      <StickerCard
        style={{ minHeight: 54, paddingLeft: 20, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {children}
        <IconGlyph name={icon} color={colors.fgMuted} size={18} />
      </StickerCard>
      {hint ? (
        <Text style={{ color: colors.fgMuted, fontFamily: wingmanFonts.text, fontSize: 11, fontWeight: '600' }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, currentUser, updateProfile } = useWingman();

  const [name, setName] = React.useState(currentUser?.name ?? '');
  const [phone, setPhone] = React.useState(currentUser?.phone ?? '');
  const [submitting, setSubmitting] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);

  const nameValid = name.trim().length >= 1;
  const dirty = name.trim() !== (currentUser?.name ?? '').trim() || phone.trim() !== (currentUser?.phone ?? '').trim();

  const onSave = async () => {
    if (submitting || !nameValid) return;
    setSubmitting(true);
    setStatus(null);
    const result = await updateProfile({ name: name.trim(), phone: phone.trim() });
    if (result.ok) {
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { /* best-effort */ }
      router.back();
      return;
    }
    try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch { /* best-effort */ }
    setStatus(result.error ?? 'Could not save your profile.');
    setSubmitting(false);
  };

  const inputStyle = {
    flex: 1,
    color: colors.ink,
    fontFamily: wingmanFonts.text,
    fontSize: 15,
    fontWeight: '600' as const,
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Edit profile" eyebrow="Account" onBack={() => router.back()} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          paddingHorizontal: wingmanLayout.screenPadding,
          paddingBottom: insets.bottom + 40,
          gap: 16,
        }}>
        <Animated.View entering={FadeInDown.duration(360).springify().damping(18)} style={{ gap: 16 }}>
          <Field label="Name" icon="chat">
            <TextInput
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              placeholder="Your name"
              placeholderTextColor={colors.fgMuted}
              style={inputStyle}
            />
          </Field>

          <Field label="Phone" icon="phone" hint="Optional. Used for reminders later — leave blank to remove it.">
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="Add a phone number"
              placeholderTextColor={colors.fgMuted}
              style={inputStyle}
            />
          </Field>

          <Field label="Email" icon="mail" hint="Your email is tied to your account and can't be changed here.">
            <Text style={{ flex: 1, color: colors.fgSecondary, fontFamily: wingmanFonts.text, fontSize: 15, fontWeight: '600' }}>
              {currentUser?.email ?? '—'}
            </Text>
          </Field>

          {status ? (
            <StickerCard backgroundColor={colors.cardAlt} borderColor={colors.border} style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
              <Text style={{ color: colors.coral500, fontFamily: wingmanFonts.text, fontSize: 12, fontWeight: '700', lineHeight: 18 }}>
                {status}
              </Text>
            </StickerCard>
          ) : null}

          <WingmanButton
            fullWidth
            iconRight="arrow-right"
            disabled={!nameValid || !dirty || submitting}
            onPress={onSave}>
            {submitting ? 'Saving…' : 'Save changes'}
          </WingmanButton>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
