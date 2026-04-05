/**
 * Type definitions for the triage dashboard
 */

export type TriageCategory =
  | 'urgent'
  | 'review'
  | 'job'
  | 'news'
  | 'schedule'
  | 'done';

export type ScoreLabel = 'strong' | 'apply' | 'light' | 'skip' | 'priority';

export type SourceType =
  | 'email'
  | 'linkedin'
  | 'beeper'
  | 'calendar'
  | 'other';

export type ActionType =
  | 'send_message'
  | 'apply_job_easy'
  | 'apply_job_website'
  | 'accept_connection'
  | 'review_document'
  | 'reply_email'
  | null;

export type ActionStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'executed'
  | 'failed'
  | null;

export interface ActionPayload {
  chat_id?: string;
  message_text?: string;
  job_url?: string;
  job_id?: string;
  document_url?: string;
  [key: string]: unknown;
}

export interface TriageItem {
  id: string;
  category: TriageCategory;
  title: string;
  source: SourceType;
  content: string;
  created_at: string;
  priority: number;

  // A2UI fields for agentic actions
  action_type: ActionType;
  action_payload: ActionPayload | null;
  action_status: ActionStatus;
  cover_letter?: string;
  tailored_cv_notes?: string;
  tailored_cv_url?: string;
}

export interface JobApplication {
  id: string;
  company: string;
  position: string;
  score: number;
  score_label: ScoreLabel;
  method: 'easy_apply' | 'website' | 'referral' | 'recruiter' | 'manual';
  status: 'applied' | 'screening' | 'interview' | 'offer' | 'rejected' | 'ghosted' | 'withdrawn';
  applied_date: string;
  url?: string;
  notes?: string;
}

export interface TriageStats {
  total_items: number;
  urgent_count: number;
  review_count: number;
  applications_count: number;
  applied_this_week: number;
}
