import { Redirect } from 'expo-router';

import { EditProfileScreen } from '@/features/wingman/edit-profile-screen';
import { useWingman } from '@/features/wingman/provider';

export default function EditProfileRoute() {
  const { authStage, hydrated, session } = useWingman();

  if (!hydrated) {
    return null;
  }

  if (authStage !== 'authenticated' || !session) {
    return <Redirect href="/sign-in" />;
  }

  return <EditProfileScreen />;
}
