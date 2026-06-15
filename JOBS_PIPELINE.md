# Job-Apply Pipeline

> **Single source of truth: `triage_items`** with `action_type IN ('apply_job_easy', 'apply_job_website')`.
> `philippe_jobs` is legacy fallback only — kept for backward compatibility with the bumps-discovery cron.

## Discovery sources (what feeds the pipeline)

All sources funnel into one gate: every job is scored by `job-scoring.ts` (0-100). Only `score ≥ 65` gets a cover letter and is queued to apply. "Recommended" is a discovery signal, **never** a bypass of scoring.

| Source | Login? | Risk | Lane |
|---|---|---|---|
| **Apify LinkedIn search — keyword** (queries × DACH/CH/DE/AT + USA + remote pools) | none (public) | zero | easy if listing is Easy Apply, else website |
| **Apify LinkedIn search — Easy-Apply-only** (`f_AL=true` filter) | none (public) | zero | `apply_job_easy` (forced `easyApply=true`) |
| **Company career pages** (Firecrawl resolves direct apply URL) | none | zero | `apply_job_website` (fill-then-hold) |
| **Gmail "recommended for you" / job-alert emails** *(activates when Gmail OAuth is restored)* | reads inbox only | zero LinkedIn footprint | scored → easy or website |

**Why recommended-jobs come from Gmail, not the LinkedIn feed:** reading the emails LinkedIn already sends has no automation footprint on the account. Scraping the logged-in "recommended for you" feed is exactly the behavior LinkedIn's bot detection flags — it is **forbidden** (see anti-detection section). `linkedin.com/in/pkfde` is the #1 asset.

## ⛔ Anti-detection — sanctioned controllers only

Only **two** browser controllers are sanctioned anywhere in this pipeline:

1. **Browser Use Cloud v3** — for server-side automation (Vercel cron, `/api/actions/apply`, `/api/jobs/auto-apply`, `/api/jobs/easy-apply`). Wraps stealth + fingerprint hygiene we pay for.
2. **computer-use** — for desktop-driven sessions where Philippe is at the keyboard (NOT used by this cron — cron has no desktop).

**Forbidden** (do not propose, scaffold, wire, or hint at):
Playwright (any variant), Puppeteer, Selenium, undetected-chromedriver, rebrowser-* patches, any self-hosted Chromium that touches a logged-in LinkedIn / job-board session. Not as primary. Not as fallback. Not as experiment.

LinkedIn's bot detection probes IP fingerprints, storageState replay anomalies, and CDP runtime signatures faster than any open-source patch can keep up. `linkedin.com/in/pkfde` is the company's #1 asset and the rule is non-negotiable.

The anti-detection envelope (cap, randomized delays, halt-on-failure, 24h cool-off) is also non-negotiable — do not lower any value without re-reading `feedback_no_playwright.md` and `feedback_linkedin_protocol.md`.

## State machine

```
                     +----------------+
                     | pending_review |   <-- agent drafts cover letter + tailored CV notes
                     +-------+--------+
                             |
                             v
                     +----------------+
                     |    approved    |   <-- Philippe clicks "Approve" on dashboard
                     +-------+--------+
                             |
                             v   /api/jobs/auto-apply (cron 09:00 UTC)
                     +----------------+   /api/actions/apply (manual button)
                     |   executing    |
                     +-------+--------+
                             |
                  +----------+----------+
                  v                     v
          +-------+-------+     +-------+-------+
          |   executed    |     |    failed     |   <-- one FAILED in last 24h
          +---------------+     +---------------+       halts the next cron run
          (+ row written
           to job_applications)
```

## Endpoints

| Endpoint | Trigger | What it does |
|---|---|---|
| `GET /api/jobs/auto-apply` | Vercel cron, 09:00 UTC | Reads `approved` rows from `triage_items` (primary) or `philippe_jobs` (fallback), submits up to `AUTO_APPLY_DAILY_CAP` (default 5) via Browser Use. |
| `POST /api/actions/apply` | Dashboard "Apply" button | Same as above but for an explicit `{ids:[...]}` list. Handles both easy + website in parallel buckets. |
| `POST /api/actions/approve` | Dashboard "Approve" button | Flips `action_status` from `pending_review` to `approved`. |
| `POST /api/actions/run-approved` | Admin endpoint | Bulk-marks all `approved` as `executed` WITHOUT calling Browser Use. Use only when you've applied manually outside the system. |

## Browser Use executors

