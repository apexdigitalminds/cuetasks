import { supabase } from './supabase';

// Mirrors user_settings.email_digest in Supabase. The digest is sent server-side
// (Edge Function), so this config has to live in the cloud, not localStorage.
export interface EmailDigestSettings {
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  send_at: string;          // local-ish "HH:MM" the user wants it
  timezone: string;         // IANA zone so the server sends at the right local time
  scope: 'all' | 'categories';
  category_ids: string[];
}

export const DEFAULT_EMAIL_DIGEST: EmailDigestSettings = {
  enabled: false,
  frequency: 'daily',
  send_at: '07:00',
  timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
  scope: 'all',
  category_ids: [],
};

export async function getEmailDigest(): Promise<EmailDigestSettings> {
  if (!supabase) return DEFAULT_EMAIL_DIGEST;
  const { data, error } = await supabase.from('user_settings').select('email_digest').maybeSingle();
  if (error || !data) return DEFAULT_EMAIL_DIGEST;
  return { ...DEFAULT_EMAIL_DIGEST, ...((data.email_digest ?? {}) as Partial<EmailDigestSettings>) };
}

export async function saveEmailDigest(userId: string, settings: EmailDigestSettings): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, email_digest: settings });
  if (error) throw error;
}
