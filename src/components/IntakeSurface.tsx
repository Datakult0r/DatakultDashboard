'use client';

import { useState } from 'react';
import {
  Shield, AlertCircle, Activity, Briefcase, Newspaper, Clock, CheckCircle2, PhoneOff,
} from 'lucide-react';
import type { TriageItem } from '@/types/triage';
import TriageCard from './TriageCard';
import JobCard from './JobCard';
import NewsCard from './NewsCard';
import ScheduleRow from './ScheduleRow';
import ApprovalQueue from './ApprovalQueue';
import MissedMeetingCard from './MissedMeetingCard';

interface IntakeSurfaceProps {
  items: TriageItem[];
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}

type IntakeSubtab = 'missed' | 'approve' | 'action' | 'review' | 'jobs' | 'news' | 'schedule' | 'done';

const isPending = (s: string | null | undefined) => s === 'pending_review' || s === 'pending';

/** INTAKE surface — wraps the old per-category tabs as collapsed sub-navigation. */
export default function IntakeSurface({ items, onApprove, onReject }: IntakeSurfaceProps) {
  const missed = items.filter((i) => i.tags?.includes('missed'));
  const missedPending = missed.filter((i) => isPending(i.action_status));
  const actionable = items.filter((i) => i.action_type !== null && !i.tags?.includes('missed'));
  const pending = actionable.filter((i) => isPending(i.action_status));
  const urgent = items.filter((i) => i.category === 'urgent' && !i.tags?.includes('missed') && i.status !== 'skipped');
  const review = items.filter((i) => i.category === 'review' && i.status !== 'skipped');
  const jobs = items.filter((i) => i.category === 'job' && i.status !== 'skipped');
  const news = items.filter((i) => i.category === 'news' && i.status !== 'skipped');
  const schedule = items.filter((i) => i.category === 'schedule' && i.status !== 'skipped');
  const done = items.filter((i) => i.category === 'done' || i.status === 'completed');

  const [sub, setSub] = useState<IntakeSubtab>(missed.length > 0 ? 'missed' : 'approve');
  const [now] = useState(new Date());

  const subs: { id: IntakeSubtab; label: string; icon: React.ReactNode; count: number; danger?: boolean; pulse?: boolean }[] = [
    ...(missed.length > 0 ? [{ id: 'missed' as IntakeSubtab, label: 'Missed', icon: <PhoneOff size={14} />, count: missedPending.length, danger: true, pulse: true }] : []),
    { id: 'approve', label: 'Approve', icon: <Shield size={14} />, count: pending.length, pulse: pending.length > 0 },
    { id: 'action', label: 'Action', icon: <AlertCircle size={14} />, count: urgent.length },
    { id: 'review', label: 'Review', icon: <Activity size={14} />, count: review.length },
    { id: 'jobs', label: 'Jobs', icon: <Briefcase size={14} />, count: jobs.length },
    { id: 'news', label: 'News', icon: <Newspaper size={14} />, count: news.length },
    { id: 'schedule', label: 'Schedule', icon: <Clock size={14} />, count: schedule.length },
    { id: 'done', label: 'Done', icon: <CheckCircle2 size={14} />, count: done.length },
  ];

  const renderList = (rows: TriageItem[], empty: string, useJobCard = false) =>
    rows.length === 0 ? (
      <div className="text-center py-12 text-secondary text-sm">{empty}</div>
    ) : (
      <div className={useJobCard ? 'grid gap-3 md:grid-cols-2' : 'grid gap-3'}>
        {rows.map((r, i) => (
          <div key={r.id} className={`animate-fade-up stagger-${Math.min(i + 1, 5)}`}>
            {useJobCard ? <JobCard item={r} /> : <TriageCard item={r} />}
          </div>
        ))}
      </div>
    );

  const renderSub = () => {
    switch (sub) {
      case 'missed':
        return missed.length === 0 ? (
          <div className="text-center py-12 text-secondary text-sm">No missed meetings.</div>
        ) : (
          <div className="grid gap-3">
            {missed.sort((a, b) => (b.priority || 0) - (a.priority || 0)).map((item, i) => (
              <div key={item.id} className={`animate-fade-up stagger-${Math.min(i + 1, 5)}`}>
                <MissedMeetingCard item={item} onApprove={onApprove} onReject={onReject} />
              </div>
            ))}
          </div>
        );
      case 'approve':
        return <ApprovalQueue items={actionable} onApprove={onApprove} onReject={onReject} />;
      case 'action':
        return renderList(urgent, 'No urgent items.');
      case 'review':
        return renderList(review, 'Nothing to review.');
      case 'jobs':
        return renderList(jobs, 'No jobs in pipeline.', true);
      case 'news':
        return news.length === 0 ? (
          <div className="text-center py-12 text-secondary text-sm">No news items.</div>
        ) : (
          <div className="grid gap-3">
            {news.map((item, i) => (
              <div key={item.id} className={`animate-fade-up stagger-${Math.min(i + 1, 5)}`}>
                <NewsCard item={item} />
              </div>
            ))}
          </div>
        );
      case 'schedule':
        return schedule.length === 0 ? (
          <div className="text-center py-12 text-secondary text-sm">No scheduled events.</div>
        ) : (
          <div className="grid gap-3">
            {schedule
              .sort((a, b) => new Date(a.event_time || 0).getTime() - new Date(b.event_time || 0).getTime())
              .map((item, i) => (
                <div key={item.id} className={`animate-fade-up stagger-${Math.min(i + 1, 5)}`}>
                  <ScheduleRow item={item} now={now} />
                </div>
              ))}
          </div>
        );
      case 'done':
        return renderList(done.slice(0, 30), 'No completed items yet.');
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-0.5 overflow-x-auto border-b border-border/40 pb-2 -mx-1 px-1">
        {subs.map((t) => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
              sub === t.id
                ? t.danger
                  ? 'bg-danger/15 text-danger'
                  : 'bg-accent/15 text-accent'
                : 'text-secondary hover:text-primary hover:bg-elevated/40'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
            {t.count > 0 && (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                t.danger ? 'bg-danger/20 text-danger' :
                t.pulse  ? 'bg-warning/20 text-warning animate-pulse-glow' :
                sub === t.id ? 'bg-accent/20 text-accent' : 'bg-elevated text-tertiary'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>
      {renderSub()}
    </div>
  );
}