| `action_type` | Executor | Instructions style |
|---|---|---|
| `apply_job_easy` | `executeEasyApply` | LinkedIn-flavored: "Click Easy Apply button" |
| `apply_job_website` | `executeWebsiteApply` | Generic ATS: "Find Apply button on company's career page, fill standard fields, skip if required CV upload is missing" |

Both share the same anti-detection envelope:

- Verify auth once per batch (cheap GET to Browser Use API)
- Max 5 tasks per executor call
- 30-90s randomized delay between submissions
- 90-180s randomized delay between submissions inside the cron run
- One FAILED row in 24h → cron auto-pauses next run (`auto_pause_24h` fallback)

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `AUTO_APPLY_DAILY_CAP` | `5` | Max applications per cron run (hard ceiling 10; documented-safe, ≤25/day across the 3 jittered windows) |
| `BROWSER_USE_API_KEY` | required | Browser Use Cloud API key, header `X-Browser-Use-API-Key` |
| `CRON_SECRET` | required | Bearer token required on the cron GET endpoint |

## How to verify the pipeline is healthy

```sql
SELECT DATE(updated_at) AS day,
       COUNT(*) FILTER (WHERE action_status = 'executed') AS sent,
       COUNT(*) FILTER (WHERE action_status = 'approved') AS approved_waiting,
       COUNT(*) FILTER (WHERE action_status = 'failed' AND updated_at > NOW() - INTERVAL '24h') AS recent_failed,
       COUNT(*) FILTER (WHERE action_status = 'executing' AND updated_at < NOW() - INTERVAL '6h') AS stuck_executing
FROM triage_items
WHERE action_type IN ('apply_job_easy', 'apply_job_website')
  AND updated_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(updated_at)
ORDER BY day DESC;
```

Healthy day: `sent >= 1`, `approved_waiting <= 5`, `recent_failed = 0`, `stuck_executing = 0`. If `stuck_executing > 0` over 6h, manually reset those rows to `approved`.

## Common pitfalls

1. **DO NOT read from `philippe_jobs` in new code.** It's a legacy table from the bumps discovery pipeline. The cron only falls back to it when `triage_items` is empty.
2. **DO NOT skip the state-machine steps.** Always go `approved → executing → executed/failed`, never directly to `executed`.
3. **DO NOT bulk-mark via `/api/actions/run-approved` without realizing** — it stamps `executed` without sending. That's only for when you've applied by hand outside the system.
4. **When the cron returns `paused: true`**, check `system_health` for the FAILED row that triggered the cool-off. Common cause: Browser Use ran out of credits, a CAPTCHA blocked submission, or a job posting was already filled.
5. **`action_payload.job_url` overrides `source_url`** — useful when LinkedIn discovery surfaces a job and the agent later resolves the company's direct apply URL.
6. **`easyApply` drives `action_type`.** A scored job (≥65) with `easyApply=true` routes to `apply_job_easy` (autonomous LinkedIn lane); otherwise `apply_job_website` (fill-then-hold). The apply queue drains the easy lane first within the cap.

## Last bug fixed (2026-05-13)

Before today, the auto-apply cron only read `philippe_jobs` with `apply_type='easy_apply'`. Zero rows matched, so 35 approved drafts in `triage_items` sat unsent for 7 days. The fix: read `triage_items` first, fall back to `philippe_jobs`. The `apply/route.ts` manual endpoint was similarly extended to handle `apply_job_website` (not just `apply_job_easy`).

## Change log

### 2026-06-15 — Easy-Apply lane fed + recommended-from-Gmail planned (commit 7b5b224)
- **Routing bug fixed:** `triage/collect` previously hard-coded every scored job to `apply_job_website`, so the autonomous Easy Apply lane was starved (only 1 easy item ever existed). Now `easyApply=true` → `apply_job_easy`.
- **Discovery widened:** added a dedicated LinkedIn **Easy-Apply-only** pass (`f_AL=true`) and broadened locations to Switzerland/Germany/Austria + USA + remote pools. Still public scraping, no login.
- **Queue:** easy lane prioritised (drained first within the daily cap).
- **Anti-detection:** envelope preserved; cap default 3→5 (documented-safe, ≤ ceiling 10); Easy Apply prompt given stronger human pacing (variable reads, 2-6s pauses, small-increment scroll, pre-submit review pause).
- **Planned (needs Gmail OAuth restore):** parse LinkedIn/job-board "recommended for you" + alert emails → score → apply. Build against real email format; do not ship a blind parser.

### 2026-05-13 — see "Last bug fixed" above.
