import { Redirect } from 'expo-router';

import { useWingman } from '@/features/wingman/provider';

export default function IndexRoute() {
  const { authStage } = useWingman();

  if (authStage === 'authenticated') {
    return <Redirect href="/(tabs)" />;
  }

  if (authStage === 'sign-in') {
    return <Redirect href="/sign-in" />;
  }

  return <Redirect href="/onboarding" />;
}
