# Job-Apply Pipeline

> **Single source of truth: `triage_items`** with `action_type IN ('apply_job_easy', 'apply_job_website')`.
> `philippe_jobs` is legacy fallback only — kept for backward compatibility with the bumps-discovery cron.

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
| `GET /api/jobs/auto-apply` | Vercel cron, 09:00 UTC | Reads `approved` rows from `triage_items` (primary) or `philippe_jobs` (fallback), submits up to `AUTO_APPLY_DAILY_CAP` (default 3) via Browser Use. |
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
| `AUTO_APPLY_DAILY_CAP` | `3` | Max applications per cron run (hard ceiling 10) |
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

## Last bug fixed (2026-05-13)

Before today, the auto-apply cron only read `philippe_jobs` with `apply_type='easy_apply'`. Zero rows matched, so 35 approved drafts in `triage_items` sat unsent for 7 days. The fix: read `triage_items` first, fall back to `philippe_jobs`. The `apply/route.ts` manual endpoint was similarly extended to handle `apply_job_website` (not just `apply_job_easy`).
