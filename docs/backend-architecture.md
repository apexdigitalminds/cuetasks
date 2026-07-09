# CueTasks — backend & Hermes integration (design v1)

Status: **design / not yet built.** This captures the agreed direction so the
schema and the Hermes tool contract are reviewable before any code lands.

## Goal

One source of truth, many clients. The same tasks are reachable from the web
PWA, the phone (installed PWA), and **Hermes** (Nous Research's Hermes Agent,
running on a VPS and selecting LLMs via OpenRouter).

```
Supabase (Postgres + Auth + RLS + Realtime + Edge Functions)  ← source of truth
   ├── CueTasks PWA (web)      — Supabase Auth, local-first offline, syncs online
   ├── CueTasks PWA (phone)    — same app, installed
   └── CueTasks MCP server     — on the VPS, service credential
          └── Hermes Agent (MCP client) — reads/writes tasks as an assistant skill
Outbound email: Supabase Edge Function + pg_cron → mail provider (e.g. Resend) → inbox
```

CueTasks stays **local-first**: `localStorage` remains the offline layer; Supabase
is the sync target when signed in. Local-only (no account) keeps working.

## Confirmed decisions (v1)

- **Roles:** `owner` + `editor` + `viewer`. The **creator owns** a list and is the only one who manages membership (invite, change roles, delete); a separate "admin" tier is deferred until real team delegation is needed.
- **Sharing UX:** a **contextual "Share"** action on each list/task (invite + role) **and** a central **Sharing settings** page to review/revoke. No schema change either way.
- **Structure:** **flat** categories-as-lists — no nested sub-lists in v1 (tags are the lighter future option if grouping is needed).

## Data model

See [`supabase/schema.sql`](../supabase/schema.sql). Summary:

| Table | Purpose |
|-------|---------|
| `profiles` | mirror of `auth.users` (display name, email) |
| `user_settings` | theme, notification prefs, email-digest config (all per user) |
| `categories` | a category doubles as a shareable **list** |
| `category_members` | share a category/list with another user (`viewer`/`editor`) |
| `tasks` | tasks (mirrors the app's `Task` type + `owner_id`) |
| `task_shares` | share an individual task (`viewer`/`editor`) |

RLS gives access when you **own** a row, are a **member** of its category, or it's
**shared** with you. Cross-table checks use `SECURITY DEFINER` helpers to avoid
policy recursion.

## Auth model

- **PWA (web/phone):** Supabase Auth; every query runs as the signed-in user, RLS enforces scope.
- **Hermes MCP server (VPS):** no browser session. It holds a **Supabase service-role key** and always scopes calls to a configured `owner_user_id` (your account). Because every tool is written to take/scope a `user_id` internally, extending to multi-user later is just parameterising it — the contract doesn't change.

> Keep the service-role key server-side only (VPS env var). Never ship it to the PWA.

## Hermes MCP tool contract

A small MCP server (Python, `mcp`/FastMCP SDK, alongside Hermes Agent) exposes
these tools. Hermes discovers them and calls them like any other tool.

| Tool | Params | Returns |
|------|--------|---------|
| `list_tasks` | `{ date?, category?, status?: 'active'\|'completed'\|'all', overdue? }` | `Task[]` |
| `get_task` | `{ task_id }` | `Task` |
| `add_task` | `{ title, due_at?, category?, reminder_minutes?, recurrence? }` | `Task` |
| `update_task` | `{ task_id, patch }` | `Task` |
| `complete_task` | `{ task_id }` | `Task` |
| `delete_task` | `{ task_id }` | `{ ok }` |
| `list_categories` | `{}` | `Category[]` |
| `add_category` | `{ name, color?, icon? }` | `Category` |
| `tasks_due` | `{ within: 'today'\|'week' \| minutes }` | `Task[]` |
| `overdue_tasks` | `{}` | `Task[]` |
| `summarize_day` | `{ date? }` | `{ counts, tasks }` |

Registration: drop a config entry for the server into Hermes' MCP setup
(`optional-mcps/` or a custom MCP entry). See the Hermes Agent MCP docs.

## Outbound email digests

- Config lives in `user_settings.email_digest` (`enabled`, `frequency`, `send_at`, `scope`, `category_ids`, `task_ids`) — this is the "optionable in settings" selection (whole app, chosen category lists, or individual tasks).
- A **Supabase Edge Function** builds the digest for due/upcoming tasks in scope and sends via a mail provider (Resend/Postmark). Scheduled with **pg_cron**.
- Inbound email (create tasks by emailing) is explicitly **out of scope** for now.

## Notification settings (frontend, no backend)

Independent of the backend and shippable now. Config in `user_settings.notifications`
(and `localStorage` while offline): `sound`, `vibrate`, `notify_before`,
`notify_on_due`. Wire into `alertUser()`/`reminderChecker`.
(Also fix the broken reminder icon path in `src/utils/reminderChecker.ts`.)

## Phased plan

1. **Now (no backend):** notification settings + icon-bug fix; ship `cuetasks.com`.
2. **Foundation:** apply `schema.sql`; add Supabase Auth + optional cloud sync to the PWA (keep local-first).
3. **Hermes loop:** build + register the MCP server → Hermes can read/write tasks.
4. **Email digests:** Edge Function + pg_cron + provider, driven by `email_digest`.
5. **Sharing:** surface `category_members` / `task_shares` in the UI (invite, roles).

## Open questions

- Model/tier on OpenRouter (free vs. paid) — affects cost/context, not this design.
- Sync strategy for offline edits: last-write-wins vs. per-field merge (start with LWW + `updated_at`).
