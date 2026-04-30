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
  /** A2UI: Type of action the agent prepared */
  action_type: ActionType;
  /** A2UI: Structured data for action execution */
  action_payload: ActionPayload | null;
  /** A2UI: Current status of the action */
  action_status: ActionStatus;
  /** Generated cover letter for job applications */
  cover_letter: string | null;
  /** CV customization notes for this role */
  tailored_cv_notes: string | null;
  /** URL to tailored CV PDF in Supabase storage */
  tailored_cv_url: string | null;
}

export interface TriageStat {
  triage_date: string;
  urgent_count: number;
  job_count: number;
  done_count: number;
  in_progress_count: number;
  total_count: number;
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
