/**
 * Type definitions for Triage Dashboard
 * Includes AG-UI / A2UI action types for the agentic approval queue
 */

export type TriageCategory = 'urgent' | 'review' | 'job' | 'news' | 'schedule' | 'done';
export type TriageStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type ScoreLabel = 'strong' | 'apply' | 'light' | 'skip' | 'priority';
export type SourceType = 'email' | 'gmail' | 'gmail_personal' | 'linkedin' | 'linkedin_dm' | 'beeper' | 'whatsapp' | 'calendar' | 'system' | 'other';

/** A2UI Action Types — what the agent prepared for Philippe to approve */
export type ActionType =
  | 'send_message'
  | 'apply_job_easy'
  | 'apply_job_website'
  | 'accept_connection'
  | 'review_document'
  | 'reply_email'
  | null;

/** A2UI Action Status — lifecycle of an agentic action */
export type ActionStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'executed'
  | 'failed'
  | null;

/** Structured payload for different action types */
export interface ActionPayload {
  /** Target chat ID for messaging actions */
  chat_id?: string;
  /** Draft message text */
  message_text?: string;
  /** Job posting URL */
  job_url?: string;
  /** Company career page URL */
  company_career_url?: string;
  /** LinkedIn profile URL */
  profile_url?: string;
  /** Email address to reply to */
  email_to?: string;
  /** Email subject */
  email_subject?: string;
  /** Email draft body */
  email_body?: string;
  /** Any additional context */
  [key: string]: string | undefined;
}

export interface TriageItem {
  id: string;
  created_at: string;
  updated_at: string;
  category: TriageCategory;
  status: TriageStatus;
  title: string;
  subtitle: string | null;
  source: string;
  source_url: string | null;
  draft_reply: string | null;
  score: number | null;
  score_label: ScoreLabel | null;
  score_breakdown: Record<string, number> | null;
  company: string | null;
  role_title: string | null;
  location: string | null;
  salary_range: string | null;
  job_type: string | null;
  easy_apply: boolean | null;
  recruiter_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_url: string | null;
  news_source: string | null;
  news_image_url: string | null;
  event_time: string | null;
  event_end_time: string | null;
  event_location: string | null;
  event_url: string | null;
  tags: string[] | null;
  priority: number | null;
  triage_date: string | null;
  notes: string | null;
  action_type: ActionType;
  action_payload: ActionPayload | null;
  action_status: ActionStatus;
  cover_letter: string | null;
  tailored_cv_notes: string | null;
  tailored_cv_url: string | null;
  /** v3.0: SLA — when the human committed to follow up by */
  follow_up_at: string | null;
  /** v3.0: SLA — when the last follow-up actually happened */
  last_follow_up_at: string | null;
}

export interface TriageStat {
  triage_date: string;
  urgent_count: number;
  job_count: number;
  done_count: number;
  in_progress_count: number;
  /** Items the agent prepared and the human still needs to approve. */
  pending_actions_count: number;
  /** Items the human approved that are awaiting execution. */
  approved_actions_count: number;
  /** Items the agent has already executed. */
  executed_actions_count: number;
  total_count: number;
}

/** Snapshot row from the system_health_summary view — one row per integration step per cron run. */
export interface SystemHealthRow {
  cron_run_id: string;
  source: string;
  operation: string;
  status: 'ok' | 'error' | 'fallback' | 'skipped' | 'timeout';
  items_count: number;
  duration_ms: number;
  error_message: string | null;
  fallback_used: string | null;
  created_at: string;
  recency_rank: number;
}

/** Customer pipeline stages */
export type EngagementStage = 'lead' | 'discovery' | 'proposal' | 'won' | 'lost' | 'paused';

/** A customer engagement — separate from job_applications (which is the recruiter pipeline) */
export interface CustomerEngagement {
  id: string;
  created_at: string;
  updated_at: string;
  company: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_url: string | null;
  stage: EngagementStage;
  source: string | null;
  value_eur: number | null;
  probability: number | null;
  next_step: string | null;
  next_step_at: string | null;
  notes: string | null;
  tags: string[] | null;
  triage_id: string | null;
}

/** Monthly revenue/expenses for runway calc */
export interface MonthlyFinance {
  month: string;
  revenue_eur: number;
  expenses_eur: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Aggregated runway metric returned by /api/runway */
export interface RunwayMetrics {
  current_month: string;
  current_month_revenue_eur: number;
  current_month_expenses_eur: number;
  current_month_net_eur: number;
  trailing_3mo_avg_burn_eur: number;
  runway_months: number | null;
  cash_floor_eur: number;
  days_since_last_buyer_touch: number | null;
}

/** Row from sla_breaches view */
export interface SLABreach {
  id: string;
  title: string;
  subtitle: string | null;
  source: string;
  category: string;
  action_type: ActionType;
  action_status: ActionStatus;
  priority: number | null;
  score: number | null;
  contact_name: string | null;
  contact_url: string | null;
  follow_up_at: string;
  hours_overdue: number;
  days_overdue: number;
}

/** Row from next_actions view */
export interface NextAction {
  id: string;
  title: string;
  subtitle: string | null;
  source: string;
  category: string;
  action_type: ActionType;
  action_status: ActionStatus;
  priority: number | null;
  score: number | null;
  contact_name: string | null;
  contact_url: string | null;
  draft_reply: string | null;
  cover_letter: string | null;
  created_at: string;
  follow_up_at: string | null;
  reason: 'pending_review' | 'sla_breach' | 'engagement_due';
  rank_score: number;
  reason_priority: number;
}

/** Row from weekly_wins view (single-row aggregate) */
export interface WeeklyWins {
  actions_taken: number;
  actions_executed: number;
  won_value_eur: number;
  won_count: number;
  outbound_sent: number;
}

/** Row from outbound_daily view */
export interface OutboundDailyRow {
  log_date: string;
  count: number;
}

/** Single outbound log entry */
export interface OutboundLog {
  id: string;
  created_at: string;
  log_date: string;
  contact_name: string | null;
  contact_url: string | null;
  channel: string | null;
  context: string | null;
  result: string | null;
}

/** Row from pipeline_health view */
export interface PipelineHealthRow {
  stage: EngagementStage;
  count: number;
  total_value_eur: number;
  weighted_value_eur: number;
  last_activity: string;
}

export interface TriageItemsByCategory {
  urgent: TriageItem[];
  review: TriageItem[];
  job: TriageItem[];
  news: TriageItem[];
  schedule: TriageItem[];
  done: TriageItem[];
}

/** Application method — how the job was applied to */
export type ApplicationMethod = 'easy_apply' | 'website' | 'referral' | 'recruiter' | 'manual';

/** Application pipeline status */
export type ApplicationStatus = 'applied' | 'screening' | 'interview' | 'offer' | 'rejected' | 'ghosted' | 'withdrawn';

/** Job Application — persistent tracker (not subject to 14-day retention) */
export interface JobApplication {
  id: string;
  created_at: string;
  updated_at: string;
  company: string;
  role: string;
  job_url: string | null;
  location: string | null;
  salary_range: string | null;
  job_type: string | null;
  method: ApplicationMethod;
  status: ApplicationStatus;
  applied_date: string;
  follow_up_date: string | null;
  last_activity_date: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_url: string | null;
  recruiter_name: string | null;
  cover_letter: string | null;
  tailored_cv_notes: string | null;
  notes: string | null;
  source_triage_id: string | null;
  score: number | null;
  score_label: ScoreLabel | null;
}
