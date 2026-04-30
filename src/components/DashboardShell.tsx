'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Zap, Target, Inbox, HeartPulse,
  Globe, CalendarDays, Link2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { TriageItem, TriageStat, JobApplication, ApplicationStatus } from '@/types/triage';
import NowSurface from './NowSurface';
import PipelineSurface from './PipelineSurface';
import IntakeSurface from './IntakeSurface';
import SystemHealthPanel from './SystemHealthPanel';
import RunwayWidget from './RunwayWidget';
import ChatWidget from './ChatWidget';
import ErrorBoundary from './ErrorBoundary';
import SystemAlert from './SystemAlert';

type Surface = 'now' | 'pipeline' | 'intake' | 'health';
type DateScope = 'today' | '24h' | 'week' | 'all';

interface DashboardShellProps {
  initialItems: TriageItem[];
  initialStats: TriageStat | null;
  initialApplications: JobApplication[];
}

const isPending = (s: string | null | undefined) => s === 'pending_review' || s === 'pending';

/**
 * v3.0 — 4-surface command center.
 * NOW (single best next action) | PIPELINE (customers + jobs) | INTAKE (legacy categories) | HEALTH
 */
export default function DashboardShell({ initialItems, initialStats, initialApplications }: DashboardShellProps) {
  const [allItems, setAllItems] = useState<TriageItem[]>(initialItems);
  const [stats, setStats] = useState<TriageStat | null>(initialStats);
  const [applications, setApplications] = useState<JobApplication[]>(initialApplications);
  const [dateScope, setDateScope] = useState<DateScope>('week');
  const [activeSurface, setActiveSurface] = useState<Surface>('now');
  const [now, setNow] = useState(new Date());

  // Tick clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // Realtime: triage_items
  useEffect(() => {
    const sub = supabase
      .channel('triage_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'triage_items' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setAllItems((prev) => [payload.new as TriageItem, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setAllItems((prev) =>
            prev.map((i) => (i.id === (payload.new as TriageItem).id ? (payload.new as TriageItem) : i)),
          );
        } else if (payload.eventType === 'DELETE') {
          setAllItems((prev) => prev.filter((i) => i.id !== (payload.old as TriageItem).id));
        }
      })
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, []);

  // Realtime: job_applications
  useEffect(() => {
    const sub = supabase
      .channel('application_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applications' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setApplications((prev) => [payload.new as JobApplication, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setApplications((prev) =>
            prev.map((a) => (a.id === (payload.new as JobApplication).id ? (payload.new as JobApplication) : a)),
          );
        } else if (payload.eventType === 'DELETE') {
          setApplications((prev) => prev.filter((a) => a.id !== (payload.old as JobApplication).id));
        }
      })
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, []);

  // Date-scoped slice
  const items = useMemo(() => {
    if (dateScope === 'all') return allItems;
    const cutoff = new Date();
    if (dateScope === 'today') cutoff.setHours(0, 0, 0, 0);
    else if (dateScope === '24h') cutoff.setHours(cutoff.getHours() - 24);
    else { cutoff.setDate(cutoff.getDate() - 7); cutoff.setHours(0, 0, 0, 0); }
    return allItems.filter((i) => new Date(i.created_at) >= cutoff);
  }, [allItems, dateScope]);

  // Action handlers — single canonical writer set
  const handleApprove = useCallback(async (id: string) => {
    const r = await fetch('/api/actions/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!r.ok) throw new Error('Failed to approve');
    setAllItems((prev) => prev.map((i) => (i.id === id ? { ...i, action_status: 'approved' as const } : i)));
  }, []);

  const handleReject = useCallback(async (id: string) => {
    const r = await fetch('/api/actions/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!r.ok) throw new Error('Failed to reject');
    setAllItems((prev) => prev.map((i) => (i.id === id ? { ...i, action_status: 'rejected' as const } : i)));
  }, []);

  const handleMarkFollowedUp = useCallback(async (id: string) => {
    // Resets the SLA clock by clearing follow_up_at and stamping last_follow_up_at
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('triage_items')
      .update({ follow_up_at: null, last_follow_up_at: nowIso, action_status: 'executed' })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }, []);

  const handleApplicationStatusChange = useCallback(async (id: string, status: ApplicationStatus) => {
    setApplications((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status, last_activity_date: new Date().toISOString().split('T')[0] } : a,
      ),
    );
    const r = await fetch('/api/applications/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (!r.ok) {
      const { data } = await supabase.from('job_applications').select('*').order('applied_date', { ascending: false });
      if (data) setApplications(data as JobApplication[]);
    }
  }, []);

  // Counters for tab badges
  const pendingCount = items.filter((i) => i.action_type !== null && isPending(i.action_status) && !i.tags?.includes('missed')).length;
  const missedPendingCount = items.filter((i) => i.tags?.includes('missed') && isPending(i.action_status)).length;
  const intakeBadge = pendingCount + missedPendingCount;

  const surfaces: { id: Surface; label: string; icon: React.ReactNode; badge?: number; pulse?: boolean }[] = [
    { id: 'now', label: 'Now', icon: <Zap size={16} />, badge: intakeBadge, pulse: missedPendingCount > 0 },
    { id: 'pipeline', label: 'Pipeline', icon: <Target size={16} />, badge: applications.filter((a) => !['rejected','ghosted','withdrawn'].includes(a.status)).length },
    { id: 'intake', label: 'Intake', icon: <Inbox size={16} />, badge: items.length },
    { id: 'health', label: 'Health', icon: <HeartPulse size={16} /> },
  ];

  const scopeOptions: { id: DateScope; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: '24h', label: '24h' },
    { id: 'week', label: '7d' },
    { id: 'all', label: 'All' },
  ];

  const renderSurface = () => {
    switch (activeSurface) {
      case 'now':
        return (
          <NowSurface
            onApprove={handleApprove}
            onReject={handleReject}
            onMarkFollowedUp={handleMarkFollowedUp}
          />
        );
      case 'pipeline':
        return (
          <PipelineSurface
            applications={applications}
            onApplicationStatusChange={handleApplicationStatusChange}
          />
        );
      case 'intake':
        return <IntakeSurface items={items} onApprove={handleApprove} onReject={handleReject} />;
      case 'health':
        return <SystemHealthPanel />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative z-10">
      {/* Header */}
      <header className="glass border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] tracking-[0.25em] uppercase text-tertiary font-mono">
                01 — Clinic of AI
              </p>
              <h1 className="text-2xl sm:text-3xl font-semibold text-primary mt-1 tracking-tight">
                Control Tower
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <RunwayWidget />

              <div className="hidden md:flex items-center gap-0.5 bg-elevated/40 border border-border rounded-md p-0.5">
                {scopeOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setDateScope(opt.id)}
                    aria-pressed={dateScope === opt.id}
                    className={`px-2 py-1 text-[11px] font-mono uppercase tracking-wider rounded transition-colors ${
                      dateScope === opt.id
                        ? 'bg-accent/20 text-accent'
                        : 'text-tertiary hover:text-secondary hover:bg-elevated'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="hidden sm:flex items-center gap-1.5">
                <a href="https://www.linkedin.com/messaging/" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-info/10 text-info hover:bg-info/20 border border-info/20">
                  <Globe size={13} /> DMs
                </a>
                <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-elevated text-secondary hover:text-primary border border-border">
                  <CalendarDays size={13} /> Cal
                </a>
                <a href="https://cal.read.ai/philippe-datakult/30-min" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20">
                  <Link2 size={13} /> Book
                </a>
              </div>

              <div className="text-right ml-2">
                <p className="text-[11px] text-tertiary font-mono">{format(now, 'EEE')}</p>
                <p className="text-sm text-primary font-semibold">{format(now, 'MMM d')}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Surface tabs */}
      <div className="glass border-b sticky top-[73px] sm:top-[81px] z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            {surfaces.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSurface(s.id)}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${
                  activeSurface === s.id
                    ? 'border-accent text-accent'
                    : 'border-transparent text-secondary hover:text-primary'
                } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
              >
                {s.icon}
                <span>{s.label}</span>
                {typeof s.badge === 'number' && s.badge > 0 && (
                  <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-mono font-semibold ${
                    s.pulse ? 'bg-danger/20 text-danger animate-pulse-glow' :
                    activeSurface === s.id ? 'bg-accent/15 text-accent' : 'bg-elevated text-tertiary'
                  }`}>
                    {s.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {items.some((i) => i.notes?.includes('0 credits') || i.notes?.includes('no_credits') || i.notes?.includes('No Browser Use')) && (
          <div className="mb-4">
            <SystemAlert
              type="warning"
              message="Browser Use Cloud has 0 credits. Easy Apply is disabled until credits are added."
              actionUrl="https://cloud.browser-use.com"
              actionLabel="Add Credits"
            />
          </div>
        )}

        <ErrorBoundary label={activeSurface}>
          <div key={activeSurface} className="animate-tab-enter">
            {renderSurface()}
          </div>
        </ErrorBoundary>
      </main>

      {/* Footer */}
      <footer className="glass border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between text-[11px] text-tertiary font-mono">
          <span className="text-[10px] tracking-[0.15em] uppercase">
            Operator · {dateScope.toUpperCase()} · {stats?.pending_actions_count ?? pendingCount} pending
          </span>
          <div className="flex items-center gap-3">
            <span>Live · {format(now, 'HH:mm:ss')}</span>
            <span className="opacity-30">|</span>
            <span>{items.length}/{allItems.length} items · {applications.length} apps</span>
          </div>
        </div>
      </footer>

      <ChatWidget items={items} applications={applications} stats={stats} />
    </div>
  );
}
