import { useState, useEffect } from 'react';
import { getOnboardingComplete, setOnboardingComplete } from '@/lib/storage';

export function useOnboarding() {
  const [isComplete, setIsComplete] = useState<boolean | null>(null);

  useEffect(() => {
    getOnboardingComplete().then(setIsComplete);
  }, []);

  const completeOnboarding = async () => {
    await setOnboardingComplete();
    setIsComplete(true);
  };

  return { isComplete, completeOnboarding };
}
