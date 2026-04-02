'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { AlertCircle, CheckCircle2, Briefcase, Newspaper, Clock, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { TriageItem, TriageStat } from '@/types/triage';
import StatCard from './StatCard';
import TriageCard from './TriageCard';
import JobCard from './JobCard';
import NewsCard from './NewsCard';
import MessageCard from './MessageCard';
import ScheduleRow from './ScheduleRow';

type TabType = 'action' | 'review' | 'jobs' | 'news' | 'messages' | 'schedule' | 'done';

interface DashboardShellProps {
  initialItems: TriageItem[];
  initialStats: TriageStat | null;
}

export default function DashboardShell({ initialItems, initialStats }: DashboardShellProps) {
  const [items, setItems] = useState<TriageItem[]>(initialItems);
  const [stats, setStats] = useState<TriageStat | null>(initialStats);
  const [activeTab, setActiveTab] = useState<TabType>('action');
  const [now, setNow] = useState(new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);

  useEffect(() => {
    const subscription = supabase.channel('triage_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'triage_items' }, (payload) => {
      if (payload.eventType === 'INSERT') setItems((prev) => [payload.new as TriageItem, ...prev]);
      else if (payload.eventType === 'UPDATE') setItems((prev) => prev.map((item) => item.id === (payload.new as TriageItem).id ? (payload.new as TriageItem) : item));
      else if (payload.eventType === 'DELETE') setItems((prev) => prev.filter((item) => item.id !== (payload.old as TriageItem).id));
    }).subscribe();
    return () => { subscription.unsubscribe(); };
  }, []);

  const getItemsByCategory = (category: string) => items.filter((item) => item.category === category && item.status !== 'skipped');
  const urgentItems = getItemsByCategory('urgent');
  const reviewItems = getItemsByCategory('review');
  const jobItems = getItemsByCategory('job');
  const newsItems = getItemsByCategory('news');
  const messageItems = items.filter((item) => (item.source === 'linkedin' || item.source === 'beeper') && item.status !== 'skipped');
  const scheduleItems = getItemsByCategory('schedule');
  const doneItems = items.filter((item) => item.category === 'done' || item.status === 'completed');

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'action', label: 'Action Now', icon: <AlertCircle size={16} />, count: urgentItems.length },
    { id: 'review', label: 'Review', icon: <AlertCircle size={16} />, count: reviewItems.length },
    { id: 'jobs', label: 'Jobs', icon: <Briefcase size={16} />, count: jobItems.length },
    { id: 'news', label: 'News', icon: <Newspaper size={16} />, count: newsItems.length },
    { id: 'messages', label: 'Messages', icon: <MessageCircle size={16} />, count: messageItems.length },
    { id: 'schedule', label: 'Schedule', icon: <Clock size={16} />, count: scheduleItems.length },
    { id: 'done', label: 'Done', icon: <CheckCircle2 size={16} />, count: doneItems.length },
  ];
  const renderTabContent = () => {
    const contentClass = activeTab === 'jobs' ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : activeTab === 'news' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4';
    switch (activeTab) {
      case 'action': return (<div className={contentClass}>{urgentItems.map((item) => (<TriageCard key={item.id} item={item} />))}{urgentItems.length === 0 && <p className="text-secondary">No urgent items</p>}</div>);
      case 'review': return (<div className={contentClass}>{reviewItems.map((item) => (<TriageCard key={item.id} item={item} />))}{reviewItems.length === 0 && <p className="text-secondary">No items to review</p>}</div>);
      case 'jobs': return (<div className={contentClass}>{jobItems.map((item) => (<JobCard key={item.id} item={item} />))}{jobItems.length === 0 && <p className="text-secondary">No job postings</p>}</div>);
      case 'news': return (<div className={contentClass}>{newsItems.map((item) => (<NewsCard key={item.id} item={item} />))}{newsItems.length === 0 && <p className="text-secondary">No news items</p>}</div>);
      case 'messages': return (<div className={contentClass}>{messageItems.map((item) => (<MessageCard key={item.id} item={item} />))}{messageItems.length === 0 && <p className="text-secondary">No messages</p>}</div>);
      case 'schedule': return (<div className={contentClass}>{scheduleItems.map((item) => (<ScheduleRow key={item.id} item={item} now={now} />))}{scheduleItems.length === 0 && <p className="text-secondary">No scheduled events</p>}</div>);
      case 'done': return (<div className={contentClass}>{doneItems.map((item) => (<TriageCard key={item.id} item={item} />))}{doneItems.length === 0 && <p className="text-secondary">No completed items</p>}</div>);
    }
  };
  return (
    <div className="min-h-screen bg-base flex flex-col">
      <div className="h-1 bg-gradient-to-r from-accent via-info to-accent" />
      <header className="bg-surface border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-mono text-secondary uppercase tracking-widest">Clinic of AI</p>
              <h1 className="text-3xl sm:text-4xl font-bold text-primary mt-2">Morning Triage</h1>
              <p className="text-sm text-secondary mt-2">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-accent">{format(now, 'HH:mm')}</div>
              <p className="text-xs text-secondary mt-1">Live</p>
            </div>
          </div>
        </div>
      </header>
      <div className="bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4 flex-1">
              <StatCard number={stats?.urgent_count || 0} label="Urgent" borderColor="border-danger" numberColor="text-danger" icon={<AlertCircle size={24} className="text-danger" />} />
              <StatCard number={stats?.in_progress_count || 0} label="In Progress" borderColor="border-warning" numberColor="text-warning" icon={<AlertCircle size={24} className="text-warning" />} />
              <StatCard number={stats?.job_count || 0} label="Jobs" borderColor="border-accent" numberColor="text-accent" icon={<Briefcase size={24} className="text-accent" />} />
              <StatCard number={stats?.done_count || 0} label="Done" borderColor="border-success" numberColor="text-success" icon={<CheckCircle2 size={24} className="text-success" />} />
            </div>
            {stats && (<div className="text-right"><div className="text-2xl font-bold font-mono text-primary">{stats.total_count}</div><p className="text-xs text-secondary">Total</p></div>)}
          </div>
        </div>
      </div>      <div className="bg-surface border-b border-border sticky top-[100px] z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 py-2">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium whitespace-nowrap rounded-full transition-colors ${activeTab === tab.id ? 'bg-accent text-base' : 'bg-transparent text-secondary hover:text-primary border border-border hover:border-secondary'} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}>
                {tab.icon}<span>{tab.label}</span>
                {tab.count > 0 && (<span className="ml-1 inline-block px-2 py-0.5 rounded-full text-xs font-mono bg-base/80">{tab.count}</span>)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">{renderTabContent()}</main>
      <footer className="bg-surface border-t border-border mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center text-xs text-secondary">
          <p>Last refresh: {format(now, 'HH:mm:ss')} &bull; Powered by Datakult</p>
        </div>
      </footer>
    </div>
  );
}