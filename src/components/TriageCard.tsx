'use client';

import { useState } from 'react';
import { Copy, ExternalLink, Check, Mail, MessageSquare, Calendar, Globe, Smartphone, Cpu } from 'lucide-react';
import type { TriageItem, SourceType } from '@/types/triage';
import SourceTag from './SourceTag';
import ScoreChip from './ScoreChip';

interface TriageCardProps {
  /** The triage item to display */
  item: TriageItem;
}

/** Map source to icon */
const sourceIcon: Record<SourceType, typeof Mail> = {
  email: Mail,
  gmail: Mail,
  gmail_personal: Mail,
  linkedin: Globe,
  linkedin_dm: Globe,
  beeper: MessageSquare,
  whatsapp: Smartphone,
  calendar: Calendar,
  system: Cpu,
  other: ExternalLink,
};

/**
 * Card for urgent/review items with source tag, title, score, draft reply, and hyperlinks
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

  /** Resolve the best link for this item */
  const deepLink = item.contact_url || item.source_url || item.event_url || null;
  const normalizedSource = (item.source?.toLowerCase() || 'other') as SourceType;
  const SourceIcon = sourceIcon[normalizedSource] || ExternalLink;

  return (
    <div className="bg-surface border border-border rounded-lg p-4 hover:border-secondary/60 transition-all duration-200 group">
      {/* Header with source and score */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <SourceTag source={item.source} />
          {deepLink && (
            <a
              href={deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent/70 hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
              title={`Open in ${item.source}`}
            >
              <SourceIcon size={12} />
              <span className="sr-only">Open source</span>
            </a>
          )}
        </div>
        {item.score !== null && item.score_label && (
          <ScoreChip score={item.score} label={item.score_label} />
        )}
      </div>

      {/* Title — linked if we have a deep link */}
      {deepLink ? (
        <a
          href={deepLink}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-base font-semibold text-primary mb-1 line-clamp-2 hover:text-accent transition-colors"
        >
          {item.title}
        </a>
      ) : (
        <h3 className="text-base font-semibold text-primary mb-1 line-clamp-2">
          {item.title}
        </h3>
      )}

      {item.subtitle && (
        <p className="text-sm text-secondary mb-2 line-clamp-2">
          {item.subtitle}
        </p>
      )}

      {/* Contact info with hyperlink */}
      {(item.contact_name || item.contact_email) && (
        <div className="text-xs text-secondary/80 mb-3">
          {item.contact_url ? (
            <a
              href={item.contact_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent/80 hover:text-accent underline underline-offset-2 decoration-accent/30"
            >
              {item.contact_name || item.contact_email}
            </a>
          ) : (
            <span>{item.contact_name}</span>
          )}
          {item.contact_name && item.contact_email && (
            <span className="text-secondary/50"> · {item.contact_email}</span>
          )}
        </div>
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
        <div className="mt-3 pt-3 border-t border-border/50">
          <button
            onClick={() => setIsReplyExpanded(!isReplyExpanded)}
            className="text-xs font-medium text-accent hover:text-accent/80 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent rounded px-1"
          >
            {isReplyExpanded ? 'Hide' : 'Show'} draft reply
          </button>

          {isReplyExpanded && (
            <div className="mt-2 bg-elevated/80 rounded border border-border/40 p-3 text-xs text-secondary/90 whitespace-pre-wrap break-words font-mono max-h-40 overflow-y-auto leading-relaxed">
              {item.draft_reply}
            </div>
          )}

          {isReplyExpanded && (
            <button
              onClick={handleCopyReply}
              className="mt-2 flex items-center gap-1 px-2 py-1 text-xs bg-accent/10 text-accent hover:bg-accent/20 rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent transition-colors"
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

      {/* View source button */}
      {deepLink && !item.draft_reply && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <a
            href={deepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent/10 text-accent rounded hover:bg-accent/20 transition-colors"
          >
            <SourceIcon size={14} />
            Open in {item.source}
            <ExternalLink size={10} />
          </a>
        </div>
      )}
    </div>
  );
}
