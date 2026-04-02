'use client';

import { useState } from 'react';
import { Copy, ExternalLink, Check } from 'lucide-react';
import { differenceInDays, isToday } from 'date-fns';
import type { TriageItem } from '@/types/triage';

interface MessageCardProps {
  /** The message item to display */
  item: TriageItem;
}

/**
 * Compact message card for LinkedIn/Beeper messages
 * Shows sender, message preview, age, and draft reply if available
 * Designed for single-row chat list layout
 */
export default function MessageCard({ item }: MessageCardProps) {
  const [isCopied, setIsCopied] = useState(false);

  // Generate avatar color based on contact name hash
  const getAvatarColor = () => {
    const colors = ['bg-accent', 'bg-info', 'bg-success', 'bg-warning'];
    if (!item.contact_name) return colors[0];
    const hash = item.contact_name.charCodeAt(0) % colors.length;
    return colors[hash];
  };

  // Get first letter of contact name
  const getInitial = () => {
    return item.contact_name ? item.contact_name.charAt(0).toUpperCase() : '?';
  };
  // Calculate age label
  const getAgeLabel = () => {
    if (!item.triage_date) return '';
    const triageDate = new Date(item.triage_date);
    if (isToday(triageDate)) return 'Today';
    const daysAgo = differenceInDays(new Date(), triageDate);
    return `${daysAgo}d ago`;
  };

  // Get source badge
  const getSourceBadge = () => {
    const source = item.source.toLowerCase();
    if (source === 'linkedin') return { label: 'LinkedIn', color: 'bg-blue-500/20 text-blue-400' };
    if (source === 'beeper') return { label: 'Beeper', color: 'bg-violet-500/20 text-violet-400' };
    return { label: source, color: 'bg-secondary/10 text-secondary' };
  };

  const handleCopyReply = async () => {
    if (item.draft_reply) {
      await navigator.clipboard.writeText(item.draft_reply);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const sourceBadge = getSourceBadge();
  const ageLabel = getAgeLabel();
  const avatarColor = getAvatarColor();

  return (
    <div className="bg-surface border border-border rounded-lg p-3 hover:border-secondary/50 transition-colors">
      {/* Main message row */}
      <div className="flex gap-3 items-start">
        {/* Avatar */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center text-base font-semibold text-white`}>
          {getInitial()}
        </div>
        {/* Message content */}
        <div className="flex-1 min-w-0">
          {/* Header row: sender name, badges, age */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="text-sm font-semibold text-primary">
              {item.contact_name || item.contact_email || 'Unknown'}
            </p>
            <span className={`inline-block px-1.5 py-0.5 rounded-sm text-xs font-medium ${sourceBadge.color}`}>
              {sourceBadge.label}
            </span>
            {ageLabel && (
              <span className="text-xs text-secondary/70">
                {ageLabel}
              </span>
            )}
          </div>

          {/* Message preview (title) */}
          <p className="text-sm text-secondary line-clamp-1 mb-2">
            {item.title}
          </p>

          {/* Draft reply section if available */}
          {item.draft_reply && (
            <div className="bg-elevated/50 border border-border/50 rounded p-2 mb-2">
              <p className="text-xs font-medium text-secondary mb-1">Your draft:</p>
              <p className="text-xs text-secondary/80 font-mono line-clamp-2 mb-2">
                {item.draft_reply}
              </p>

              {/* Copy and Send buttons */}
              <div className="flex gap-1 flex-wrap">                <button
                  onClick={handleCopyReply}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs bg-accent/10 text-accent hover:bg-accent/20 rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent transition-colors"
                >
                  {isCopied ? (
                    <>
                      <Check size={12} />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      Copy
                    </>
                  )}
                </button>
                <a
                  href="https://beeper.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-0.5 text-xs bg-info/10 text-info hover:bg-info/20 rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-info transition-colors"
                >
                  Send
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}

          {/* Source link */}
          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent/80 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent rounded px-1"
            >
              Open message
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}