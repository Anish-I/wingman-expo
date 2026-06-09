import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { useWingman } from '@/features/wingman/provider';
import {
  IconGlyph,
  Pip,
  SegmentedControl,
  StickerCard,
  WingmanButton,
  WingmanLabel,
} from '@/features/wingman/primitives';
import { wingmanFonts, wingmanLayout, wingmanTypography } from '@/features/wingman/theme';

type AuthTab = 'password' | 'email' | 'social';
type AuthMode = 'sign-in' | 'create-account';

async function runHaptic(feedback: () => Promise<void>) {
  try {
    await feedback();
  } catch {
    // Haptics can be unavailable in some Expo Go/device combinations.
  }
}

function FieldShell({
  label,
  icon,
  children,
  hint,
}: {
  label: string;
  icon: 'mail' | 'phone' | 'chat' | 'settings';
  children: React.ReactNode;
  hint?: string;
}) {
  const { colors } = useWingman();

  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          color: colors.fgSecondary,
          fontFamily: wingmanFonts.text,
          fontSize: 12,
          fontWeight: '800',
        }}>
        {label}
      </Text>
      <StickerCard
        style={{
          minHeight: 54,
          paddingLeft: 20,
          paddingRight: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}>
        {children}
        <IconGlyph name={icon} color={colors.fgMuted} size={18} />
      </StickerCard>
      {hint ? (
        <Text
          style={{
            color: colors.fgMuted,
            fontFamily: wingmanFonts.text,
            fontSize: 11,
            fontWeight: '600',
          }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function SignInScreen({ mode = 'sign-in' }: { mode?: AuthMode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    colors,
    createFakeAccount,
    fakeAccount,
    signIn,
    signInWithPassword,
  } = useWingman();
  const [tab, setTab] = React.useState<AuthTab>('password');
  const [displayName, setDisplayName] = React.useState(fakeAccount.name);
  const [credentialEmail, setCredentialEmail] = React.useState(fakeAccount.email);
  const [credentialPassword, setCredentialPassword] = React.useState(fakeAccount.password);
  const [magicEmail, setMagicEmail] = React.useState(fakeAccount.email);
  const [magicLinkSent, setMagicLinkSent] = React.useState(false);
  const [resendTimer, setResendTimer] = React.useState(30);
  const [submitting, setSubmitting] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  const isCreateAccount = mode === 'create-account';
  const title = isCreateAccount ? 'Meet your new wingman!' : 'Welcome back!';
  const subtitle = isCreateAccount
    ? 'Use a fake email and password for now so we can get into the product and build the real features.'
    : 'Use the fake email and password below to get into the app while we build the real auth later.';
  const eyebrow = isCreateAccount ? 'Create your account' : 'Welcome back';

  React.useEffect(() => {
    if (!magicLinkSent || resendTimer === 0) {
      return;
    }

    const timer = setInterval(() => {
      setResendTimer((currentValue) => Math.max(currentValue - 1, 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [magicLinkSent, resendTimer]);

  const emailIsValid = /\S+@\S+\.\S+/.test(credentialEmail);
  const magicEmailIsValid = /\S+@\S+\.\S+/.test(magicEmail);
  const passwordIsValid = credentialPassword.trim().length >= 6;
  const canSubmitPassword = emailIsValid && passwordIsValid && (!isCreateAccount || displayName.trim().length >= 2);

  const enterApp = async () => {
    if (submitting) return;

    setSubmitting(true);
    setStatusMessage(null);

    try {
      await runHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      await signIn();
      router.replace('/(tabs)');
    } catch (error) {
      await runHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
      setStatusMessage(error instanceof Error ? error.message : 'Sign-in failed.');
      setSubmitting(false);
    }
  };

  const submitPasswordFlow = async () => {
    if (submitting) return;

    setSubmitting(true);
    setStatusMessage(null);

    try {
      const result = await (isCreateAccount
        ? createFakeAccount({
            name: displayName,
            email: credentialEmail,
            password: credentialPassword,
          })
        : signInWithPassword(credentialEmail, credentialPassword));

      if (!result.ok) {
        await runHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
        setStatusMessage(result.error ?? 'Something went wrong.');
        setSubmitting(false);
        return;
      }

      await runHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      router.replace('/(tabs)');
    } catch (error) {
      await runHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
      setStatusMessage(error instanceof Error ? error.message : 'Sign-in failed.');
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.sky100 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: colors.sky100 }}
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 18) + 60,
          backgroundColor: colors.bg,
        }}>
        <LinearGradient
          colors={[colors.sky100, colors.bg]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={{
            paddingHorizontal: wingmanLayout.screenPadding,
            paddingTop: insets.top + 18,
            paddingBottom: 20,
            gap: 10,
          }}>
          <Animated.View
            entering={FadeInDown.duration(420)}
            style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
            <Pip variant={isCreateAccount ? 'wave' : 'happy'} size={68} />
            <View style={{ paddingBottom: 6 }}>
              <WingmanLabel color={colors.sky500}>{eyebrow}</WingmanLabel>
            </View>
          </Animated.View>
          <Animated.View
            entering={FadeInDown.delay(80).duration(420)}
            style={{ gap: 10 }}>
            <Text
              style={{
                color: colors.ink,
                ...wingmanTypography.screenTitle,
              }}>
              {title}
            </Text>
            <Text
              style={{
                color: colors.inkSoft,
                fontFamily: wingmanFonts.text,
                fontSize: 14,
                fontWeight: '500',
                lineHeight: 20,
                maxWidth: 320,
              }}>
              {subtitle}
            </Text>
          </Animated.View>
        </LinearGradient>

        <View style={{ paddingHorizontal: wingmanLayout.screenPadding, gap: 14 }}>
          <Animated.View entering={FadeInDown.delay(120).duration(380)}>
            <SegmentedControl<AuthTab>
              value={tab}
              onChange={(nextTab) => setTab(nextTab)}
              options={[
                { label: 'Password', value: 'password' },
                { label: 'Email', value: 'email' },
                { label: 'Social', value: 'social' },
              ]}
            />
          </Animated.View>

          {tab === 'password' && !isCreateAccount ? (
            <Animated.View entering={FadeIn.duration(160)}>
              <StickerCard
                backgroundColor={colors.cardAlt}
                borderColor={colors.border}
                style={{
                  padding: 16,
                  gap: 8,
                }}>
                <WingmanLabel color={colors.sky500}>Fake auth</WingmanLabel>
                <Text
                  style={{
                    color: colors.ink,
                    fontFamily: wingmanFonts.display,
                    fontSize: 20,
                    fontWeight: '700',
                  }}>
                  Demo credentials
                </Text>
                <Text
                  style={{
                    color: colors.fgSecondary,
                    fontFamily: wingmanFonts.text,
                    fontSize: 13,
                    fontWeight: '500',
                    lineHeight: 19,
                  }}>
                  {`${fakeAccount.email} / ${fakeAccount.password}`}
                </Text>
                <Pressable
                  onPress={() => {
                    setDisplayName(fakeAccount.name);
                    setCredentialEmail(fakeAccount.email);
                    setCredentialPassword(fakeAccount.password);
                    setStatusMessage('Demo credentials restored.');
                  }}>
                  <Text
                    style={{
                      color: colors.sky500,
                      fontFamily: wingmanFonts.text,
                      fontSize: 13,
                      fontWeight: '800',
                    }}>
                    Use demo values
                  </Text>
                </Pressable>
              </StickerCard>
            </Animated.View>
          ) : null}

          {statusMessage ? (
            <Animated.View entering={FadeIn.duration(160)}>
              <StickerCard
                backgroundColor={colors.cardAlt}
                borderColor={colors.border}
                style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                <Text
                  style={{
                    color: colors.fgSecondary,
                    fontFamily: wingmanFonts.text,
                    fontSize: 12,
                    fontWeight: '700',
                    lineHeight: 18,
                  }}>
                  {statusMessage}
                </Text>
              </StickerCard>
            </Animated.View>
          ) : null}

          <Animated.View
            key={tab}
            entering={FadeIn.duration(160)}
            style={{ gap: 14 }}>
            {tab === 'password' ? (
              <>
                {isCreateAccount ? (
                  <FieldShell label="Name" icon="chat">
                    <TextInput
                      value={displayName}
                      onChangeText={setDisplayName}
                      autoCapitalize="words"
                      placeholder="Sam Ortega"
                      placeholderTextColor={colors.fgMuted}
                      style={{
                        flex: 1,
                        color: colors.ink,
                        fontFamily: wingmanFonts.text,
                        fontSize: 15,
                        fontWeight: '600',
                      }}
                    />
                  </FieldShell>
                ) : null}

                <FieldShell label="Email address" icon="mail">
                  <TextInput
                    value={credentialEmail}
                    onChangeText={setCredentialEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="sam@wingman.dev"
                    placeholderTextColor={colors.fgMuted}
                    style={{
                      flex: 1,
                      color: colors.ink,
                      fontFamily: wingmanFonts.text,
                      fontSize: 15,
                      fontWeight: '600',
                    }}
                  />
                </FieldShell>

                <FieldShell
                  label="Password"
                  icon="settings"
                  hint="Use any six-plus character password. The demo default is pigeon123.">
                  <TextInput
                    value={credentialPassword}
                    onChangeText={setCredentialPassword}
                    secureTextEntry
                    placeholder="pigeon123"
                    placeholderTextColor={colors.fgMuted}
                    style={{
                      flex: 1,
                      color: colors.ink,
                      fontFamily: wingmanFonts.text,
                      fontSize: 15,
                      fontWeight: '600',
                    }}
                  />
                </FieldShell>

                <WingmanButton
                  fullWidth
                  iconRight="arrow-right"
                  disabled={!canSubmitPassword || submitting}
                  onPress={submitPasswordFlow}>
                  {submitting ? (isCreateAccount ? 'Creating...' : 'Signing in...') : (isCreateAccount ? 'Create account' : 'Sign in')}
                </WingmanButton>
              </>
            ) : null}

            {tab === 'email' ? (
              <>
                {!magicLinkSent ? (
                  <>
                    <FieldShell label="Email address" icon="mail">
                      <TextInput
                        value={magicEmail}
                        onChangeText={setMagicEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        placeholder="you@example.com"
                        placeholderTextColor={colors.fgMuted}
                        style={{
                          flex: 1,
                          color: colors.ink,
                          fontFamily: wingmanFonts.text,
                          fontSize: 15,
                          fontWeight: '600',
                        }}
                      />
                    </FieldShell>
                    <WingmanButton
                      fullWidth
                      iconRight="arrow-right"
                      disabled={!magicEmailIsValid || submitting}
                      onPress={async () => {
                        await runHaptic(() => Haptics.selectionAsync());
                        setMagicLinkSent(true);
                        setResendTimer(30);
                      }}>
                      {isCreateAccount ? 'Send sign-up link' : 'Send magic link'}
                    </WingmanButton>
                  </>
                ) : (
                  <>
                    <StickerCard
                      backgroundColor={colors.cardAlt}
                      borderColor={colors.border}
                      style={{
                        padding: 18,
                        gap: 10,
                      }}>
                      <WingmanLabel color={colors.sky500}>Check your inbox</WingmanLabel>
                      <Text
                        style={{
                          color: colors.ink,
                          fontFamily: wingmanFonts.display,
                          fontSize: 22,
                          fontWeight: '700',
                        }}>
                        Email sent
                      </Text>
                      <Text
                        style={{
                          color: colors.fgSecondary,
                          fontFamily: wingmanFonts.text,
                          fontSize: 14,
                          fontWeight: '500',
                          lineHeight: 20,
                        }}>
                        {`We sent a fake one-tap link to ${magicEmail}. Resend in ${resendTimer}s.`}
                      </Text>
                    </StickerCard>
                    <WingmanButton fullWidth disabled={submitting} onPress={enterApp}>
                      {submitting ? 'Opening...' : 'Continue to Wingman'}
                    </WingmanButton>
                  </>
                )}
              </>
            ) : null}

            {tab === 'social' ? (
              <View style={{ gap: 12 }}>
                <WingmanButton
                  fullWidth
                  variant="secondary"
                  iconLeft="apple"
                  disabled={submitting}
                  onPress={enterApp}>
                  Continue with Apple
                </WingmanButton>
                <WingmanButton
                  fullWidth
                  variant="social"
                  iconLeft="google"
                  disabled={submitting}
                  onPress={enterApp}>
                  Continue with Google
                </WingmanButton>
              </View>
            ) : null}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(310).duration(360)}>
          <Pressable onPress={() => router.push((isCreateAccount ? '/sign-in' : '/create-account') as never)}>
            <Text
              style={{
                color: colors.sky500,
                fontFamily: wingmanFonts.text,
                fontSize: 14,
                fontWeight: '800',
                textAlign: 'center',
              }}>
              {isCreateAccount ? 'Already have an account? Sign in' : 'New here? Create account'}
            </Text>
          </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(350).duration(360)}>
            <Text
              style={{
                color: colors.fgMuted,
                fontFamily: wingmanFonts.text,
                fontSize: 11,
                fontWeight: '600',
                lineHeight: 18,
                textAlign: 'center',
              }}>
              By continuing you agree to Wingman&apos;s Terms and Privacy Policy. This auth flow is fake for now so we can keep shipping product.
            </Text>
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
