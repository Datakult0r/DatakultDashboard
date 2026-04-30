# Control Tower — Progress Log

## Deployment: LIVE
- **URL**: https://datakult-dashboard.vercel.app
- **Vercel**: Production on `master` branch, CoAI team

## 2026-04-30 — Control Tower v3.0 (4-surface command center)

### What changed
- **Palette rewrite** — "Operator" dark editorial. Sage accent (focus), gold (money), coral (SLA breach), amber (warning), green (success). One color = one meaning. Replaces light cream palette where accent and warning collided.
- **10 tabs → 4 surfaces** — `NOW` (single best next action), `PIPELINE` (Customers + Job Apps), `INTAKE` (legacy categories as sub-tabs), `HEALTH`.
- **NOW surface** — hero card with the most important next action + 5 follow-ups. Reads from new `next_actions` SQL view.
- **PIPELINE surface** — new `customer_engagements` table + Kanban tracker (Lead → Discovery → Proposal → Won/Lost) with weighted ARR. Inline editing, stage advancement, value/probability tracking.
- **Runway widget** — header chip: month revenue · runway months · days since last buyer touch. New `monthly_finance` table + `/api/runway` computed metrics.
- **SLA tracking** — every approve sets `follow_up_at` (default 3d, configurable per action_type). New `sla_breaches` view. NowSurface surfaces overdue follow-ups as breaches.
- **Idempotency** — unique partial index on `(source, source_url, triage_date)` prevents duplicate inserts on cron retries.
- **New components** (uniform style): `NowSurface`, `RunwayWidget`, `EngagementCard`, `EngagementTracker`, `PipelineSurface`, `IntakeSurface`, `SLABadge`.
- **New API routes**: `/api/engagements`, `/api/engagements/[id]`, `/api/finance`, `/api/runway`. All standardized (force-dynamic, nodejs runtime, identical error shape).

### Outstanding
- Gmail OAuth refresh token still revoked (see project_control_tower_v21.md).

## 2026-04-30 — Control Tower v2.1 (data-drift fix + Health tab + Today filter)

### Why this matters
Audit revealed three silent failures that made the dashboard look healthier than it was:
1. **Approval Queue was always empty** — DB stored `action_status = 'pending'` (legacy writers) but UI filtered for `'pending_review'`. Items existed but never rendered. 5 items recovered after migration.
2. **Cron has been failing for 2+ days** — `gmail` step throws `invalid_grant: Bad Request` on every run; `apify`, `firecrawl`, `perplexity` all `skipped` because env vars not set in production. No surface in the UI to spot this.
3. **Every page load logged a Next.js 16 metadata warning** — `viewport` was nested in `metadata` instead of being its own export.

### Shipped
- **DB migration (Supabase)** — Normalized `action_status` (`pending`→`pending_review`, `completed`→`executed`, `none`→NULL) and `action_type` (`reply`→`send_message`, `monitor/none`→NULL). Added CHECK constraints so future writers can't drift again.
- **`triage_stats` view rebuilt** — now exposes `pending_actions_count`, `approved_actions_count`, `executed_actions_count`. The "To Approve" stat card now reads from the view instead of guessing client-side.
- **`system_health_summary` view (new)** — latest row per source/operation in the last 7 days, ranked.
- **`SystemHealthPanel` component (new)** + **Health tab** in dashboard — green/red/grey tiles per integration, last-run age, error preview, OK/Error/Skipped/Fallback/Timeout breakdown. First-class operational visibility.
- **`/api/health/env` route (new)** — reports which env vars are present (no values) so we can diagnose missing keys from the dashboard or curl.
- **Date scope filter** in header — `Today / 24h / 7d / All` pills. All tabs honour it. Stops 14-day mix from drowning today's signal.
- **Defensive filters** — ApprovalQueue + DashboardShell now treat both `pending_review` (canonical) and `pending` (legacy) as pending during the rollout window.
- **layout.tsx** — `viewport` exported separately. Killed the `Unsupported metadata view` warning on every render.
- **Title rebrand** — "Control Tower | Clinic of AI" instead of "Morning Triage".

### Outstanding (require user action)
- **Gmail OAuth refresh token revoked** — needs a fresh token via `get-refresh-token.py` (or equivalent OAuth dance), then `vercel env rm GMAIL_REFRESH_TOKEN production && vercel env add GMAIL_REFRESH_TOKEN production`.
- **Production env vars missing**: `APIFY_API_TOKEN`, `FIRECRAWL_API_KEY`, `PERPLEXITY_API_KEY` — verify they're set in Vercel project settings (memory said they were; system_health says they're not).
- The two `dirty=1` deployments in the rollback list (016f852, 763810e) suggest some manual `vercel deploy --prod` runs that bypassed git. Worth pruning to keep the trail clean.

### Original Deployment Reference
- Pre-fix commit: c7896db (Control Tower v2 - all 4 phases complete)

## Phase 1: Backend Integrations
- [x] Perplexity news (sonar-pro, 3 queries, dedup) — `src/lib/perplexity.ts`
- [x] Google Calendar API (reuses Gmail OAuth) — `src/lib/calendar.ts`
- [x] Apify actors verified (curious_coder, misceres) — `src/lib/apify.ts`

## Phase 2: Data Pipeline Enrichment
- [x] News images + hover abstracts — `src/components/NewsCard.tsx`
- [x] Personal email (2nd Gmail account) — `src/lib/gmail.ts`
- [x] 21-day retention, pending items kept forever — `collect/route.ts`
- [x] CV Tailoring engine (Claude API) — `src/lib/cv-tailor.ts`

## Phase 3: Job Application Automation
- [x] Easy Apply via Browser Use Cloud v3 — `src/lib/browser-use.ts`
- [x] 0-credit alert banner — `src/components/SystemAlert.tsx`
- [x] Website apply workflow + pipeline tracking — `api/actions/apply-website/`

## Phase 4: AG-UI/A2UI Polish
- [x] CSS 3D card flip on JobCard (score breakdown, cover letter, CV notes)
- [x] Hover-to-expand abstracts on NewsCard
- [x] Chat widget (Claude-powered bottom panel) — `src/components/ChatWidget.tsx`
- [x] Error boundary — `src/components/ErrorBoundary.tsx`
- [x] Loading skeletons — `src/components/LoadingSkeleton.tsx`
- [x] Slide-up animation for chat panel

## New Files Created
- `src/lib/perplexity.ts` — Perplexity API for AI news
- `src/lib/calendar.ts` — Google Calendar integration
- `src/lib/cv-tailor.ts` — Claude-powered CV tailoring
- `src/lib/browser-use.ts` — Browser Use Cloud Easy Apply
- `src/components/ChatWidget.tsx` — NL dashboard assistant
- `src/components/ErrorBoundary.tsx` — React error boundary
- `src/components/LoadingSkeleton.tsx` — Shimmer loading states
- `src/components/SystemAlert.tsx` — Dashboard-wide alert banner
- `src/app/api/chat/route.ts` — Chat API endpoint
- `src/app/api/actions/apply/route.ts` — Easy Apply execution
- `src/app/api/actions/apply-website/route.ts` — Website apply workflow

## TypeScript Fixes
- Added `gmail_personal` to SourceType union
- Added `gmail_personal` entry in SourceTag colorMap
- Added `gmail_personal` entry in TriageCard sourceIcon map
