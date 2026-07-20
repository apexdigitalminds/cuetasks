// CueTasks — email digest sender (Supabase Edge Function, Deno)
//
// Two modes:
//   * cron  — called on a schedule with the `x-cron-secret` header; sends to
//             every user whose local send time has arrived.
//   * test  — called with a signed-in user's JWT; sends that user their digest
//             immediately, ignoring the schedule ("Send test digest now").
//
// Env (Supabase → Project Settings → Edge Functions → Secrets):
//   RESEND_API_KEY, DIGEST_FROM, CRON_SECRET
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const DIGEST_FROM = Deno.env.get('DIGEST_FROM') ?? 'CueTasks <no-reply@cuetasks.com>';
const REPLY_TO = Deno.env.get('DIGEST_REPLY_TO') ?? 'cuetasks@gmail.com';
const CRON_SECRET = Deno.env.get('CRON_SECRET');
const APP_URL = Deno.env.get('APP_URL') ?? 'https://cuetasks.com';

interface DigestConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  send_at: string;
  timezone: string;
  scope: 'all' | 'categories';
  category_ids: string[];
}

interface TaskRow {
  id: string;
  title: string;
  due_at: string | null;
  completed: boolean;
  starred: boolean;
  category_id: string | null;
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

// The app calls this from the browser ("send test digest"), so CORS is required.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── time helpers ───────────────────────────────────────────────
function localParts(timeZone: string, now: Date) {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone, hour12: false,
      weekday: 'short', hour: '2-digit', minute: '2-digit',
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const p = Object.fromEntries(fmt.formatToParts(now).map(x => [x.type, x.value]));
    return { hour: Number(p.hour), weekday: p.weekday, ymd: `${p.year}-${p.month}-${p.day}` };
  } catch {
    return { hour: now.getUTCHours(), weekday: 'Mon', ymd: now.toISOString().slice(0, 10) };
  }
}

// Is this user due a digest right now? (cron runs hourly)
function isDue(cfg: DigestConfig, lastSent: string | null, now: Date): boolean {
  const { hour, weekday } = localParts(cfg.timezone || 'UTC', now);
  const wantHour = Number((cfg.send_at || '07:00').split(':')[0]);
  if (hour !== wantHour) return false;
  if (cfg.frequency === 'weekly' && weekday !== 'Mon') return false;

  if (lastSent) {
    const sinceHours = (now.getTime() - new Date(lastSent).getTime()) / 3_600_000;
    if (cfg.frequency === 'daily' && sinceHours < 20) return false;
    if (cfg.frequency === 'weekly' && sinceHours < 24 * 6) return false;
  }
  return true;
}

// ── digest assembly ────────────────────────────────────────────
async function buildDigest(userId: string, cfg: DigestConfig, now: Date) {
  let q = admin.from('tasks').select('id, title, due_at, completed, starred, category_id')
    .eq('owner_id', userId).eq('completed', false);
  if (cfg.scope === 'categories') {
    if (!cfg.category_ids?.length) return null;
    q = q.in('category_id', cfg.category_ids);
  }
  const { data, error } = await q;
  if (error) throw error;
  const tasks = (data ?? []) as TaskRow[];

  const horizonDays = cfg.frequency === 'weekly' ? 7 : 1;
  const endOfToday = new Date(now); endOfToday.setUTCHours(23, 59, 59, 999);
  const horizon = new Date(now.getTime() + horizonDays * 86_400_000);

  const overdue: TaskRow[] = [];
  const dueSoon: TaskRow[] = [];
  const undated: TaskRow[] = [];

  for (const t of tasks) {
    if (!t.due_at) { undated.push(t); continue; }
    const due = new Date(t.due_at);
    if (due < now) overdue.push(t);
    else if (due <= horizon) dueSoon.push(t);
  }
  const byDue = (a: TaskRow, b: TaskRow) => (a.due_at ?? '').localeCompare(b.due_at ?? '');
  overdue.sort(byDue); dueSoon.sort(byDue);

  // Undated tasks are still outstanding, so they count towards "is there
  // anything worth sending?" — previously they were collected and dropped.
  if (!overdue.length && !dueSoon.length && !undated.length) return null;
  return { overdue, dueSoon, undated, horizonDays };
}

