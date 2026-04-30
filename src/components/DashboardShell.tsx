'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Shield,
  AlertCircle,
  CheckCircle2,
  Briefcase,
  Newspaper,
  Clock,
  Activity,
  Send,
  PhoneOff,
  ExternalLink,
  Globe,
  CalendarDays,
  Link2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { TriageItem, TriageStat, JobApplication, ApplicationStatus } from '@/types/triage';
import StatCard from './StatCard';
import TriageCard from './TriageCard';
import JobCard from './JobCard';
import NewsCard from './NewsCard';
import ScheduleRow from './ScheduleRow';
import ApprovalQueue from './ApprovalQueue';
import ApplicationTracker from './ApplicationTracker';
import MissedMeetingCard from './MissedMeetingCard';
import MissionCriticalBar from './MissionCriticalBar';
import SystemAlert from './SystemAlert';
import ChatWidget from './ChatWidget';
import ErrorBoundary from './ErrorBoundary';
import type { MissionItem } from './MissionCriticalBar';

type TabType = 'missed' | 'approval' | 'action' | 'review' | 'jobs' | 'applications' | 'news' | 'schedule' | 'done';

interface DashboardShellProps {
  /** Initial triage items from server */
  initialItems: TriageItem[];
  /** Initial stats from server */
  initialStats: TriageStat | null;
  /** Initial job applications from server */
  initialApplications: JobApplication[];
}

/**
 * Main dashboard client component — AG-UI Chatless Generative UI surface
 * The agent prepares actions, Philippe approves/rejects from here
 */
