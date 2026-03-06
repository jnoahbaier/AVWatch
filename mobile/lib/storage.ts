import * as SecureStore from 'expo-secure-store';

const ONBOARDING_KEY = 'avwatch_onboarding_complete';
const SESSION_KEY = 'avwatch_session';

export async function getOnboardingComplete(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(ONBOARDING_KEY);
  return value === 'true';
}

export async function setOnboardingComplete(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
}

export async function getSession(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_KEY);
}

export async function setSession(session: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, session);
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
