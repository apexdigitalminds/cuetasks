import { useState, useCallback } from 'react';

// Mirrors user_settings.notifications in the (future) Supabase schema.
export interface NotificationSettings {
  sound: boolean;         // play the alert tone
  vibrate: boolean;       // vibrate on mobile
  remindBefore: boolean;  // fire the per-task "minutes before due" reminder
  alertOnDue: boolean;    // alert when a dated task reaches its due time
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  sound: true,
  vibrate: true,
  remindBefore: true,
  alertOnDue: true,
};

const KEY = 'notificationSettings';

// Read the current settings synchronously (used by non-React code like alertUser).
export function getNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...parsed };
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_NOTIFICATION_SETTINGS;
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // ignore write failures (e.g. private mode)
  }
}

// React hook for the settings UI.
export function useNotificationSettings(): [
  NotificationSettings,
  (patch: Partial<NotificationSettings>) => void
] {
  const [settings, setSettings] = useState<NotificationSettings>(() => getNotificationSettings());

  const update = useCallback((patch: Partial<NotificationSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      saveNotificationSettings(next);
      return next;
    });
  }, []);

  return [settings, update];
}
