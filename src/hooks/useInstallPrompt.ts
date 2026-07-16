import { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    // Stashed by the inline script in index.html, which listens before React mounts.
    __cuetasksInstallPrompt?: BeforeInstallPromptEvent;
  }
}

// Wraps the PWA install flow. On Chrome/Edge/Android we can trigger the native
// install prompt; iOS Safari has no such event, so callers fall back to the
// "Share → Add to Home Screen" hint (isIOS).
export function useInstallPrompt() {
  // Seed from the pre-mount capture so an early event is never missed.
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    () => (typeof window !== 'undefined' ? window.__cuetasksInstallPrompt ?? null : null),
  );

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      window.__cuetasksInstallPrompt = e as BeforeInstallPromptEvent;
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      window.__cuetasksInstallPrompt = undefined;
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true);

  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

  const promptInstall = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    window.__cuetasksInstallPrompt = undefined;
    setDeferred(null);
  }, [deferred]);

  return { canInstall: !!deferred, promptInstall, isIOS, isStandalone };
}