export default function DashboardShell({
  initialItems,
  initialStats,
  initialApplications,
}: DashboardShellProps) {
  const [items, setItems] = useState<TriageItem[]>(initialItems);
  const [stats, setStats] = useState<TriageStat | null>(initialStats);
  const [applications, setApplications] = useState<JobApplication[]>(initialApplications);
  // Default to missed tab if there are pending missed items, otherwise approval
  const [activeTab, setActiveTab] = useState<TabType>(
    initialItems.some((i) => i.tags?.includes('missed') && i.action_status === 'pending_review')
      ? 'missed'
      : 'approval'
  );
  const [now, setNow] = useState(new Date());

  // Update current time for schedule highlighting
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Set up realtime subscription
  useEffect(() => {
    const subscription = supabase
      .channel('triage_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'triage_items',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setItems((prev) => [payload.new as TriageItem, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setItems((prev) =>
              prev.map((item) =>
                item.id === (payload.new as TriageItem).id
                  ? (payload.new as TriageItem)
                  : item
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setItems((prev) =>
              prev.filter((item) => item.id !== (payload.old as TriageItem).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Realtime subscription for job_applications
  useEffect(() => {
    const subscription = supabase
      .channel('application_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_applications',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setApplications((prev) => [payload.new as JobApplication, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setApplications((prev) =>
              prev.map((app) =>
                app.id === (payload.new as JobApplication).id
                  ? (payload.new as JobApplication)
                  : app
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setApplications((prev) =>
              prev.filter((app) => app.id !== (payload.old as JobApplication).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Application status change handler
  const handleApplicationStatusChange = useCallback(async (id: string, status: ApplicationStatus) => {
    // Optimistic update
    setApplications((prev) =>
      prev.map((app) =>
        app.id === id ? { ...app, status, last_activity_date: new Date().toISOString().split('T')[0] } : app
      )
    );
    const res = await fetch('/api/applications/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      console.error('Failed to update application status');
      // Revert on failure — refetch
      const { data } = await supabase.from('job_applications').select('*').order('applied_date', { ascending: false });
      if (data) setApplications(data as JobApplication[]);
    }
  }, []);

  // A2UI: Approve action
  const handleApprove = useCallback(async (id: string) => {
    const res = await fetch('/api/actions/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) throw new Error('Failed to approve');
    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, action_status: 'approved' as const } : item
      )
    );
  }, []);

  // A2UI: Reject action
  const handleReject = useCallback(async (id: string) => {
    const res = await fetch('/api/actions/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) throw new Error('Failed to reject');
    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, action_status: 'rejected' as const } : item
      )
    );
  }, []);

  // Category filters
  const getItemsByCategory = (category: string) => {
    return items.filter((item) => item.category === category && item.status !== 'skipped');
  };

  const missedItems = items.filter((i) => i.tags?.includes('missed'));
  const missedPending = missedItems.filter((i) => i.action_status === 'pending_review');
  const actionableItems = items.filter((i) => i.action_type !== null && !i.tags?.includes('missed'));
  const pendingActions = actionableItems.filter((i) => i.action_status === 'pending_review');
  const urgentItems = getItemsByCategory('urgent').filter((i) => !i.tags?.includes('missed'));
  const reviewItems = getItemsByCategory('review');
  const jobItems = getItemsByCategory('job');
  const newsItems = getItemsByCategory('news');
  const scheduleItems = getItemsByCategory('schedule');
  const doneItems = items.filter(
    (item) => item.category === 'done' || item.status === 'completed'
  );
  const activeApplications = applications.filter(
    (a) => !['rejected', 'ghosted', 'withdrawn'].includes(a.status)
  );

  // ── Mission-Critical Focus Items ──
  // Derive from pipeline contacts, high-priority items, and strategic deadlines
  const missionItems: MissionItem[] = (() => {
    const missions: MissionItem[] = [];

    // 1. Pipeline deals (applications in interview/screening stage)
    const pipelineDeals = applications.filter((a) =>
      ['interview', 'screening'].includes(a.status)
    );
    if (pipelineDeals.length > 0) {
      const topDeal = pipelineDeals[0];
      missions.push({
        id: 'pipeline-active',
        title: `${topDeal.company} — ${topDeal.role}`,
        subtitle: `${pipelineDeals.length} active pipeline deal${pipelineDeals.length > 1 ? 's' : ''}. Status: ${topDeal.status}. ${topDeal.contact_name ? `Contact: ${topDeal.contact_name}` : ''}`,
        urgency: topDeal.status === 'interview' ? 'critical' : 'high',
        link: topDeal.job_url || topDeal.contact_url || undefined,
        metric: `${pipelineDeals.length} in pipeline`,
      });
    }

    // 2. Highest priority pending approval items
    const criticalPending = pendingActions
      .filter((i) => (i.priority || 0) >= 8)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
    if (criticalPending.length > 0) {
      missions.push({
        id: 'urgent-approvals',
        title: `${criticalPending.length} high-priority action${criticalPending.length > 1 ? 's' : ''} pending`,
        subtitle: criticalPending.slice(0, 2).map((i) => i.title).join(' · '),
        urgency: 'critical',
        metric: `Priority ${criticalPending[0].priority}+`,
      });
    }

    // 3. Job search momentum
    const recentJobs = jobItems.filter((j) => j.score && j.score >= 65);
    const totalApps = applications.length;
    if (recentJobs.length > 0 || totalApps > 0) {
      missions.push({
        id: 'job-momentum',
        title: 'Job Search Momentum',
        subtitle: `${recentJobs.length} strong matches today. ${totalApps} total applications tracked.`,
        urgency: recentJobs.length >= 3 ? 'high' : 'tracking',
        progress: Math.min(Math.round((activeApplications.length / Math.max(totalApps, 1)) * 100), 100),
        metric: `${activeApplications.length} active / ${totalApps} total`,
      });
    }

    return missions.slice(0, 3);
  })();

  // Tab configuration — Missed meetings first when they exist, then Approval Queue
  const tabs: { id: TabType; label: string; icon: React.ReactNode; count: number; pulse?: boolean; danger?: boolean }[] = [
    ...(missedItems.length > 0 ? [{ id: 'missed' as TabType, label: 'Missed', icon: <PhoneOff size={16} />, count: missedPending.length, pulse: missedPending.length > 0, danger: missedPending.length > 0 }] : []),
    { id: 'approval', label: 'Approve', icon: <Shield size={16} />, count: pendingActions.length, pulse: pendingActions.length > 0 },
    { id: 'action', label: 'Action', icon: <AlertCircle size={16} />, count: urgentItems.length },
    { id: 'review', label: 'Review', icon: <Activity size={16} />, count: reviewItems.length },
    { id: 'jobs', label: 'Jobs', icon: <Briefcase size={16} />, count: jobItems.length },
    { id: 'applications', label: 'Pipeline', icon: <Send size={16} />, count: activeApplications.length },
    { id: 'news', label: 'News', icon: <Newspaper size={16} />, count: newsItems.length },
    { id: 'schedule', label: 'Schedule', icon: <Clock size={16} />, count: scheduleItems.length },
    { id: 'done', label: 'Done', icon: <CheckCircle2 size={16} />, count: doneItems.length },
  ];

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'missed':
        return (
          <div className="space-y-4">
            {missedItems.length === 0 ? (
              <EmptyState message="No missed meetings. You're all caught up!" />
            ) : (
              <>
                <div className="bg-danger/5 border border-danger/20 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-semibold text-danger flex items-center gap-2 mb-1">
                    <PhoneOff size={16} />
                    {missedPending.length} meetings need apology messages
                  </h3>
                  <p className="text-xs text-secondary">
                    Review each draft, click &quot;Send Apology&quot; to queue it, or copy the message to send manually via LinkedIn.
                  </p>
                </div>
                <div className="grid gap-3">
                  {missedItems
                    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
                    .map((item, i) => (
                      <div key={item.id} className={`animate-fade-up stagger-${Math.min(i + 1, 5)}`}>
                        <MissedMeetingCard
                          item={item}
                          onApprove={handleApprove}
                          onReject={handleReject}
                        />
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        );

      case 'approval':
        return (
          <ApprovalQueue
            items={actionableItems}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        );

      case 'action':
        return (
          <div className="grid gap-3">
            {urgentItems.length === 0 ? (
              <EmptyState message="No urgent items. Great job!" />
            ) : (
              urgentItems.map((item, i) => (
                <div key={item.id} className={`animate-fade-up stagger-${Math.min(i + 1, 5)}`}>
                  <TriageCard item={item} />
                </div>
              ))
            )}
          </div>
        );

      case 'review':
        return (
          <div className="grid gap-3">
            {reviewItems.length === 0 ? (
              <EmptyState message="Nothing to review." />
            ) : (
              reviewItems.map((item, i) => (
                <div key={item.id} className={`animate-fade-up stagger-${Math.min(i + 1, 5)}`}>
                  <TriageCard item={item} />
                </div>
              ))
            )}
          </div>
        );

      case 'jobs':
        return (
          <div className="grid gap-3 md:grid-cols-2">
            {jobItems.length === 0 ? (
              <EmptyState message="No jobs in pipeline." />
            ) : (
              jobItems.map((item, i) => (
                <div key={item.id} className={`animate-fade-up stagger-${Math.min(i + 1, 5)}`}>
                  <JobCard item={item} />
                </div>
              ))
            )}
          </div>
        );

      case 'applications':
        return (
          <ApplicationTracker
            applications={applications}
            onStatusChange={handleApplicationStatusChange}
          />
        );

      case 'news':
        return (
          <div className="grid gap-3">
            {newsItems.length === 0 ? (
              <EmptyState message="No news items." />
            ) : (
              newsItems.map((item, i) => (
                <div key={item.id} className={`animate-fade-up stagger-${Math.min(i + 1, 5)}`}>
                  <NewsCard item={item} />
                </div>
              ))
            )}
          </div>
        );

      case 'schedule':
        return (
          <div className="grid gap-3">
            {scheduleItems.length === 0 ? (
              <EmptyState message="No scheduled events." />
            ) : (
              scheduleItems
                .sort(
                  (a, b) =>
                    new Date(a.event_time || 0).getTime() -
                    new Date(b.event_time || 0).getTime()
                )
                .map((item, i) => (
                  <div key={item.id} className={`animate-fade-up stagger-${Math.min(i + 1, 5)}`}>
                    <ScheduleRow item={item} now={now} />
                  </div>
                ))
            )}
          </div>
        );

      case 'done':
        return (
          <div className="grid gap-3">
            {doneItems.length === 0 ? (
              <EmptyState message="No completed items yet." />
            ) : (
              doneItems.slice(0, 20).map((item, i) => (
                <div key={item.id} className={`animate-fade-up stagger-${Math.min(i + 1, 5)}`}>
                  <TriageCard item={item} />
                </div>
              ))
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative z-10">
      {/* Header — refined with atmospheric gradient */}
      <header className="glass border-b border-border/60 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] tracking-[0.25em] uppercase text-secondary font-mono">
                01 — Clinic of AI
              </p>
              <h1 className="text-2xl sm:text-3xl font-semibold text-primary mt-1 tracking-tight">
                Control Tower
              </h1>
            </div>

            {/* Quick-action links */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5">
                <a
                  href="https://www.linkedin.com/messaging/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-info/10 text-info hover:bg-info/20 border border-info/20 transition-colors"
                  title="Open LinkedIn Messages"
                >
                  <Globe size={13} />
                  DMs
                </a>
                <a
                  href="https://calendar.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20 transition-colors"
                  title="Open Google Calendar"
                >
                  <CalendarDays size={13} />
                  Calendar
                </a>
                <a
                  href="https://cal.read.ai/philippe-datakult/30-min"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-success/10 text-success hover:bg-success/20 border border-success/20 transition-colors"
                  title="Share booking link"
                >
                  <Link2 size={13} />
                  Book
                </a>
              </div>
              <div className="text-right ml-3">
                <p className="text-xs text-secondary font-mono">
                  {format(new Date(), 'EEEE')}
                </p>
                <p className="text-sm text-primary font-semibold">
                  {format(new Date(), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Stats row — refined cards */}
      <div className="glass border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className={`grid grid-cols-2 gap-2 ${missedPending.length > 0 ? 'sm:grid-cols-6' : 'sm:grid-cols-5'} sm:gap-3`}>
            {missedPending.length > 0 && (
              <StatCard
                number={missedPending.length}
                label="Missed"
                bgColor="bg-danger/12"
                numberColor="text-danger"
                icon={<PhoneOff size={18} className="text-danger animate-pulse" />}
              />
            )}
            <StatCard
              number={pendingActions.length}
              label="To Approve"
              bgColor="bg-warning/8"
              numberColor="text-warning"
              icon={<Shield size={18} className="text-warning" />}
            />
            <StatCard
              number={stats?.urgent_count || urgentItems.length}
              label="Urgent"
              bgColor="bg-danger/8"
              numberColor="text-danger"
              icon={<AlertCircle size={18} className="text-danger" />}
            />
            <StatCard
              number={stats?.in_progress_count || 0}
              label="In Progress"
              bgColor="bg-info/8"
              numberColor="text-info"
              icon={<Activity size={18} className="text-info" />}
            />
            <StatCard
              number={stats?.job_count || jobItems.length}
              label="Jobs"
              bgColor="bg-accent/8"
              numberColor="text-accent"
              icon={<Briefcase size={18} className="text-accent" />}
            />
            <StatCard
              number={stats?.done_count || doneItems.length}
              label="Done"
              bgColor="bg-success/8"
              numberColor="text-success"
              icon={<CheckCircle2 size={18} className="text-success" />}
            />
          </div>
        </div>
      </div>

      {/* Mission-Critical Focus Bar — always visible */}
      {missionItems.length > 0 && (
        <MissionCriticalBar items={missionItems} />
      )}

      {/* Tab navigation — elevated with glass effect */}
      <div className="glass border-b border-border/40 sticky top-[73px] sm:top-[81px] z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-0.5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            {tabs.map((tab) => {
              const isDanger = 'danger' in tab && tab.danger;
              const activeColor = isDanger ? 'border-danger text-danger' : 'border-accent text-accent';
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    relative flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2
                    ${activeTab === tab.id
                      ? activeColor
                      : 'border-transparent text-secondary hover:text-primary'
                    }
                    focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
                  `}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className={`
                      ml-0.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-mono font-semibold
                      ${isDanger
                        ? 'bg-danger/20 text-danger animate-pulse-glow'
                        : tab.pulse
                          ? 'bg-warning/20 text-warning animate-pulse-glow'
                          : activeTab === tab.id
                            ? 'bg-accent/15 text-accent'
                            : 'bg-elevated text-secondary'
                      }
                    `}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content area with tab transition */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* System alerts */}
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

        <ErrorBoundary label={activeTab}>
          <div key={activeTab} className="animate-tab-enter">
            {renderTabContent()}
          </div>
        </ErrorBoundary>
      </main>

      {/* Footer */}
      <footer className="glass border-t border-border/40 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between text-xs text-secondary/60">
          <span className="text-[10px] tracking-[0.15em] uppercase font-mono">
            AG-UI · Chatless Surface
          </span>
          <div className="flex items-center gap-3">
            <span className="font-mono">
              Live · {format(now, 'HH:mm:ss')}
            </span>
            <span className="text-secondary/30">|</span>
            <span className="font-mono text-[10px]">
              {items.length} items · {applications.length} apps
            </span>
          </div>
        </div>
      </footer>

      {/* Chat widget — natural language dashboard assistant */}
      <ChatWidget items={items} applications={applications} stats={stats} />
    </div>
  );
}

/** Empty state component for tabs with no items */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 animate-fade-in">
      <p className="text-secondary text-sm">{message}</p>
    </div>
  );
}
