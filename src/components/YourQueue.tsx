'use client';

/**
 * YourQueue — bottom-of-NOW grouped list of human-only items.
 * "What still needs YOU" — DMs to send, website applies, drafts, follow-ups.
 * Distinct from AgentRunSheet (what was/will be done autonomously).
 */

import { useEffect, useState, useMemo } from 'react';
import { User, MessageSquare, Mail, Briefcase, Target, ExternalLink, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { TriageItem, PhilippeJob } from '@/types/triage';

export default function YourQueue() {
  const [items, setItems] = useState<TriageItem[]>([]);
  const [websiteJobs, setWebsiteJobs] = useState<PhilippeJob[]>([]);

  const reload = async () => {
    const today = new Date(); today.setHours(0,0,0,0);
    const { data: triage } = await supabase
      .from('triage_items').select('*')
      .in('action_status', ['pending_review', 'approved'])
      .in('action_type', ['send_message', 'reply_email', 'apply_job_website'])
      .gte('created_at', new Date(Date.now() - 7*24*60*60*1000).toISOString())
      .order('priority', { ascending: false })
      .limit(20);
    setItems((triage ?? []) as TriageItem[]);

    const { data: jobs } = await supabase
      .from('philippe_jobs').select('*')
      .eq('decision', 'STRONG_APPLY').neq('apply_type', 'easy_apply').eq('apply_status', 'SCORED')
      .gte('created_at', new Date(Date.now() - 7*24*60*60*1000).toISOString())
      .order('score', { ascending: false }).limit(10);
    setWebsiteJobs((jobs ?? []) as PhilippeJob[]);
  };

  useEffect(() => {
    reload();
    const ch = supabase.channel('your_queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'triage_items' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'philippe_jobs' }, reload)
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, []);

  const grouped = useMemo(() => ({
    dms: items.filter((i) => i.action_type === 'send_message'),
    emails: items.filter((i) => i.action_type === 'reply_email'),
    websiteFromTriage: items.filter((i) => i.action_type === 'apply_job_website'),
    websiteFromJobs: websiteJobs,
  }), [items, websiteJobs]);

  const totalCount = grouped.dms.length + grouped.emails.length + grouped.websiteFromTriage.length + grouped.websiteFromJobs.length;

  return (
    <div className="rounded-xl border border-money/20 bg-money/[0.03] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-money/10 border border-money/20 flex items-center justify-center">
            <User size={14} className="text-money" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-primary leading-none">Your queue</h3>
            <p className="text-[10px] text-tertiary mt-0.5">Things only YOU can finish</p>
          </div>
        </div>
        <span className="text-[10px] font-mono text-tertiary">{totalCount} pending</span>
      </div>

      {totalCount === 0 && (
        <div className="text-xs text-tertiary px-3 py-3 border border-dashed border-border/40 rounded-md text-center">
          You're caught up. Nothing waiting for you.
        </div>
      )}

      <div className="space-y-3">
        <Section
          title="LinkedIn DMs to send"
          subtitle="Drafted in Beeper. Open Beeper, review, press send."
          icon={MessageSquare}
          tone="info"
          count={grouped.dms.length}
          openHref="https://www.linkedin.com/messaging/"
          openLabel="Open LinkedIn DMs"
          rows={grouped.dms.slice(0, 5).map((i) => ({
            key: i.id, primary: i.contact_name ?? i.title, secondary: i.subtitle ?? null,
          }))}
        />
        <Section
          title="Email drafts in Gmail"
          subtitle="Drafted in your Gmail Drafts folder. Open Gmail, review, send."
          icon={Mail}
          tone="accent"
          count={grouped.emails.length}
          openHref="https://mail.google.com/mail/u/0/#drafts"
          openLabel="Open Gmail Drafts"
          rows={grouped.emails.slice(0, 5).map((i) => ({
            key: i.id, primary: i.title, secondary: i.subtitle ?? null,
          }))}
        />
        <Section
          title="Website applications to do"
          subtitle="Cover letter is ready. Open the company's career page and submit."
          icon={Briefcase}
          tone="success"
          count={grouped.websiteFromJobs.length + grouped.websiteFromTriage.length}
          rows={[
            ...grouped.websiteFromJobs.map((j) => ({
              key: j.id,
              primary: `${j.title}`,
              secondary: `${j.company} · score ${j.score}`,
              link: j.job_url,
            })),
            ...grouped.websiteFromTriage.map((i) => ({
              key: i.id,
              primary: i.title,
              secondary: i.company ?? i.subtitle,
              link: i.contact_url ?? i.source_url ?? null,
            })),
          ].slice(0, 5)}
        />
      </div>
    </div>
  );
}

interface Row { key: string; primary: string | null; secondary: string | null; link?: string | null }
function Section({ title, subtitle, icon: Icon, tone, count, openHref, openLabel, rows }: {
  title: string; subtitle: string; icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: string; count: number; openHref?: string; openLabel?: string; rows: Row[];
}) {
  if (count === 0) return null;
  return (
    <div className={`rounded-lg border border-${tone}/20 bg-${tone}/5 px-3 py-2.5`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <Icon size={12} className={`text-${tone}`} />
          <span className={`text-xs font-semibold text-${tone}`}>{title}</span>
          <span className="text-[10px] font-mono text-tertiary">· {count}</span>
        </div>
        {openHref && (
          <a href={openHref} target="_blank" rel="noopener noreferrer"
            className={`text-[10px] font-mono text-${tone}/80 hover:text-${tone} inline-flex items-center gap-0.5`}>
            {openLabel} <ExternalLink size={9} />
          </a>
        )}
      </div>
      <p className="text-[10px] text-tertiary mb-2">{subtitle}</p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2 text-[11px] px-2 py-1 rounded bg-surface/50">
            <Send size={9} className={`text-${tone}/60 shrink-0`} />
            <span className="text-primary truncate flex-1" title={r.primary ?? ''}>{r.primary}</span>
            {r.secondary && <span className="text-tertiary truncate hidden sm:inline" title={r.secondary}>· {r.secondary}</span>}
            {r.link && (
              <a href={r.link} target="_blank" rel="noopener noreferrer" title="Open"
                className="text-tertiary hover:text-accent">
                <ExternalLink size={10} />
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
