import { Redirect } from 'expo-router';

import { FlowBuilderScreen } from '@/features/wingman/flow-builder-screen';
import { useWingman } from '@/features/wingman/provider';

export default function FlowBuilderRoute() {
  const { authStage, hydrated, session } = useWingman();

  if (!hydrated) {
    return null;
  }

  if (authStage !== 'authenticated' || !session) {
    return <Redirect href="/sign-in" />;
  }

  return <FlowBuilderScreen />;
}
