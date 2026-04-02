'use client';

import { useState } from 'react';
import { Copy, ExternalLink, Check, Send } from 'lucide-react';
import { differenceInDays, isToday } from 'date-fns';
import type { TriageItem } from '@/types/triage';
import SourceTag from './SourceTag';
import ScoreChip from './ScoreChip';

interface TriageCardProps {
  item: TriageItem;
}

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

  const getAgeLabel = () => {
    if (!item.triage_date) return null;
    const d = new Date(item.triage_date);    if (isToday(d)) return { text: 'Today', color: 'text-secondary' };
    const days = differenceInDays(new Date(), d);
    if (days <= 3) return { text: `${days}d ago`, color: 'text-warning' };
    return { text: `${days}d ago`, color: 'text-danger' };
  };

  const getPriorityBorder = () => {
    const p = item.priority ?? 0;
    if (p >= 8) return 'border-l-danger';
    if (p >= 5) return 'border-l-warning';
    return 'border-l-accent';
  };

  const contactInfo = item.contact_name || item.contact_email || null;
  const age = getAgeLabel();
  const draftPreview = item.draft_reply ? item.draft_reply.slice(0, 80) + (item.draft_reply.length > 80 ? '...' : '') : null;

  return (
    <div className={`bg-surface border border-border border-l-4 ${getPriorityBorder()} rounded-lg p-4 hover:border-secondary/50 transition-all hover:-translate-y-0.5 hover:shadow-lg`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1"><SourceTag source={item.source} /></div>
        <div className="flex items-center gap-2">
          {age && <span className={`text-xs font-mono ${age.color}`}>{age.text}</span>}
          {item.score !== null && item.score_label && <ScoreChip score={item.score} label={item.score_label} />}
        </div>
      </div>
      <h3 className="text-base font-semibold text-primary mb-1 line-clamp-2">{item.title}</h3>
      {item.subtitle && <p className="text-sm text-secondary mb-2 line-clamp-2">{item.subtitle}</p>}
      {contactInfo && <p className="text-xs text-secondary/80 mb-3">{item.contact_name}{item.contact_email && ` \u2022 ${item.contact_email}`}</p>}      {item.tags && item.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap mb-3">
          {item.tags.slice(0, 3).map((tag) => (<span key={tag} className="inline-block px-2 py-0.5 rounded-sm text-xs bg-elevated text-secondary">{tag}</span>))}
        </div>
      )}
      {item.draft_reply && (
        <div className="mt-3 pt-3 border-t border-border">
          {draftPreview && !isReplyExpanded && (
            <p className="text-xs text-secondary/70 font-mono line-clamp-1 mb-1">{draftPreview}</p>
          )}
          <button onClick={() => setIsReplyExpanded(!isReplyExpanded)}
            className="text-xs font-medium text-accent hover:text-accent/80 rounded px-1">
            {isReplyExpanded ? 'Hide' : 'Show'} draft reply
          </button>
          {isReplyExpanded && (
            <div className="mt-2 bg-elevated rounded p-2 text-xs text-secondary/90 whitespace-pre-wrap break-words font-mono max-h-40 overflow-y-auto">
              {item.draft_reply}
            </div>
          )}
          {isReplyExpanded && (
            <div className="mt-2 flex gap-2">
              <button onClick={handleCopyReply}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-accent/10 text-accent hover:bg-accent/20 rounded">
                {isCopied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
              </button>
              <a href="https://beeper.com" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 text-xs bg-success/10 text-success hover:bg-success/20 rounded">
                <Send size={14} /> Send via Beeper
              </a>
            </div>
          )}
        </div>
      )}
      {item.source_url && (
        <div className="mt-3">
          <a href={item.source_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-accent text-base rounded hover:bg-accent/80">
            View source <ExternalLink size={12} />
          </a>
        </div>
      )}
    </div>
  );
}