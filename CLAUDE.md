# Triage Dashboard - Development Guide

## Stack
- **Framework**: Next.js 16.2.2
- **React**: 19.2.4 with client/server component architecture
- **Styling**: Tailwind CSS 4 with custom dark theme
- **Database**: Supabase with realtime subscriptions
- **UI**: A2UI/AG-UI pattern for agentic approval queue

## Architecture

### Components
All components are located in `src/components/` and follow a single-file-per-component pattern:
- **SourceTag** - colored badges for source types
- **StatCard** - large stat display (ClickUp-style)
- **TriageCard** - urgent/review item cards with expandable drafts
- **ScoreChip** - reusable score badges with color coding
- **PipelineFunnel** - pipeline visualization
- **ApplicationTracker** - application status tracking
- **ApplicationRow** - individual application row
- **ApprovalQueue** - agentic action approval queue
- **ActionCard** - declarative action card display
- **JobCard** - job pipeline card with easy-apply flag
- **NewsCard** - news item with thumbnail (80x60px)
- **ScheduleRow** - calendar item row
- **DashboardShell** - main tab-based shell with realtime subscription

### Type System
TypeScript strict mode enabled. Key types in `src/types/triage.ts`:
- `TriageCategory` - urgent, review, job, news, schedule, done
- `ScoreLabel` - strong, apply, light, skip, priority
- `ActionType` - send_message, apply_job_easy, apply_job_website, etc.
- `ActionStatus` - pending_review, approved, rejected, executing, executed, failed
- `TriageItem` - A2UI fields including action_type, action_payload, action_status
- `JobApplication` - with method (easy_apply, website, referral, recruiter, manual)

### API Routes
Located in `src/app/api/`:
- `POST /api/actions/approve` - approve triage actions
- `POST /api/actions/reject` - reject triage actions
- `POST /api/applications/status` - update job application status

### Styling
Custom dark theme with color tokens:
- Base colors: `--color-base`, `--color-surface`, `--color-elevated`
- Semantic: `--color-primary`, `--color-secondary`, `--color-accent`
- Status: `--color-danger`, `--color-warning`, `--color-success`, `--color-info`
- Animations: `fadeSlideUp`, `fadeIn`, `shimmer`, `pulseGlow`

## Development

### Before Writing Code
1. Read all project files
2. Review design system in tailwind.config.ts
3. Check component patterns for consistency

### Component Guidelines
- Every component gets its own file
- Use named and default exports
- Add JSDoc comments to component props
- Keep files under 200 lines
- Use TypeScript strict mode

### Verification
- Run `npm run build` after major sections
- Check dev server renders correctly
- Log progress to PROGRESS.md
- Fix build errors before moving on

## References
- See `@AGENTS.md` for Next.js 16 breaking changes
- See `PROGRESS.md` for build history and component status
