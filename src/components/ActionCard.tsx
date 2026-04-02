'use client';

import { useState } from 'react';
import {
  CheckCircle2, XCircle, Send, Briefcase, UserPlus, FileText,
  Mail, ExternalLink, ChevronDown, ChevronUp, Loader2, Sparkles,
} from 'lucide-react';
import type { TriageItem, ActionType, ActionStatus } from '@/types/triage';
import SourceTag from './SourceTag';
import ScoreChip from './ScoreChip';

interface ActionCardProps {
  item: TriageItem;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}

const actionMeta: Record<NonNullable<ActionType>, { label: string; icon: typeof Send; color: string }> = {
  send_message: { label: 'Send Message', icon: Send, color: 'text-info' },
  apply_job_easy: { label: 'Easy Apply', icon: Briefcase, color: 'text-success' },
  apply_job_website: { label: 'Apply on Site', icon: Briefcase, color: 'text-accent' },
  accept_connection: { label: 'Accept Connection', icon: UserPlus, color: 'text-green-400' },
  review_document: { label: 'Review Document', icon: FileText, color: 'text-warning' },
  reply_email: { label: 'Reply Email', icon: Mail, color: 'text-blue-400' },
};

const statusColors: Record<NonNullable<ActionStatus>, { bg: string; text: string; label: string }> = {
  pending_review: { bg: 'bg-warning/15', text: 'text-warning', label: 'Pending Review' },
  approved: { bg: 'bg-success/15', text: 'text-success', label: 'Approved' },
  rejected: { bg: 'bg-danger/15', text: 'text-danger', label: 'Rejected' },
  executing: { bg: 'bg-info/15', text: 'text-info', label: 'Executing...' },
  executed: { bg: 'bg-success/15', text: 'text-success', label: 'Executed' },
  failed: { bg: 'bg-danger/15', text: 'text-danger', label: 'Failed' },
};

export default function ActionCard({ item, onApprove, onReject }: ActionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [localStatus, setLocalStatus] = useState(item.action_status);

  const meta = item.action_type ? actionMeta[item.action_type] : null;
  const status = localStatus ? statusColors[localStatus] : null;
  const IconComponent = meta?.icon || Sparkles;
  const isPending = localStatus === 'pending_review';

  const handleApprove = async () => {
    setIsProcessing(true);
    try { await onApprove(item.id); setLocalStatus('approved'); }
    catch { /* revert on error */ }
    finally { setIsProcessing(false); }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try { await onReject(item.id); setLocalStatus('rejected'); }
    catch { /* revert on error */ }
    finally { setIsProcessing(false); }
  };

  const sourceLink = item.contact_url || item.source_url || item.event_url || null;

  return (
    <div className={`group relative overflow-hidden rounded-lg border transition-all duration-300 ${
      isPending ? 'border-warning/30 bg-surface hover:border-warning/60 shadow-lg shadow-warning/5'
        : localStatus === 'approved' ? 'border-success/30 bg-surface/80'
        : localStatus === 'rejected' ? 'border-border bg-surface/50 opacity-60'
        : 'border-border bg-surface'
    }`}>
      {isPending && <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-warning via-warning/60 to-transparent" />}
      <div className="p-4 pl-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <SourceTag source={item.source} />
            {meta && (
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta.color}`}>
                <IconComponent size={14} /> {meta.label}
              </span>
            )}
            {status && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium ${status.bg} ${status.text}`}>
                {localStatus === 'executing' && <Loader2 size={12} className="animate-spin" />}
                {status.label}
              </span>
            )}
          </div>
          {item.score !== null && item.score_label && <ScoreChip score={item.score} label={item.score_label} />}
        </div>

        {/* Title and subtitle */}
        <h3 className="text-base font-semibold text-primary mb-1 leading-tight">{item.title}</h3>
        {item.subtitle && <p className="text-sm text-secondary mb-2 line-clamp-2">{item.subtitle}</p>}

        {/* Contact info with hyperlink */}
        {(item.contact_name || item.contact_email) && (
          <div className="text-xs text-secondary/80 mb-3 flex items-center gap-1">
            {sourceLink ? (
              <a href={sourceLink} target="_blank" rel="noopener noreferrer"
                className="text-accent hover:text-accent/80 underline underline-offset-2 inline-flex items-center gap-1">
                {item.contact_name || item.contact_email} <ExternalLink size={10} />
              </a>
            ) : <span>{item.contact_name}</span>}
            {item.contact_name && item.contact_email && <span className="text-secondary/50"> · {item.contact_email}</span>}
          </div>
        )}

        {/* Cover letter preview */}
        {item.cover_letter && (
          <div className="mb-3">
            <button onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent/80 transition-colors">
              <FileText size={14} /> {expanded ? 'Hide' : 'Preview'} Cover Letter
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {expanded && (
              <div className="mt-2 p-3 bg-elevated/80 rounded border border-border/50 text-xs text-secondary/90 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                {item.cover_letter}
              </div>
            )}
          </div>
        )}

        {/* Draft reply preview */}
        {item.draft_reply && !item.cover_letter && (
          <div className="mb-3">
            <button onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent/80 transition-colors">
              <Mail size={14} /> {expanded ? 'Hide' : 'Preview'} Draft Reply
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {expanded && (
              <div className="mt-2 p-3 bg-elevated/80 rounded border border-border/50 text-xs text-secondary/90 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto font-mono">
                {item.draft_reply}
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap mb-3">
            {item.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="inline-block px-2 py-0.5 rounded-sm text-xs bg-elevated text-secondary">{tag}</span>
            ))}
          </div>
        )}

        {/* Approve / Reject buttons */}
        {isPending && (
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
            <button onClick={handleApprove} disabled={isProcessing}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-success/15 text-success hover:bg-success/25 border border-success/20 hover:border-success/40 transition-all duration-200 disabled:opacity-50">
              {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Approve
            </button>
            <button onClick={handleReject} disabled={isProcessing}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-danger/10 text-danger/80 hover:bg-danger/20 hover:text-danger border border-danger/15 hover:border-danger/30 transition-all duration-200 disabled:opacity-50">
              <XCircle size={16} /> Reject
            </button>
          </div>
        )}

        {/* Source link for non-pending items */}
        {!isPending && sourceLink && (
          <div className="mt-3">
            <a href={sourceLink} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors">
              View source <ExternalLink size={12} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