function renderEmail(d: NonNullable<Awaited<ReturnType<typeof buildDigest>>>, tz: string, now: Date) {
  const time = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : '';

  const asOf = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, weekday: 'short', day: 'numeric', month: 'short',
    year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(now);

  const row = (t: TaskRow, colour: string) => `
    <tr><td style="padding:10px 14px;border-left:3px solid ${colour};background:#f8fafc;border-radius:6px;">
      <div style="font-size:15px;color:#0f172a;">${t.starred ? '★ ' : ''}${escapeHtml(t.title)}</div>
      ${t.due_at ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${time(t.due_at)}</div>` : ''}
    </td></tr><tr><td style="height:8px;"></td></tr>`;

  const section = (title: string, items: TaskRow[], colour: string) =>
    items.length ? `
      <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;margin:22px 0 10px;">${title}</h3>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items.map(t => row(t, colour)).join('')}</table>` : '';

  // Undated tasks are a backlog, not time-pressure, so don't list them all.
  // Starred ones are shown (you flagged them yourself); the rest are counted.
  // This keeps the email a constant, scannable length however big the backlog.
  const starredUndated = d.undated.filter(t => t.starred);
  const otherUndated = d.undated.length - starredUndated.length;
  const undatedBlock = d.undated.length ? `
      <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;margin:22px 0 10px;">No due date (${d.undated.length})</h3>
      ${starredUndated.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${starredUndated.map(t => row(t, '#F59E0B')).join('')}</table>` : ''}
      ${otherUndated ? `<p style="font-size:13px;color:#64748b;margin:${starredUndated.length ? '2px' : '0'} 0 0;">${starredUndated.length ? 'Plus ' : ''}${otherUndated} unscheduled task${otherUndated === 1 ? '' : 's'} waiting in the app.</p>` : ''}
    ` : '';

  return `<!doctype html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,#6366F1,#8B5CF6,#3B82F6);padding:22px 24px;">
        <div style="color:#fff;font-size:20px;font-weight:600;">CueTasks</div>
        <div style="color:rgba(255,255,255,.85);font-size:13px;margin-top:2px;">Say it. Cue it. Get it done.</div>
      </td></tr>
      <tr><td style="padding:8px 24px 26px;">
        <p style="font-size:13px;color:#475569;margin:16px 0 0;line-height:1.5;">
          These are your outstanding tasks as at <strong style="color:#0f172a;">${asOf}</strong>.
        </p>
        ${section(`Overdue (${d.overdue.length})`, d.overdue, '#EF4444')}
        ${section(d.horizonDays > 1 ? `Coming up (${d.dueSoon.length})` : `Due today (${d.dueSoon.length})`, d.dueSoon, '#6366F1')}
        ${undatedBlock}
        <div style="margin-top:26px;text-align:center;">
          <a href="${APP_URL}" style="display:inline-block;background:#6366F1;color:#fff;text-decoration:none;font-size:14px;padding:11px 22px;border-radius:10px;">Open CueTasks</a>
        </div>
        <p style="font-size:11px;color:#94a3b8;text-align:center;margin:22px 0 0;">
          You're receiving this because email digests are on in CueTasks settings.
        </p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: DIGEST_FROM, to: [to], subject, html, reply_to: REPLY_TO }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

async function sendFor(userId: string, email: string, cfg: DigestConfig, now: Date, force: boolean) {
  const digest = await buildDigest(userId, cfg, now);
  if (!digest) {
    if (!force) return { sent: false, reason: 'nothing due' };
    await sendEmail(email, 'CueTasks — nothing due right now',
      `<p style="font-family:sans-serif">You're all clear — nothing overdue or coming up. 🎉</p>`);
    return { sent: true, reason: 'test (empty)' };
  }
  const subject = digest.overdue.length
    ? `CueTasks — ${digest.overdue.length} overdue, ${digest.dueSoon.length} coming up`
    : digest.dueSoon.length
      ? `CueTasks — ${digest.dueSoon.length} coming up`
      : `CueTasks — ${digest.undated.length} outstanding`;
  await sendEmail(email, subject, renderEmail(digest, cfg.timezone || 'UTC', now));
  await admin.from('user_settings').update({ last_digest_sent_at: now.toISOString() }).eq('user_id', userId);
  return { sent: true, reason: 'ok' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const now = new Date();
  try {
    const cronHeader = req.headers.get('x-cron-secret');
    const auth = req.headers.get('Authorization');

    // ── test mode: a signed-in user asking for their own digest ──
    if (auth && !(CRON_SECRET && cronHeader === CRON_SECRET)) {
      const token = auth.replace(/^Bearer\s+/i, '');
      const { data: { user }, error } = await admin.auth.getUser(token);
      if (error || !user?.email) return json({ error: 'Unauthorized' }, 401);

      const { data: row } = await admin.from('user_settings')
        .select('email_digest').eq('user_id', user.id).maybeSingle();
      const cfg = (row?.email_digest ?? {}) as DigestConfig;
      const result = await sendFor(user.id, user.email, cfg, now, true);
      return json({ ok: true, ...result });
    }

    // ── cron mode ──
    if (!CRON_SECRET || cronHeader !== CRON_SECRET) return json({ error: 'Unauthorized' }, 401);

    const { data: rows, error } = await admin
      .from('user_settings')
      .select('user_id, email_digest, last_digest_sent_at');
    if (error) throw error;

    let sent = 0, skipped = 0;
    for (const r of rows ?? []) {
      const cfg = (r.email_digest ?? {}) as DigestConfig;
      if (!cfg.enabled) { skipped++; continue; }
      if (!isDue(cfg, r.last_digest_sent_at, now)) { skipped++; continue; }

      // Read the address from auth (the source of truth) rather than the
      // profiles mirror, which can be missing/stale and would silently skip them.
      const { data: authUser } = await admin.auth.admin.getUserById(r.user_id);
      const email = authUser?.user?.email;
      if (!email) { skipped++; continue; }

      try {
        const result = await sendFor(r.user_id, email, cfg, now, false);
        if (result.sent) sent++; else skipped++;
      } catch (e) {
        console.error('digest failed for', r.user_id, e);
      }
    }
    return json({ ok: true, sent, skipped });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
