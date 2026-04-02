'use client';

import { useState } from 'react';
import { Copy, ExternalLink, Check } from 'lucide-react';
import { differenceInDays, isToday } from 'date-fns';
import type { TriageItem } from '@/types/triage';
import SourceTag from './SourceTag';
import ScoreChip from './ScoreChip';

interface TriageCardProps {
  /** The triage item to display */
  item: TriageItem;
}

/**
 * Card for urgent/review items with source tag, title, score, and draft reply
 * Includes age badge, priority-based left border, and Send button with Beeper link
 */
export default function TriageCard({ item }: TriageCardProps) {
  const [isReplyExpanded, setIsReplyExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Calculate age badge
  const getAgeBadge = () => {
    if (!item.triage_date) return null;
    const triageDate = new Date(item.triage_date);
    if (isToday(triageDate)) return { text: 'Today', color: 'bg-secondary text-base' };
    const daysAgo = differenceInDays(new Date(), triageDate);
    if (daysAgo === 1) return { text: '1d ago', color: 'bg-warning text-base' };
    if (daysAgo >= 4) return { text: `${daysAgo}d ago`, color: 'bg-danger text-base' };
    return { text: `${daysAgo}d ago`, color: 'bg-warning text-base' };
  };
  // Determine priority-based left border color
  const getPriorityBorderColor = () => {
    if (!item.priority) return 'border-accent';
    if (item.priority >= 8) return 'border-danger';
    if (item.priority >= 5) return 'border-warning';
    return 'border-accent';
  };

  const handleCopyReply = async () => {
    if (item.draft_reply) {
      await navigator.clipboard.writeText(item.draft_reply);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const contactInfo = item.contact_name || item.contact_email || null;
  const ageBadge = getAgeBadge();
  const draftPreview = item.draft_reply ? item.draft_reply.substring(0, 80) : null;

  return (
    <div className={`bg-surface border border-border border-l-4 ${getPriorityBorderColor()} rounded-lg p-4 hover:border-secondary/50 transition-all hover:-translate-y-0.5 hover:shadow-lg`}>
      {/* Header with source and score and age badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 flex items-start gap-2">
          <SourceTag source={item.source} />
          {ageBadge && (
            <span className={`inline-block px-2 py-1 rounded-sm text-xs font-medium ${ageBadge.color}`}>
              {ageBadge.text}
            </span>
          )}
        </div>
        {item.score !== null && item.score_label && (
          <ScoreChip
            score={item.score}
            label={item.score_label}
          />
        )}
      </div>
      {/* Title and subtitle */}
      <h3 className="text-base font-semibold text-primary mb-1 line-clamp-2">
        {item.title}
      </h3>
      {item.subtitle && (
        <p className="text-sm text-secondary mb-2 line-clamp-2">
          {item.subtitle}
        </p>
      )}

      {/* Contact info */}
      {contactInfo && (
        <p className="text-xs text-secondary/80 mb-3">
          {item.contact_name}
          {item.contact_email && ` • ${item.contact_email}`}
        </p>
      )}

      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap mb-3">
          {item.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-block px-2 py-0.5 rounded-sm text-xs bg-elevated text-secondary"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      {/* Draft reply section */}
      {item.draft_reply && (
        <div className="mt-3 pt-3 border-t border-border">
          {/* Preview line (always shown) */}
          <p className="text-xs text-secondary/70 mb-2 font-mono line-clamp-1">
            {draftPreview}
            {item.draft_reply.length > 80 ? '...' : ''}
          </p>

          {/* Expand/collapse button */}
          <button
            onClick={() => setIsReplyExpanded(!isReplyExpanded)}
            className="text-xs font-medium text-accent hover:text-accent/80 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent rounded px-1"
          >
            {isReplyExpanded ? 'Hide' : 'Show'} full reply
          </button>

          {/* Full reply text (when expanded) */}
          {isReplyExpanded && (
            <div className="mt-2 bg-elevated rounded p-2 text-xs text-secondary/90 whitespace-pre-wrap break-words font-mono max-h-40 overflow-y-auto">
              {item.draft_reply}
            </div>
          )}

          {/* Send and Copy buttons */}
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleCopyReply}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-accent/10 text-accent hover:bg-accent/20 rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent transition-colors"
            >              {isCopied ? (
                <>
                  <Check size={14} />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={14} />
                  Copy
                </>
              )}
            </button>
            <a
              href="https://beeper.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 text-xs bg-info/10 text-info hover:bg-info/20 rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-info transition-colors"
            >
              Send
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      )}

      {/* Action button */}
      {item.source_url && (
        <div className="mt-3">
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-accent text-base rounded hover:bg-accent/80 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent transition-colors"
          >
            View source
            <ExternalLink size={12} />
          </a>
        </div>
      )}
    </div>
  );
}