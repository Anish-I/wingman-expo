import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useWingman } from '@/features/wingman/provider';
import {
  IconGlyph,
  Pip,
  SegmentedControl,
  StickerCard,
  WingmanButton,
  WingmanLabel,
} from '@/features/wingman/primitives';
import { wingmanFonts, wingmanLayout } from '@/features/wingman/theme';

type AuthTab = 'password' | 'email' | 'social';
type AuthMode = 'sign-in' | 'create-account';

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
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}>
        <IconGlyph name={icon} color={colors.fgMuted} size={18} />
        {children}
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
  const [statusMessage, setStatusMessage] = React.useState<string | null>(
    mode === 'create-account'
      ? 'Demo details are prefilled. Change them or continue as-is.'
      : 'Use the demo login below or create a new fake account.',
  );

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
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await signIn();
    router.replace('/(tabs)');
  };

  const submitPasswordFlow = async () => {
    setStatusMessage(null);

    const result = await (isCreateAccount
      ? createFakeAccount({
          name: displayName,
          email: credentialEmail,
          password: credentialPassword,
        })
      : signInWithPassword(credentialEmail, credentialPassword));

    if (!result.ok) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setStatusMessage(result.error ?? 'Something went wrong.');
      return;
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingBottom: 60,
          backgroundColor: colors.bg,
        }}>
        <LinearGradient
          colors={[colors.sky100, colors.bg]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={{
            paddingHorizontal: wingmanLayout.screenPadding,
            paddingTop: 28,
            paddingBottom: 26,
            gap: 14,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14 }}>
            <Pip variant={isCreateAccount ? 'wave' : 'happy'} size={82} />
            <View style={{ paddingBottom: 6 }}>
              <WingmanLabel color={colors.sky500}>{eyebrow}</WingmanLabel>
            </View>
          </View>
          <View style={{ gap: 10 }}>
            <Text
              style={{
                color: colors.ink,
                fontFamily: wingmanFonts.display,
                fontSize: 32,
                fontWeight: '700',
                lineHeight: 34,
                letterSpacing: -1,
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
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: wingmanLayout.screenPadding, gap: 18 }}>
          <SegmentedControl<AuthTab>
            value={tab}
            onChange={(nextTab) => setTab(nextTab)}
            options={[
              { label: 'Password', value: 'password' },
              { label: 'Email', value: 'email' },
              { label: 'Social', value: 'social' },
            ]}
          />

          {tab === 'password' ? (
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
          ) : null}

          {statusMessage ? (
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
          ) : null}

          <View style={{ gap: 14 }}>
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
                  disabled={!canSubmitPassword}
                  onPress={submitPasswordFlow}>
                  {isCreateAccount ? 'Create account' : 'Sign in'}
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
                      disabled={!magicEmailIsValid}
                      onPress={async () => {
                        await Haptics.selectionAsync();
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
                    <WingmanButton fullWidth onPress={enterApp}>
                      Continue to Wingman
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
                  onPress={enterApp}>
                  Continue with Apple
                </WingmanButton>
                <WingmanButton
                  fullWidth
                  variant="social"
                  iconLeft="google"
                  onPress={enterApp}>
                  Continue with Google
                </WingmanButton>
              </View>
            ) : null}
          </View>

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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
