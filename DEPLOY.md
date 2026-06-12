# Control Tower v3 — Deploy Guide

Branch: `claude/control-tower-v3` (11 commits on top of `main`). Build + lint verified green.

## 1. Push & deploy

```bash
git push origin claude/control-tower-v3
```

Open a PR, review the commits (each is self-contained), merge when satisfied.
Vercel deploys `main` automatically; crons come from `vercel.json`:

| Cron | Time (UTC) | What |
|---|---|---|
| `/api/triage/collect` | 07:00 | discovery, scoring, cover letters, news |
| `/api/actions/execute` | 09:23, 13:47, 17:11 | finalize → pace → launch → follow-ups → DM sweep |

## 2. Environment variables (Vercel → Settings → Environment Variables)

Existing (keep): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `APIFY_API_TOKEN`,
`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`,
`GMAIL_REFRESH_TOKEN_PERSONAL`, `PERPLEXITY_API_KEY`, `FIRECRAWL_API_KEY`, `CRON_SECRET`.

New / changed:

| Var | Required | Notes |
|---|---|---|
| `BROWSER_USE_API_KEY` | yes | **v3 key (`bu_…`)** — the old v1 key/endpoints are dead (404) |
| `BROWSER_USE_PROFILE_ID` | yes for Easy Apply + DM sweep | Create a profile at cloud.browser-use.com, log in to LinkedIn in it ONCE. Easy Apply refuses to run without it (account safety) |
| `DASHBOARD_PASSWORD` | strongly recommended | Gates the dashboard + APIs (they were fully public) |
| `PHILIPPE_PHONE` | recommended | Real phone for forms (code had a `+351 XXX` placeholder!) |
| `CV_PUBLIC_URL` | recommended | Public URL of current CV PDF (Supabase Storage) so agents can upload it |
| `ENABLE_EASY_APPLY` | opt-in (`true`) | Easy Apply postings get `apply_job_easy` actions |
| `ENABLE_DM_SWEEP` | opt-in (`true`) | Daily LinkedIn DM sweep (answers recruiters directly) |
| `DAILY_APPLY_CAP` | default 5 | LinkedIn/day. Ramp: 5 → 10 (week 2) → 15-20. Never >25 |
| `MAX_APPLIES_PER_RUN` | default 2 | Per cron window |
| `WEBSITE_FILL_CAP` / `WEBSITE_FILLS_PER_RUN` | default 20 / 7 | Website volume — cost-bound, not ban-bound. This is the road to 50/day |
| `BROWSER_USE_WEBSITE_MODEL` | optional | Cheap model for website fills (e.g. gemini flash class) |
| `BROWSER_USE_MAX_COST_USD` / `BROWSER_USE_WEBSITE_MAX_COST_USD` | 1.5 / 0.75 | Per-session cost guards |
| `DM_SWEEP_MAX_REPLIES` | default 8 | Replies per daily sweep |

## 3. Manual security actions (cannot be done from code)

1. **Rotate the Supabase anon key** — it is committed to this public repo
   (`write_env.js`), and the service key may have leaked the same way.
2. **Enable RLS** on `triage_items`, `job_applications`, `system_health`,
   `content_drafts`, `philippe_jobs`, `philippe_intelligence` (read for anon
   only if you keep client-side realtime; the dashboard works through the
   password gate either way).
3. Set `DASHBOARD_PASSWORD` before sharing any dashboard URL again.
4. Delete `write_env.js` / `set_vars.bat` from the repo history if the keys
   stay (git filter-repo), or just rotate (simpler).

## 4. Browser Use profile setup (one time, 5 minutes)

1. cloud.browser-use.com → Profiles → New profile (name: `linkedin-philippe`)
2. Open the profile's live view → log in to linkedin.com/in/pkfde → close.
3. Copy the profile id → `BROWSER_USE_PROFILE_ID` in Vercel.
4. The profile keeps cookies between sessions; sessions always run with
   `proxyCountryCode: 'pt'` so the IP stays Portuguese like you.

## 5. How the day flows after deploy

- 07:00 — collect: jobs discovered (DACH-first), deduped, scored, cover
  letters + CV notes for ≥65, career pages found.
- You approve in the dashboard (Approve tab). That's your only mandatory touch.
- 09:23 / 13:47 / 17:11 — executor windows: Easy Apply sessions launch
  (capped, jittered, verified), website forms auto-filled then held at the
  submit button; "Ready to send" items wait in the Launch tab for one click;
  follow-ups drafted for 7-day-silent applications; ghosts marked at 21 days;
  one DM sweep per day answers recruiters in your voice.
- Health bar shows every source's last run; Launch tab shows everything moving.

## 6. Repo/production split (important)

The live deployment (runway, BUMPS, run-sheet) is NEWER than GitHub main —
that source exists only on your other machine (`push.bat` points to
`C:\Users\phili\Documents\DatakultDashboard_temp`). Push that to a branch so
the two lines can be reconciled; until then, deploying main will REPLACE the
newer UI. Decide before merging.
