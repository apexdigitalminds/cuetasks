// CueTasks — background reminder push (Supabase Edge Function, Deno)
//
// Called by pg_cron every minute with the x-cron-secret header. Finds tasks
// whose reminder time (or due time) has arrived and pushes a Web Push to the
// owner's subscribed devices — so reminders fire even when the app is closed.
//
// Secrets: CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:cuetasks@gmail.com';
const CRON_SECRET = Deno.env.get('CRON_SECRET');

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

interface TaskRow {
  id: string;
  owner_id: string;
  title: string;
  due_at: string;
  reminder_minutes_before: number;
  reminder_pushed_for: string | null;
  due_pushed_for: string | null;
}
interface SubRow { endpoint: string; user_id: string; p256dh: string; auth: string; }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Robust timestamp parse: tolerates Postgres "2026-07-22 13:39:00+00" (space
// separator, bare-hour offset) as well as standard ISO.
function parseTs(s: string | null): number | null {
  if (!s) return null;
  const v = s.trim().replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
  const t = Date.parse(v);
  return isNaN(t) ? null : t;
}

Deno.serve(async (req) => {
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
    console.warn('[reminders] rejected: x-cron-secret missing or does not match CRON_SECRET');
    return json({ error: 'Unauthorized' }, 401);
  }

  const now = Date.now();
  const { data: tasks, error } = await admin
    .from('tasks')
    .select('id, owner_id, title, due_at, reminder_minutes_before, reminder_pushed_for, due_pushed_for')
    .eq('reminder_enabled', true)
    .eq('completed', false)
    .not('due_at', 'is', null);
  if (error) return json({ error: error.message }, 500);
  console.log(`[reminders] candidates=${tasks?.length ?? 0}`);

  interface Job { task: TaskRow; kind: 'before' | 'due'; body: string; }
  const jobs: Job[] = [];

  for (const t of (tasks ?? []) as TaskRow[]) {
    const dueMs = parseTs(t.due_at);
    if (dueMs === null) continue;
    const reminderMs = dueMs - (t.reminder_minutes_before ?? 15) * 60_000;

    // Compare by timestamp (not string) so timezone/format differences don't loop.
    if (now >= reminderMs && now < dueMs && parseTs(t.reminder_pushed_for) !== dueMs) {
      const mins = Math.max(1, Math.round((dueMs - now) / 60_000));
      jobs.push({ task: t, kind: 'before', body: `Due in ${mins} minute${mins === 1 ? '' : 's'}` });
    } else if (now >= dueMs && now < dueMs + 3_600_000 && parseTs(t.due_pushed_for) !== dueMs) {
      jobs.push({ task: t, kind: 'due', body: 'Due now' });
    }
  }
  console.log(`[reminders] jobs=${jobs.length}`);
  if (!jobs.length) return json({ ok: true, sent: 0 });

  const ownerIds = [...new Set(jobs.map(j => j.task.owner_id))];
  const { data: subs } = await admin.from('push_subscriptions').select('*').in('user_id', ownerIds);
  const byOwner = new Map<string, SubRow[]>();
  for (const s of (subs ?? []) as SubRow[]) {
    const arr = byOwner.get(s.user_id) ?? [];
    arr.push(s);
    byOwner.set(s.user_id, arr);
  }

  let sent = 0;
  for (const job of jobs) {
    const payload = JSON.stringify({ title: `⏰ ${job.task.title}`, body: job.body, taskId: job.task.id, url: '/' });
    for (const sub of byOwner.get(job.task.owner_id) ?? []) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); // prune dead device
        } else {
          console.error('push failed', code, (e as { body?: string })?.body ?? e);
        }
      }
    }
    // Record what we pushed for (the due_at) so we don't repeat, and so a
    // rescheduled task (new due_at) re-arms automatically.
    const col = job.kind === 'before' ? 'reminder_pushed_for' : 'due_pushed_for';
    await admin.from('tasks').update({ [col]: job.task.due_at }).eq('id', job.task.id);
  }

  console.log(`[reminders] sent=${sent}`);
  return json({ ok: true, sent, jobs: jobs.length });
});
