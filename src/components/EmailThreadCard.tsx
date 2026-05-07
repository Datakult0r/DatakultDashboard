'use client';

/**
 * EmailThreadCard — inline email thread + draft viewer for the dashboard.
 *
 * Why: per Philippe v5.2 — "I dont want to be redirected. it has to be on the
 * dashboard. thats the whole point. centralize all the info. so i can just
 * click send from here!"
 *
 * Renders: from / subject / original body / Claude-drafted reply (editable)
 *          + Send via Gmail button + Skip + Edit toggles.
 *
 * Backed by triage_items rows where action_type='reply_email'. The /api/actions/approve
 * route handles the actual Gmail send when AUTO_SEND_GMAIL_APPROVED=true.
 */

import { useState } from 'react';
import { Mail, Send, X, Edit3, Check, ExternalLink, Sparkles, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { TriageItem } from '@/types/triage';

interface EmailThreadCardProps {
  item: TriageItem & {
    from_email?: string | null;
    subject?: string | null;
    body_full?: string | null;
    gmail_message_id?: string | null;
    gmail_thread_id?: string | null;
    gmail_account?: string | null;
  };
  onApprove: (id: string, draft?: string) => Promise<{ autoSent: boolean; error: string | null }>;
  onReject: (id: string) => Promise<void>;
}

export default function EmailThreadCard({ item, onApprove, onReject }: EmailThreadCardProps) {
  const [draft, setDraft] = useState(item.draft_reply ?? '');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ ok: boolean; msg: string } | null>(null);

  const senderEmail = item.from_email ?? item.contact_email ?? null;
  const senderName = item.contact_name ?? senderEmail?.split('@')[0] ?? 'Unknown';
  const subject = item.subject ?? item.title;
  const account = item.gmail_account === 'personal' ? 'philippelobokung@gmail.com' : 'philippe.kung@clinicofai.com';

  const handleSend = async () => {
    setBusy(true);
    setOutcome(null);
    try {
      const result = await onApprove(item.id, draft);
      if (result.autoSent) {
        setOutcome({ ok: true, msg: `Sent via ${account}` });
      } else if (result.error) {
        setOutcome({ ok: false, msg: result.error });
      } else {
        setOutcome({ ok: false, msg: 'AUTO_SEND_GMAIL_APPROVED is not enabled — set it in Vercel env to send from here.' });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-xl border border-border/50 bg-surface overflow-hidden">
      {/* Header strip */}
      <header className="px-4 py-2.5 border-b border-border/40 bg-elevated/30 flex items-center gap-2 flex-wrap text-[11px]">
        <Mail size={13} className="text-info" />
        <span className="font-mono text-tertiary">via {account}</span>
        <span className="opacity-30">·</span>
        <span className="text-secondary">from <span className="text-primary font-medium">{senderName}</span></span>
        {senderEmail && <span className="text-tertiary font-mono">&lt;{senderEmail}&gt;</span>}
        <span className="opacity-30">·</span>
        <span className="text-tertiary">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
        {item.score !== null && item.score >= 7 && (
          <>
            <span className="opacity-30">·</span>
            <span className="px-1.5 py-px rounded bg-warning/15 text-warning font-mono text-[10px]">priority {item.score}</span>
          </>
        )}
      </header>

      {/* Original message body */}
      <div className="px-4 py-3 border-b border-border/40">
        <h3 className="text-sm font-semibold text-primary leading-tight">{subject}</h3>
        {item.body_full && (
          <details className="mt-2 group">
            <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-secondary/60 font-mono hover:text-accent transition-colors">
              Original message · click to expand
            </summary>
            <div className="mt-2 max-h-64 overflow-y-auto text-xs text-secondary leading-relaxed whitespace-pre-wrap bg-elevated/30 border border-border/40 rounded-md px-3 py-2">
              {item.body_full}
            </div>
          </details>
        )}
        {!item.body_full && item.subtitle && (
          <p className="text-xs text-secondary leading-relaxed mt-1.5 line-clamp-3">{item.subtitle}</p>
        )}
      </div>

      {/* Drafted reply (editable in place) */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[10px] uppercase tracking-wider text-accent font-mono flex items-center gap-1">
            <Sparkles size={10} /> Claude drafted reply
          </span>
          <button onClick={() => setEditing((e) => !e)}
            className="text-[10px] font-mono text-tertiary hover:text-accent inline-flex items-center gap-1">
            {editing ? <><Check size={10} /> Done editing</> : <><Edit3 size={10} /> Edit</>}
          </button>
        </div>
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full min-h-[160px] text-xs text-primary leading-relaxed bg-accent/5 border border-accent/30 rounded-md px-3 py-2 font-sans focus:outline-none focus:border-accent"
            autoFocus
          />
        ) : (
          <div className="text-xs text-primary leading-relaxed whitespace-pre-wrap bg-accent/5 border border-accent/15 rounded-md px-3 py-2 min-h-[80px]">
            {draft || <span className="text-tertiary italic">(no draft)</span>}
          </div>
        )}
      </div>

      {/* Actions */}
      <footer className="px-4 py-3 border-t border-border/40 flex items-center gap-2 flex-wrap">
        <button
          onClick={handleSend}
          disabled={busy || !draft}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-base bg-accent rounded-md hover:bg-accent-bright disabled:opacity-50 transition-colors"
        >
          <Send size={13} /> {busy ? 'Sending…' : 'Send via Gmail'}
        </button>
        <button
          onClick={() => onReject(item.id)}
          disabled={busy}
          className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-tertiary border border-border/40 rounded-md hover:text-danger hover:border-danger/40 disabled:opacity-50 transition-colors"
        >
          <X size={12} /> Skip
        </button>
        <a
          href={`https://mail.google.com/mail/u/${item.gmail_account === 'personal' ? '1' : '0'}/#inbox/${item.gmail_thread_id ?? ''}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-mono text-tertiary hover:text-info transition-colors"
        >
          Open in Gmail <ExternalLink size={10} />
        </a>
      </footer>

      {outcome && (
        <div className={`px-4 py-2 text-[11px] flex items-center gap-2 ${outcome.ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
          {outcome.ok ? <Check size={12} /> : <AlertCircle size={12} />} {outcome.msg}
        </div>
      )}
    </article>
  );
}
