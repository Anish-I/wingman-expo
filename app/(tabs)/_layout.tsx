import { Redirect, Tabs } from 'expo-router';

import { useWingman } from '@/features/wingman/provider';
import { WingmanTabBar } from '@/features/wingman/tab-bar';

export default function TabsLayout() {
  const { authStage, hydrated, session } = useWingman();

  if (!hydrated) {
    return null;
  }

  if (authStage !== 'authenticated' || !session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Tabs
      tabBar={(props) => <WingmanTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
      <Tabs.Screen name="flows" options={{ title: 'Flows' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
