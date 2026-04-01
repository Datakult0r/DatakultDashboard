'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { AlertCircle, CheckCircle2, Briefcase, Newspaper, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { TriageItem, TriageStat } from '@/types/triage';
import StatCard from './StatCard';
import TriageCard from './TriageCard';
import JobCard from './JobCard';
import NewsCard from './NewsCard';
import ScheduleRow from './ScheduleRow';

type TabType = 'action' | 'review' | 'jobs' | 'news' | 'schedule' | 'done';

interface DashboardShellProps {
  /** Initial triage items from server */
  initialItems: TriageItem[];
  /** Initial stats from server */
  initialStats: TriageStat | null;
}

/**
 * Main dashboard client component with tabs, stats, and realtime subscription
 */
export default function DashboardShell({
  initialItems,
  initialStats,
}: DashboardShellProps) {
  const [items, setItems] = useState<TriageItem[]>(initialItems);
  const [stats, setStats] = useState<TriageStat | null>(initialStats);
  const [activeTab, setActiveTab] = useState<TabType>('action');
  const [now, setNow] = useState(new Date());

  // Update current time for schedule highlighting
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); // Update every minute
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

  // Helper to filter items by category
  const getItemsByCategory = (category: string) => {
    return items.filter((item) => item.category === category && item.status !== 'skipped');
  };

  const urgentItems = getItemsByCategory('urgent');
  const reviewItems = getItemsByCategory('review');
  const jobItems = getItemsByCategory('job');
  const newsItems = getItemsByCategory('news');
  const scheduleItems = getItemsByCategory('schedule');
  const doneItems = items.filter(
    (item) => item.category === 'done' || item.status === 'completed'
  );

  // Tab configuration
  const tabs: { id: TabType; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'action', label: 'Action Now', icon: <AlertCircle size={16} />, count: urgentItems.length },
    { id: 'review', label: 'Review', icon: <AlertCircle size={16} />, count: reviewItems.length },
    { id: 'jobs', label: 'Jobs', icon: <Briefcase size={16} />, count: jobItems.length },
    { id: 'news', label: 'News', icon: <Newspaper size={16} />, count: newsItems.length },
    { id: 'schedule', label: 'Schedule', icon: <Clock size={16} />, count: scheduleItems.length },
    { id: 'done', label: 'Done', icon: <CheckCircle2 size={16} />, count: doneItems.length },
  ];

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'action':
        return (
          <div className="grid gap-3">
            {urgentItems.length === 0 ? (
              <div className="text-center py-12 text-secondary">
                No urgent items. Great job!
              </div>
            ) : (
              urgentItems.map((item) => (
                <TriageCard key={item.id} item={item} />
              ))
            )}
          </div>
        );

      case 'review':
        return (
          <div className="grid gap-3">
            {reviewItems.length === 0 ? (
              <div className="text-center py-12 text-secondary">
                Nothing to review.
              </div>
            ) : (
              reviewItems.map((item) => (
                <TriageCard key={item.id} item={item} />
              ))
            )}
          </div>
        );

      case 'jobs':
        return (
          <div className="grid gap-3 md:grid-cols-2">
            {jobItems.length === 0 ? (
              <div className="text-center py-12 text-secondary">
                No jobs in pipeline.
              </div>
            ) : (
              jobItems.map((item) => (
                <JobCard key={item.id} item={item} />
              ))
            )}
          </div>
        );

      case 'news':
        return (
          <div className="grid gap-3">
            {newsItems.length === 0 ? (
              <div className="text-center py-12 text-secondary">
                No news items.
              </div>
            ) : (
              newsItems.map((item) => (
                <NewsCard key={item.id} item={item} />
              ))
            )}
          </div>
        );

      case 'schedule':
        return (
          <div className="grid gap-3">
            {scheduleItems.length === 0 ? (
              <div className="text-center py-12 text-secondary">
                No scheduled events.
              </div>
            ) : (
              scheduleItems
                .sort(
                  (a, b) =>
                    new Date(a.event_time || 0).getTime() -
                    new Date(b.event_time || 0).getTime()
                )
                .map((item) => (
                  <ScheduleRow key={item.id} item={item} now={now} />
                ))
            )}
          </div>
        );

      case 'done':
        return (
          <div className="grid gap-3">
            {doneItems.length === 0 ? (
              <div className="text-center py-12 text-secondary">
                No completed items yet.
              </div>
            ) : (
              doneItems.slice(0, 20).map((item) => (
                <TriageCard key={item.id} item={item} />
              ))
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-base flex flex-col">
      {/* Header */}
      <header className="bg-surface border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          {/* Branding */}
          <div className="mb-4">
            <p className="text-xs font-mono text-secondary uppercase tracking-widest">
              Clinic of AI
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-primary mt-1">
              Morning Triage
            </h1>
            <p className="text-xs sm:text-sm text-secondary mt-2">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
        </div>
      </header>

      {/* Stats row */}
      <div className="bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
            <StatCard
              number={stats?.urgent_count || 0}
              label="Urgent"
              bgColor="bg-danger/10"
              numberColor="text-danger"
              icon={<AlertCircle size={20} className="text-danger" />}
            />
            <StatCard
              number={stats?.in_progress_count || 0}
              label="In Progress"
              bgColor="bg-warning/10"
              numberColor="text-warning"
              icon={<AlertCircle size={20} className="text-warning" />}
            />
            <StatCard
              number={stats?.job_count || 0}
              label="Jobs"
              bgColor="bg-accent/10"
              numberColor="text-accent"
              icon={<Briefcase size={20} className="text-accent" />}
            />
            <StatCard
              number={stats?.done_count || 0}
              label="Done"
              bgColor="bg-success/10"
              numberColor="text-success"
              icon={<CheckCircle2 size={20} className="text-success" />}
            />
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="bg-surface border-b border-border sticky top-20 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-accent text-accent'
                    : 'border-transparent text-secondary hover:text-primary'
                } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className="ml-1 inline-block px-1.5 py-0.5 rounded-sm bg-surface text-xs font-mono">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderTabContent()}
      </main>

      {/* Footer */}
      <footer className="bg-surface border-t border-border mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center text-xs text-secondary">
          <p>Updates appear in real-time. Last refresh: {format(now, 'HH:mm:ss')}</p>
        </div>
      </footer>
    </div>
  );
}
