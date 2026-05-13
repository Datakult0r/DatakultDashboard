# MCP Health Check — Pre-Triage Probe

Runs as **Step 0.5** of morning triage, BEFORE the Gmail/Calendar/Beeper pipeline kicks off. The goal: catch dead connectors on day-1 instead of discovering them three days later when triage_items has a silent gap.

## Why

Per `feedback_mcp_failure_modes.md`, the four recurring failure modes are:
1. RPC timeouts that look like failures
2. Chrome MCP extension handshake bug
3. OAuth-backed connectors dying at refresh-token boundaries
4. SSL cert verification on Windows-Store Python

The health check probes (1) (3) directly. It can't fix (2) or (4) — only flag them.

## How to invoke from the scheduled task

Add this section to `morning-triage` SKILL.md immediately after **STEP 0 — LOAD CONTEXT** and before **STEP 1 — GMAIL TRIAGE**:

```markdown
## STEP 0.5 — MCP HEALTH CHECK
Probe each connected MCP with a no-op call. Write one row per source to system_health.
Follow the probe table in triage-dashboard/MCP_HEALTH_CHECK.md.
If ANY probe is `status='error'` AND `source` is in the critical-path list
(gmail, calendar, beeper, supabase), HALT triage and surface the error.
Non-critical errors are logged but do NOT block triage.
```

## Probe table

Each row = one MCP server. Run the probe call, classify the response, write a row to `system_health` with `operation='health_probe'`.

| Source | Probe call | Healthy signal | Critical path? | Auto re-auth tool |
|---|---|---|---|---|
| `gmail` | `mcp__02dc...__list_labels` (top 5) | response has `labels` array | ✓ | manual: re-mint refresh token |
| `calendar` | `mcp__76e7...__list_calendars` (pageSize=5) | response has `items` array | ✓ | manual: same OAuth as Gmail |
| `beeper` | `mcp__Beeper_Desktop__get_accounts` | response lists ≥1 account | ✓ | manual: relog Beeper Desktop |
| `supabase` | `mcp__a810...__list_projects` | response lists ≥1 project with `status='ACTIVE_HEALTHY'` | ✓ | n/a (PAT-based) |
| `notion` | `notion-get-users` (pageSize=1) | response has `results` | | `plugin_brand-voice_notion__authenticate` |
| `chrome` | `mcp__Claude_in_Chrome__list_connected_browsers` | response has ≥1 deviceId | | reload extension |
| `windows-mcp` | `PowerShell` with `echo ok` | output contains `ok` | ✓ | restart Windows-MCP host |
| `computer-use` | `list_granted_applications` | returns array | | re-grant via request_access |
| `apollo` | `apollo:enrich-lead` no-op (skill) | skill executes | | `plugin_apollo_apollo__authenticate` |
| `linear` | issue list (1) | response has issues | | `plugin_engineering_linear__authenticate` |
| `slack` | `slack_read_user_profile` self | returns profile | | `plugin_legal_slack__authenticate` |
| `figma` | `whoami` | returns user | | `plugin_brand-voice_figma__authenticate` |
| `atlassian` | space list (1) | returns spaces | | `plugin_legal_atlassian__authenticate` |
| `ms365` | mail-fold list | returns folders | | `plugin_legal_ms365__authenticate` |
| `box` | folder list (1) | returns folder | | `plugin_legal_box__authenticate` |
| `github` | `n/a` (auth-only) | n/a | | `plugin_engineering_github__authenticate` |
| `gong` | `n/a` (auth-only) | n/a | | `plugin_brand-voice_gong__authenticate` |
| `granola` | `n/a` (auth-only) | n/a | | `plugin_brand-voice_granola__authenticate` |
| `intercom` | `n/a` (auth-only) | n/a | | `plugin_design_intercom__authenticate` |
| `asana` | task list (1) | returns tasks | | `plugin_engineering_asana__authenticate` |
| `pagerduty` | service list (1) | returns services | | `plugin_engineering_pagerduty__authenticate` |
| `guru` | card list (1) | returns cards | | `plugin_enterprise-search_guru__authenticate` |
| `egnyte` | folder list (1) | returns folders | | `plugin_legal_egnyte__authenticate` |
| `docusign` | n/a | n/a | | check Docusign plugin |
| `datadog` | metric list (1) | returns metrics | | check plugin |

## Status classification

For each probe:
- `'ok'` — call succeeded with expected shape (write `items_count` = result count where applicable)
- `'timeout'` — RPC timed out (default 5s probe deadline). Write `duration_ms` = actual elapsed.
- `'error'` — call returned 401/403/500 OR shape was unexpected. Write `error_code` + `error_message`.
- `'fallback'` — call hit a degraded path (e.g. Chrome MCP banner shows but list_connected_browsers returns empty). Write `metadata.fallback_used`.
- `'skipped'` — connector intentionally not probed this run.

## Batch SQL insert

After all probes complete, write rows in one INSERT:

```sql
INSERT INTO system_health (source, operation, status, items_count, duration_ms, error_message, error_code, metadata)
VALUES
  ('gmail',    'health_probe', 'ok',      5, 380,  NULL, NULL, '{"probe":"list_labels"}'::jsonb),
  ('calendar', 'health_probe', 'ok',      4, 420,  NULL, NULL, '{"probe":"list_calendars"}'::jsonb),
  ('beeper',   'health_probe', 'ok',      3, 110,  NULL, NULL, '{"probe":"get_accounts"}'::jsonb),
  ('chrome',   'health_probe', 'error',   0, 200,  'list_connected_browsers returned empty for 3 consecutive calls', 'HANDSHAKE_FAIL', '{"probe":"list_connected_browsers","retries":3}'::jsonb),
  -- ... etc
;
```

## Dashboard query

The view `connector_health_latest` was created in Supabase on 2026-05-13 — query it directly:

```sql
SELECT source, health_label, last_check_at, hours_since_check, error_message
FROM connector_health_latest
WHERE health_label != 'HEALTHY'
ORDER BY
  CASE health_label
    WHEN 'BROKEN'   THEN 1
    WHEN 'TIMEOUT'  THEN 2
    WHEN 'STALE'    THEN 3
    WHEN 'DEGRADED' THEN 4
    ELSE 5
  END;
```

Show this on the Health tab of the dashboard (component already exists per `project_control_tower_v21.md`).

## Halt-on-failure rule

If ANY of `gmail`, `calendar`, `beeper`, or `supabase` returns `status='error'` from the probe:
1. Write to system_health
2. Write a single `triage_items` row with `category='urgent'`, `priority=10`, title=`"Triage halted — {source} unreachable"`, `action_type='review_document'`
3. Do NOT proceed with triage pipeline
4. Notify Philippe via `mcp__Windows-MCP__Notification`

Non-critical connector failures (slack/notion/linear/etc) write to system_health but **do not block** the run.

## Re-auth trigger

For each `status='error'` connector that has an `__authenticate` tool listed in the probe table, the agent SHOULD call that tool unprompted at the end of the run, surface the OAuth URL in a notification, and write a follow-up triage item asking Philippe to complete the consent dance.

## Rationale

Today's session (2026-05-13) burned ~1 hour because the Chrome MCP was silently broken and the personal Gmail token had silently died 9 days ago. Both failures were invisible until they bit. A 30-second probe at the start of every triage would have surfaced both on day-1.
