import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useOnboarding } from '@/hooks/useOnboarding';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isComplete } = useOnboarding();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isComplete !== null) {
      setReady(true);
      SplashScreen.hideAsync();
    }
  }, [isComplete]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        {isComplete === false && (
          <Stack.Screen
            name="onboarding/index"
            options={{ gestureEnabled: false }}
          />
        )}
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}
