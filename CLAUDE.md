# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**CueTasks** — a voice-powered, local-first task management PWA. Tagline: _Say it. Cue it. Get it done._ (Formerly **TaskVoice**; the rebrand to CueTasks is complete — see "Rebrand" below.) Registered domain: `cuetasks.com`.

Originally scaffolded on Bolt.new (`bolt-vite-react-ts` template), now migrated to local development.

## Tech Stack

- **React 18** + **TypeScript** + **Vite 5**
- **Tailwind CSS 3** for styling
- **lucide-react** for icons (per Bolt convention: use lucide-react for logos/icons; do not add other UI/icon libraries unless requested)
- No backend — state persists to `localStorage` (keys: `tasks`, `categories`, `theme`, `notificationSettings`); a **service worker** (`public/sw.js`) handles offline caching and background reminder notifications (uses IndexedDB `CueTasksDB`). A Supabase backend for sync/sharing/email + a Hermes MCP integration are designed in `docs/backend-architecture.md` (not yet built).
- Browser APIs: Web Speech API (voice), Web Audio API (alert sounds), Notifications API, Vibration API

## Commands

```bash
npm run dev      # start Vite dev server
npm run build    # production build
npm run preview  # preview production build
npm run lint     # eslint
```

There is no test suite configured.

## Deployment

- **Repo:** `github.com/apexdigitalminds/cuetasks` (owner: apexdigitalminds). Push to `main` to ship.
- **Host:** Vercel — auto-deploys `main`. Vite framework preset: build `npm run build`, output `dist`, no env vars (no backend). Production domain: `cuetasks.com`.
- **`vercel.json`** sets `Cache-Control: max-age=0, must-revalidate` + `Service-Worker-Allowed: /` on `/sw.js` so the service worker updates on each deploy rather than being cached. Keep these if editing `vercel.json`.
- `npm run build` runs `vite build` only (no `tsc`), so type/lint errors do **not** block deploys — run `npm run lint` and `tsc --noEmit -p tsconfig.app.json` locally before pushing.
- Never embed a credential/token in the git remote URL (origin was previously misconfigured this way).

## Architecture

- `src/App.tsx` — main layout, header, notification permission wiring, and component orchestration
- `src/main.tsx` — React entry point + service worker registration
- `src/contexts/TaskContext.tsx` — global state for tasks and categories (single source of truth; persists to `localStorage`)
- `src/types/index.ts` — core interfaces: `Task`, `Category`, `RecurrencePattern`
- `src/components/` — UI: `TaskForm`, `TaskList`, `TaskItem`, `TaskHistory`, `CategoryManager`, `DailySummary`, `ThemeToggle`, `ToastNotification`, `Logo` (brand mark)
- `src/utils/` — `speechRecognition.ts` (Web Speech wrapper), `recurrence.ts` (next-occurrence logic), `reminderChecker.ts` (in-app due-reminder polling), `audio.ts` (alert sounds), `dateUtils.ts`
- `public/sw.js` — service worker: cache + background push/reminder checks

## Conventions

- Mobile-first responsive layout; supports dark/light mode (Tailwind `dark:` classes)
- Keep designs polished and production-worthy (Bolt template guidance)
- State flows through `TaskContext` — prefer the context over prop-drilling or new stores

## Brand system (CueTasks)

The **TaskVoice → CueTasks** rename is complete across `index.html`, `src/App.tsx`, `public/sw.js`, `package.json`, and `README.md`. Persisted identifiers were intentionally moved to `CueTasksDB` (IndexedDB) and `cuetasks-v1` (SW cache) — a fresh install; any old TaskVoice local data is orphaned by design.

**Direction: "refined hybrid"** — keep the app's existing premium indigo→violet gradient as the hero look, layered with the CueTasks logo/wordmark. Blue is a secondary; green/amber/pink are reserved for category accents only.

- **Primary gradient** (`gradient-primary` in `src/index.css`): `#6366F1 → #8B5CF6 → #3B82F6` (also the logo gradient)
- **Secondary:** blue `#3B82F6` · **Dark:** `#0F172A` · **Light surface:** `#F1F5F9`
- **Category accents (only):** green `#22C55E`, amber `#F59E0B`, pink `#EC4899`
- **Status colours — one job each (don't overload):** category colour = a task's left **spine** (identity); green `#22C55E` = done / progress; amber `#F59E0B` = priority (starred); red (`red-*`) = overdue. Indigo→violet is the brand hero and is **never** a status colour. Overdue detection lives in `isOverdue()` (`src/utils/dateUtils.ts`); the accents render in `TaskItem`/`TaskList`.
- **Logo:** `src/components/Logo.tsx` — the reusable SVG brand mark (cue swoosh + check + sound waves). Use this component, don't inline the SVG.
- **App/PWA icon:** `public/icon.svg` — same mark in white on a gradient tile. `favicon.ico` in `public/` is still the old raster icon and should be regenerated from `icon.svg`.

When adding brand surfaces, prefer the `Logo` component and the `gradient-primary` utility over hard-coded values.

## Known Limitations

- iOS Safari restricts background voice listening and can make SW push notifications unreliable
- "Edit this and all future occurrences" for recurring tasks is not fully implemented
- Background push can be delayed when the tab is closed and the SW is terminated by the browser
