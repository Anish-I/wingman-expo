import { Redirect } from 'expo-router';

import { useWingman } from '@/features/wingman/provider';
import { SignInScreen } from '@/features/wingman/sign-in-screen';

export default function SignInRoute() {
  const { authStage, hydrated, session } = useWingman();

  if (!hydrated) {
    return null;
  }

  if (authStage === 'authenticated' && session) {
    return <Redirect href="/(tabs)" />;
  }

  return <SignInScreen />;
}
