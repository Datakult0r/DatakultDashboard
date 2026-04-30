'use client';

import { useState } from 'react';
import {
  Copy,
  Check,
  ExternalLink,
  PhoneOff,
  Calendar,
  Clock,
  Send,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import type { TriageItem } from '@/types/triage';
import SourceTag from './SourceTag';
import ScoreChip from './ScoreChip';

interface MissedMeetingCardProps {
  /** The missed meeting triage item */
  item: TriageItem;
  /** Callback when user approves sending the apology */
  onApprove: (id: string) => Promise<void>;
  /** Callback when user rejects/skips */
  onReject: (id: string) => Promise<void>;
}

/**
 * Card for missed meetings — shows time missed, apology draft,
 * copy-to-clipboard, rebook link, and approve/reject for sending
 */
export default function MissedMeetingCard({ item, onApprove, onReject }: MissedMeetingCardProps) {
  const [isReplyExpanded, setIsReplyExpanded] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [localStatus, setLocalStatus] = useState(item.action_status);

  const isPending = localStatus === 'pending_review';
  const isApproved = localStatus === 'approved';
  const isRejected = localStatus === 'rejected';

  const missedTime = item.event_time ? new Date(item.event_time) : null;
  const missedAgo = missedTime ? formatDistanceToNow(missedTime, { addSuffix: true }) : null;
  const missedDateStr = missedTime ? format(missedTime, 'EEE MMM d, HH:mm') : null;

  const isCritical = item.tags?.includes('critical');
  const missCount = item.title.match(/3rd|third/i) ? 3 : item.title.match(/2nd|second/i) ? 2 : 1;

  const handleCopy = async () => {
    if (item.draft_reply) {
      await navigator.clipboard.writeText(item.draft_reply);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await onApprove(item.id);
      setLocalStatus('approved');
    } catch {
      // keep current state
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await onReject(item.id);
      setLocalStatus('rejected');
    } catch {
      // keep current state
    } finally {
      setIsProcessing(false);
    }
  };

  const bookingLink = 'https://cal.read.ai/philippe-datakult/30-min';

  return (
    <div
      className={`
        group relative overflow-hidden rounded-lg border transition-all duration-300
        ${isPending
          ? isCritical
            ? 'border-danger/40 bg-surface hover:border-danger/60 shadow-lg shadow-danger/5'
            : 'border-warning/30 bg-surface hover:border-warning/60 shadow-lg shadow-warning/5'
          : isApproved
            ? 'border-success/30 bg-surface/80'
            : isRejected
              ? 'border-border bg-surface/50 opacity-60'
              : 'border-border bg-surface'
        }
      `}
    >
      {/* Critical accent stripe */}
      {isPending && (
        <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${isCritical ? 'from-danger via-danger/60' : 'from-warning via-warning/60'} to-transparent`} />
      )}

      <div className="p-4 pl-5">
        {/* Header: source, status, score */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <SourceTag source={item.source} />
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-danger">
              <PhoneOff size={14} />
              Missed Meeting
            </span>
            {isCritical && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-bold bg-danger/20 text-danger animate-pulse">
                <AlertTriangle size={12} />
                CRITICAL
              </span>
            )}
            {isApproved && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium bg-success/15 text-success">
                <CheckCircle2 size={12} />
                Apology Queued
              </span>
            )}
            {isRejected && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium bg-elevated text-secondary">
                Skipped
              </span>
            )}
          </div>
          {item.score !== null && item.score_label && (
            <ScoreChip score={item.score} label={item.score_label} />
          )}
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold text-primary mb-1 leading-tight">
          {item.contact_name || item.title}
        </h3>

        {/* Time info */}
        {missedTime && (
          <div className="flex items-center gap-3 text-xs text-secondary mb-2">
            <span className="inline-flex items-center gap-1">
              <Calendar size={12} />
              {missedDateStr}
            </span>
            <span className="inline-flex items-center gap-1 text-danger/80">
              <Clock size={12} />
              {missedAgo}
            </span>
          </div>
        )}

        {/* Subtitle / context */}
        {item.subtitle && (
          <p className="text-sm text-secondary mb-3 leading-relaxed">
            {item.subtitle}
          </p>
        )}

        {/* Contact link */}
        {item.contact_url && (
          <a
            href={item.contact_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent/80 mb-3"
          >
            View profile <ExternalLink size={10} />
          </a>
        )}

        {/* Draft apology message */}
        {item.draft_reply && (
          <div className="mb-3">
            <button
              onClick={() => setIsReplyExpanded(!isReplyExpanded)}
              className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent/80 transition-colors mb-2"
            >
              <Send size={14} />
              {isReplyExpanded ? 'Hide' : 'Preview'} Apology Message
            </button>
            {isReplyExpanded && (
              <div className="p-3 bg-elevated/80 rounded border border-border/50 text-xs text-secondary/90 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto font-mono">
                {item.draft_reply}
              </div>
            )}
            {isReplyExpanded && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-accent/10 text-accent hover:bg-accent/20 rounded transition-colors"
                >
                  {isCopied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy message</>}
                </button>
                <a
                  href={bookingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-info/10 text-info hover:bg-info/20 rounded transition-colors"
                >
                  <Calendar size={14} /> Open booking page
                </a>
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap mb-3">
            {item.tags.filter(t => t !== 'missed').slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="inline-block px-2 py-0.5 rounded-sm text-xs bg-elevated text-secondary"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Approve / Skip buttons */}
        {isPending && (
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
            <button
              onClick={handleApprove}
              disabled={isProcessing}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-success/15 text-success hover:bg-success/25 border border-success/20 hover:border-success/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Send Apology
            </button>
            <button
              onClick={handleReject}
              disabled={isProcessing}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-danger/10 text-danger/80 hover:bg-danger/20 hover:text-danger border border-danger/15 hover:border-danger/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <XCircle size={16} />
              Skip
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
