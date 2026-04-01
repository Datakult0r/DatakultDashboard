'use client';

import { useState } from 'react';
import { Copy, ExternalLink, Check } from 'lucide-react';
import type { TriageItem } from '@/types/triage';
import SourceTag from './SourceTag';
import ScoreChip from './ScoreChip';

interface TriageCardProps {
  /** The triage item to display */
  item: TriageItem;
}

/**
 * Card for urgent/review items with source tag, title, score, and draft reply
 */
export default function TriageCard({ item }: TriageCardProps) {
  const [isReplyExpanded, setIsReplyExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyReply = async () => {
    if (item.draft_reply) {
      await navigator.clipboard.writeText(item.draft_reply);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const contactInfo = item.contact_name || item.contact_email || null;

  return (
    <div className="bg-surface border border-border rounded-lg p-4 hover:border-secondary transition-colors">
      {/* Header with source and score */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <SourceTag source={item.source} />
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
          <button
            onClick={() => setIsReplyExpanded(!isReplyExpanded)}
            className="text-xs font-medium text-accent hover:text-accent/80 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent rounded px-1"
          >
            {isReplyExpanded ? 'Hide' : 'Show'} draft reply
          </button>

          {isReplyExpanded && (
            <div className="mt-2 bg-elevated rounded p-2 text-xs text-secondary/90 whitespace-pre-wrap break-words font-mono max-h-40 overflow-y-auto">
              {item.draft_reply}
            </div>
          )}

          {isReplyExpanded && (
            <button
              onClick={handleCopyReply}
              className="mt-2 flex items-center gap-1 px-2 py-1 text-xs bg-accent/10 text-accent hover:bg-accent/20 rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            >
              {isCopied ? (
                <>
                  <Check size={14} />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={14} />
                  Copy reply
                </>
              )}
            </button>
          )}
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
