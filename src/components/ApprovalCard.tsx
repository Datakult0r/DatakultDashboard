'use client';

import { useState } from 'react';
import {
  Check,
  X,
  Send,
  Briefcase,
  FileText,
  UserPlus,
  Mail,
  ChevronDown,
  ChevronUp,
  Loader2,
  Zap,
} from 'lucide-react';
import type { TriageItem, ActionStatus } from '@/types/triage';

interface ApprovalCardProps {
  /** The triage item with a pending action */
  item: TriageItem;
  /** Callback when action status changes */
  onStatusChange?: (id: string, newStatus: ActionStatus) => void;
}
/** Map action_type to human-readable label and icon */
function getActionMeta(actionType: string | null) {
  switch (actionType) {
    case 'send_message':
      return { label: 'Send Message', icon: Send, color: 'text-info' };
    case 'apply_job_easy':
      return { label: 'Easy Apply', icon: Zap, color: 'text-success' };
    case 'apply_job_website':
      return { label: 'Apply via Website', icon: Briefcase, color: 'text-accent' };
    case 'accept_connection':
      return { label: 'Accept Connection', icon: UserPlus, color: 'text-secondary' };
    case 'reply_email':
      return { label: 'Reply Email', icon: Mail, color: 'text-warning' };
    case 'review_document':
      return { label: 'Review Document', icon: FileText, color: 'text-primary' };
    default:
      return { label: 'Action', icon: Send, color: 'text-secondary' };
  }
}

/** Status badge colors */
function getStatusStyle(status: ActionStatus): string {
  switch (status) {
    case 'pending_review':
      return 'bg-warning/20 text-warning';
    case 'approved':
      return 'bg-success/20 text-success';
    case 'rejected':
      return 'bg-danger/20 text-danger';
    case 'executing':
      return 'bg-info/20 text-info';
    case 'executed':
      return 'bg-success/20 text-success';
    case 'failed':
      return 'bg-danger/20 text-danger';
    default:
      return 'bg-secondary/20 text-secondary';
  }
}
/**
 * Action card for the approval queue — shows prepared action details
 * with one-click Approve/Reject buttons
 */
export default function ApprovalCard({ item, onStatusChange }: ApprovalCardProps) {
  const [loading, setLoading] = useState(false);
  const [localStatus, setLocalStatus] = useState<ActionStatus>(item.action_status);
  const [showCoverLetter, setShowCoverLetter] = useState(false);
  const [showDraftReply, setShowDraftReply] = useState(false);

  const meta = getActionMeta(item.action_type);
  const Icon = meta.icon;
  const isPending = localStatus === 'pending_review';

  async function handleAction(action: 'approve' | 'reject') {
    setLoading(true);
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, action }),
      });
      if (res.ok) {
        const newStatus: ActionStatus = action === 'approve' ? 'approved' : 'rejected';
        setLocalStatus(newStatus);
        onStatusChange?.(item.id, newStatus);
      }
    } catch {
      // silently fail — will show stale state
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden hover:border-secondary/50 transition-all">
      {/* Header row */}
      <div className="p-4 flex items-start gap-3">
        <div className={`mt-0.5 ${meta.color}`}>
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusStyle(localStatus)}`}>
              {localStatus.replace('_', ' ')}
            </span>
            <span className="text-xs text-secondary">{meta.label}</span>
            {item.score != null && (
              <span className="text-xs font-mono text-accent">{item.score}pts</span>
            )}
          </div>
          <h3 className="text-base font-semibold text-primary mt-1 line-clamp-2">
            {item.title}
          </h3>
          {item.subtitle && (
            <p className="text-sm text-secondary mt-0.5 line-clamp-2">{item.subtitle}</p>
          )}
          {/* Job details */}
          {item.company && (
            <p className="text-xs text-secondary/80 mt-1">
              {item.company}
              {item.role_title && ` · ${item.role_title}`}
              {item.location && ` · ${item.location}`}
              {item.salary_range && ` · ${item.salary_range}`}
            </p>
          )}
        </div>
      </div>
      {/* Cover letter expandable */}
      {item.cover_letter && (
        <div className="border-t border-border">
          <button
            onClick={() => setShowCoverLetter(!showCoverLetter)}
            className="w-full px-4 py-2 flex items-center justify-between text-xs text-accent hover:bg-elevated/50 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <FileText size={12} />
              Cover Letter
            </span>
            {showCoverLetter ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showCoverLetter && (
            <div className="px-4 pb-3 text-sm text-secondary whitespace-pre-wrap">
              {item.cover_letter}
            </div>
          )}
        </div>
      )}

      {/* Draft reply expandable */}
      {item.draft_reply && (
        <div className="border-t border-border">
          <button
            onClick={() => setShowDraftReply(!showDraftReply)}
            className="w-full px-4 py-2 flex items-center justify-between text-xs text-info hover:bg-elevated/50 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Send size={12} />
              Draft Reply
            </span>
            {showDraftReply ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showDraftReply && (
            <div className="px-4 pb-3 text-sm text-secondary whitespace-pre-wrap">
              {item.draft_reply}
            </div>
          )}
        </div>
      )}
      {/* CV notes */}
      {item.tailored_cv_notes && (
        <div className="border-t border-border px-4 py-2">
          <p className="text-xs text-secondary/70">
            <span className="font-medium text-secondary">CV Notes:</span> {item.tailored_cv_notes}
          </p>
        </div>
      )}

      {/* Action buttons */}
      {isPending && (
        <div className="border-t border-border p-3 flex gap-2">
          <button
            onClick={() => handleAction('approve')}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-success/20 text-success hover:bg-success/30 font-medium text-sm transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Approve
          </button>
          <button
            onClick={() => handleAction('reject')}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-danger/20 text-danger hover:bg-danger/30 font-medium text-sm transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
            Reject
          </button>
        </div>
      )}

      {/* Post-decision status */}
      {!isPending && localStatus !== 'none' && (
        <div className="border-t border-border p-3 text-center">
          <span className={`text-sm font-medium ${localStatus === 'approved' ? 'text-success' : localStatus === 'rejected' ? 'text-danger' : 'text-secondary'}`}>
            {localStatus === 'approved' && '✓ Approved — queued for execution'}
            {localStatus === 'rejected' && '✗ Rejected'}
            {localStatus === 'executing' && '⟳ Executing...'}
            {localStatus === 'executed' && '✓ Executed successfully'}
            {localStatus === 'failed' && '✗ Execution failed'}
          </span>
        </div>
      )}
    </div>
  );
}