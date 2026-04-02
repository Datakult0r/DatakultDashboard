'use client';

import { useState } from 'react';
import { Copy, ExternalLink, Check } from 'lucide-react';
import { differenceInDays, isToday } from 'date-fns';
import type { TriageItem } from '@/types/triage';

interface MessageCardProps {
  item: TriageItem;
}

export default function MessageCard({ item }: MessageCardProps) {
  const [isCopied, setIsCopied] = useState(false);

  const getAvatarColor = () => {
    const colors = ['bg-accent', 'bg-info', 'bg-success', 'bg-warning'];
    if (!item.contact_name) return colors[0];
    return colors[item.contact_name.charCodeAt(0) % colors.length];
  };
  const getInitial = () => item.contact_name ? item.contact_name.charAt(0).toUpperCase() : '?';
  const getAgeLabel = () => {
    if (!item.triage_date) return '';
    const d = new Date(item.triage_date);
    if (isToday(d)) return 'Today';
    return `${differenceInDays(new Date(), d)}d ago`;
  };  const getSourceBadge = () => {
    const s = item.source.toLowerCase();
    if (s === 'linkedin') return { label: 'LinkedIn', color: 'bg-blue-500/20 text-blue-400' };
    if (s === 'beeper') return { label: 'Beeper', color: 'bg-violet-500/20 text-violet-400' };
    return { label: s, color: 'bg-secondary/10 text-secondary' };
  };
  const handleCopyReply = async () => {
    if (item.draft_reply) { await navigator.clipboard.writeText(item.draft_reply); setIsCopied(true); setTimeout(() => setIsCopied(false), 2000); }
  };
  const sourceBadge = getSourceBadge();

  return (
    <div className="bg-surface border border-border rounded-lg p-3 hover:border-secondary/50 transition-colors">
      <div className="flex gap-3 items-start">
        <div className={`flex-shrink-0 w-10 h-10 rounded-full ${getAvatarColor()} flex items-center justify-center text-base font-semibold text-white`}>
          {getInitial()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="text-sm font-semibold text-primary">{item.contact_name || item.contact_email || 'Unknown'}</p>
            <span className={`inline-block px-1.5 py-0.5 rounded-sm text-xs font-medium ${sourceBadge.color}`}>{sourceBadge.label}</span>
            <span className="text-xs text-secondary/70">{getAgeLabel()}</span>
          </div>
          <p className="text-sm text-secondary line-clamp-1 mb-2">{item.title}</p>
          {item.draft_reply && (
            <div className="bg-elevated/50 border border-border/50 rounded p-2 mb-2">
              <p className="text-xs font-medium text-secondary mb-1">Your draft:</p>
              <p className="text-xs text-secondary/80 font-mono line-clamp-2 mb-2">{item.draft_reply}</p>
              <div className="flex gap-1 flex-wrap">
                <button onClick={handleCopyReply} className="flex items-center gap-1 px-2 py-0.5 text-xs bg-accent/10 text-accent hover:bg-accent/20 rounded">
                  {isCopied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
                </button>                <a href="https://beeper.com" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-0.5 text-xs bg-info/10 text-info hover:bg-info/20 rounded">
                  Send <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}
          {item.source_url && (
            <a href={item.source_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent/80 rounded px-1">
              Open message <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}