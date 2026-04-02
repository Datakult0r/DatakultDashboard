/**
 * Type definitions for Triage Dashboard
 * Includes AG-UI / A2UI action types for the agentic approval queue
 */
export type TriageCategory = 'urgent' | 'review' | 'job' | 'news' | 'schedule' | 'done';
export type TriageStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type ScoreLabel = 'strong' | 'apply' | 'light' | 'skip' | 'priority';
export type SourceType = 'email' | 'linkedin' | 'beeper' | 'calendar' | 'other';

export type ActionType = 'send_message' | 'apply_job_easy' | 'apply_job_website'
  | 'accept_connection' | 'review_document' | 'reply_email' | null;

export type ActionStatus = 'pending_review' | 'approved' | 'rejected'
  | 'executing' | 'executed' | 'failed' | null;

export interface ActionPayload {
  chat_id?: string;
  message_text?: string;
  job_url?: string;
  company_career_url?: string;
  profile_url?: string;
  email_to?: string;
  email_subject?: string;
  email_body?: string;
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
