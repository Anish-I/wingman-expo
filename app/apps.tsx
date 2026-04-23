import { Redirect } from 'expo-router';

import { AppsScreen } from '@/features/wingman/apps-screen';
import { useWingman } from '@/features/wingman/provider';

export default function AppsRoute() {
  const { authStage, hydrated, session } = useWingman();

  if (!hydrated) {
    return null;
  }

  if (authStage !== 'authenticated' || !session) {
    return <Redirect href="/sign-in" />;
  }

  return <AppsScreen />;
}
