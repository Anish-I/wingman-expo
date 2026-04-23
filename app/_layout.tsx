import Ionicons from '@expo/vector-icons/Ionicons';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';
import 'react-native-reanimated';

import { WingmanProvider, useWingman } from '@/features/wingman/provider';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Fraunces: require('../assets/fonts/Fraunces-Variable.ttf'),
    Inter: require('../assets/fonts/Inter-Variable.ttf'),
    Sora: require('../assets/fonts/Sora-VariableFont_wght.ttf'),
    ...Ionicons.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <WingmanProvider>
      <RootLayoutNav />
    </WingmanProvider>
  );
}

function RootLayoutNav() {
  const { colors, resolvedTheme } = useWingman();
  const { width } = useWindowDimensions();
  const isWeb = process.env.EXPO_OS === 'web';
  const showMobileShell = isWeb && width > 480;
  const navigationTheme = resolvedTheme === 'dark'
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: colors.bg,
          border: colors.border,
          card: colors.card,
          notification: colors.coral500,
          primary: colors.sky500,
          text: colors.fgPrimary,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: colors.bg,
          border: colors.border,
          card: colors.card,
          notification: colors.coral500,
          primary: colors.sky500,
          text: colors.fgPrimary,
        },
      };

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: showMobileShell
            ? (resolvedTheme === 'dark' ? '#0B1020' : '#E8EDF5')
            : colors.bg,
        }}>
        <View
          style={{
            flex: 1,
            width: '100%',
            maxWidth: showMobileShell ? 430 : '100%',
            overflow: 'hidden',
            backgroundColor: colors.bg,
            borderRadius: showMobileShell ? 32 : 0,
            boxShadow: showMobileShell
              ? (resolvedTheme === 'dark'
                ? '0 18px 50px rgba(0, 0, 0, 0.45)'
                : '0 18px 50px rgba(27, 34, 64, 0.18)')
              : 'none',
            borderWidth: showMobileShell ? 1.5 : 0,
            borderColor: showMobileShell ? colors.border : 'transparent',
            borderCurve: 'continuous',
          }}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'fade',
            }}>
            <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="create-account" />
        <Stack.Screen name="ui-critique" />
        <Stack.Screen name="apps" />
        <Stack.Screen name="(tabs)" />
      </Stack>
        </View>
      </View>
    </ThemeProvider>
  );
}
