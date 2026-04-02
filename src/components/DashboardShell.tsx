'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { format } from 'date-fns';
import { Shield, AlertCircle, CheckCircle2, Briefcase, Newspaper, Clock, Activity } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { TriageItem, TriageStat } from '@/types/triage';
import StatCard from './StatCard';
import TriageCard from './TriageCard';
import JobCard from './JobCard';
import NewsCard from './NewsCard';
import ScheduleRow from './ScheduleRow';
import ApprovalQueue from './ApprovalQueue';

type TabType = 'approval' | 'action' | 'review' | 'jobs' | 'news' | 'schedule' | 'done';

interface DashboardShellProps {
  initialItems: TriageItem[];
  initialStats: TriageStat | null;
}

export default function DashboardShell({ initialItems, initialStats }: DashboardShellProps) {
  const [items, setItems] = useState<TriageItem[]>(initialItems);
  const [stats, setStats] = useState<TriageStat | null>(initialStats);
  const [activeTab, setActiveTab] = useState<TabType>('approval');
  const [now, setNow] = useState(new Date());

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);

  useEffect(() => {
    const sub = supabase.channel('triage_changes').on('postgres_changes',
      { event: '*', schema: 'public', table: 'triage_items' },
      (payload) => {
        if (payload.eventType === 'INSERT') setItems((p) => [payload.new as TriageItem, ...p]);
        else if (payload.eventType === 'UPDATE') setItems((p) => p.map((i) => i.id === (payload.new as TriageItem).id ? (payload.new as TriageItem) : i));
        else if (payload.eventType === 'DELETE') setItems((p) => p.filter((i) => i.id !== (payload.old as TriageItem).id));
      }
    ).subscribe();
    return () => { sub.unsubscribe(); };
  }, []);

  const handleApprove = useCallback(async (id: string) => {
    const res = await fetch('/api/actions/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if (!res.ok) throw new Error('Failed to approve');
    setItems((p) => p.map((i) => i.id === id ? { ...i, action_status: 'approved' as const } : i));
  }, []);

  const handleReject = useCallback(async (id: string) => {
    const res = await fetch('/api/actions/reject', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if (!res.ok) throw new Error('Failed to reject');
    setItems((p) => p.map((i) => i.id === id ? { ...i, action_status: 'rejected' as const } : i));
  }, []);

  const getItemsByCategory = (cat: string) => items.filter((i) => i.category === cat && i.status !== 'skipped');
  const actionableItems = items.filter((i) => i.action_type !== null);
  const pendingActions = actionableItems.filter((i) => i.action_status === 'pending_review');
  const urgentItems = getItemsByCategory('urgent');
  const reviewItems = getItemsByCategory('review');
  const jobItems = getItemsByCategory('job');
  const newsItems = getItemsByCategory('news');
  const scheduleItems = getItemsByCategory('schedule');
  const doneItems = items.filter((i) => i.category === 'done' || i.status === 'completed');

  const tabs: { id: TabType; label: string; icon: ReactNode; count: number; pulse?: boolean }[] = [
    { id: 'approval', label: 'Approve', icon: <Shield size={16} />, count: pendingActions.length, pulse: pendingActions.length > 0 },
    { id: 'action', label: 'Action', icon: <AlertCircle size={16} />, count: urgentItems.length },
    { id: 'review', label: 'Review', icon: <Activity size={16} />, count: reviewItems.length },
    { id: 'jobs', label: 'Jobs', icon: <Briefcase size={16} />, count: jobItems.length },
    { id: 'news', label: 'News', icon: <Newspaper size={16} />, count: newsItems.length },
    { id: 'schedule', label: 'Schedule', icon: <Clock size={16} />, count: scheduleItems.length },
    { id: 'done', label: 'Done', icon: <CheckCircle2 size={16} />, count: doneItems.length },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'approval':
        return <ApprovalQueue items={actionableItems} onApprove={handleApprove} onReject={handleReject} />;
      case 'action':
        return (<div className="grid gap-3">{urgentItems.length === 0 ? <Empty msg="No urgent items." /> : urgentItems.map((i, idx) => <div key={i.id} className={`animate-fade-up stagger-${Math.min(idx+1,5)}`}><TriageCard item={i} /></div>)}</div>);
      case 'review':
        return (<div className="grid gap-3">{reviewItems.length === 0 ? <Empty msg="Nothing to review." /> : reviewItems.map((i, idx) => <div key={i.id} className={`animate-fade-up stagger-${Math.min(idx+1,5)}`}><TriageCard item={i} /></div>)}</div>);
      case 'jobs':
        return (<div className="grid gap-3 md:grid-cols-2">{jobItems.length === 0 ? <Empty msg="No jobs in pipeline." /> : jobItems.map((i, idx) => <div key={i.id} className={`animate-fade-up stagger-${Math.min(idx+1,5)}`}><JobCard item={i} /></div>)}</div>);
      case 'news':
        return (<div className="grid gap-3">{newsItems.length === 0 ? <Empty msg="No news items." /> : newsItems.map((i, idx) => <div key={i.id} className={`animate-fade-up stagger-${Math.min(idx+1,5)}`}><NewsCard item={i} /></div>)}</div>);
      case 'schedule':
        return (<div className="grid gap-3">{scheduleItems.length === 0 ? <Empty msg="No scheduled events." /> : scheduleItems.sort((a,b) => new Date(a.event_time||0).getTime() - new Date(b.event_time||0).getTime()).map((i, idx) => <div key={i.id} className={`animate-fade-up stagger-${Math.min(idx+1,5)}`}><ScheduleRow item={i} now={now} /></div>)}</div>);
      case 'done':
        return (<div className="grid gap-3">{doneItems.length === 0 ? <Empty msg="No completed items." /> : doneItems.slice(0,20).map((i, idx) => <div key={i.id} className={`animate-fade-up stagger-${Math.min(idx+1,5)}`}><TriageCard item={i} /></div>)}</div>);
      default: return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative z-10">
      {/* Header */}
      <header className="glass border-b border-border/60 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] tracking-[0.25em] uppercase text-secondary/60" style={{ fontFamily: 'var(--font-display)' }}>Clinic of AI</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-primary mt-1.5 tracking-tight">Morning Triage</h1>
            </div>
            <div className="text-right">
              <p className="text-xs text-secondary font-mono">{format(new Date(), 'EEEE')}</p>
              <p className="text-sm text-primary font-semibold">{format(new Date(), 'MMM d, yyyy')}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Stats row */}
      <div className="glass border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
            <StatCard number={pendingActions.length} label="To Approve" bgColor="bg-warning/8" numberColor="text-warning" icon={<Shield size={18} className="text-warning" />} />
            <StatCard number={stats?.urgent_count || urgentItems.length} label="Urgent" bgColor="bg-danger/8" numberColor="text-danger" icon={<AlertCircle size={18} className="text-danger" />} />
            <StatCard number={stats?.in_progress_count || 0} label="In Progress" bgColor="bg-info/8" numberColor="text-info" icon={<Activity size={18} className="text-info" />} />
            <StatCard number={stats?.job_count || jobItems.length} label="Jobs" bgColor="bg-accent/8" numberColor="text-accent" icon={<Briefcase size={18} className="text-accent" />} />
            <StatCard number={stats?.done_count || doneItems.length} label="Done" bgColor="bg-success/8" numberColor="text-success" icon={<CheckCircle2 size={18} className="text-success" />} />
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="glass border-b border-border/40 sticky top-[73px] sm:top-[81px] z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-0.5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${
                  activeTab === tab.id ? 'border-accent text-accent' : 'border-transparent text-secondary hover:text-primary'
                } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}>
                {tab.icon}
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`ml-0.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-mono font-semibold ${
                    tab.pulse ? 'bg-warning/20 text-warning animate-pulse-glow'
                      : activeTab === tab.id ? 'bg-accent/15 text-accent' : 'bg-elevated text-secondary'
                  }`}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">{renderTabContent()}</main>

      {/* Footer */}
      <footer className="glass border-t border-border/40 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between text-xs text-secondary/60">
          <span style={{ fontFamily: 'var(--font-display)' }} className="text-[10px] tracking-wider">AG-UI · Chatless Surface</span>
          <span className="font-mono">Live · {format(now, 'HH:mm:ss')}</span>
        </div>
      </footer>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-center py-16 animate-fade-in"><p className="text-secondary text-sm">{msg}</p></div>;
}
