'use client';

import { useState, useMemo } from 'react';
import {
  Send,
  Search,
  Filter,
  Clock,
  TrendingUp,
  XCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { JobApplication, ApplicationStatus } from '@/types/triage';
import ApplicationRow from './ApplicationRow';
import PipelineFunnel from './PipelineFunnel';

/** Filter options for the tracker */
type FilterMode = 'all' | 'active' | 'stale' | 'terminal';

interface ApplicationTrackerProps {
  /** All job applications */
  applications: JobApplication[];
  /** Callback when status changes */
  onStatusChange: (id: string, status: ApplicationStatus) => void;
}

/** Pipeline summary stats */
interface PipelineStats {
  total: number;
  applied: number;
  screening: number;
  interview: number;
  offer: number;
  rejected: number;
  ghosted: number;
  stale: number;
}

/**
 * Job Application Tracker — persistent pipeline view
 * Shows all applications with filtering, search, and pipeline stats
 */
export default function ApplicationTracker({
  applications,
  onStatusChange,
}: ApplicationTrackerProps) {
  const [filter, setFilter] = useState<FilterMode>('active');
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate pipeline stats
  const stats: PipelineStats = useMemo(() => {
    const now = Date.now();
    let staleCount = 0;
    const counts: PipelineStats = {
      total: applications.length,
      applied: 0,
      screening: 0,
      interview: 0,
      offer: 0,
      rejected: 0,
      ghosted: 0,
      stale: 0,
    };

    for (const app of applications) {
      if (app.status in counts) {
        counts[app.status as keyof Omit<PipelineStats, 'total' | 'stale'>]++;
      }
      const lastActivity = app.last_activity_date || app.applied_date;
      const daysSince = Math.floor((now - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince >= 5 && !['rejected', 'ghosted', 'withdrawn', 'offer'].includes(app.status)) {
        staleCount++;
      }
    }
    counts.stale = staleCount;
    return counts;
  }, [applications]);

  // Filter and search applications
  const filteredApps = useMemo(() => {
    const now = Date.now();
    let filtered = applications;

    // Apply filter mode
    switch (filter) {
      case 'active':
        filtered = filtered.filter(
          (a) => !['rejected', 'ghosted', 'withdrawn'].includes(a.status)
        );
        break;
      case 'stale':
        filtered = filtered.filter((a) => {
          const lastActivity = a.last_activity_date || a.applied_date;
          const daysSince = Math.floor((now - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));
          return daysSince >= 5 && !['rejected', 'ghosted', 'withdrawn', 'offer'].includes(a.status);
        });
        break;
      case 'terminal':
        filtered = filtered.filter((a) =>
          ['rejected', 'ghosted', 'withdrawn'].includes(a.status)
        );
        break;
      // 'all' — no filter
    }

    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.company.toLowerCase().includes(q) ||
          a.role.toLowerCase().includes(q) ||
          (a.contact_name && a.contact_name.toLowerCase().includes(q)) ||
          (a.location && a.location.toLowerCase().includes(q))
      );
    }

    // Sort: active by applied_date desc, terminal at bottom
    return filtered.sort((a, b) => {
      const aTerminal = ['rejected', 'ghosted', 'withdrawn'].includes(a.status);
      const bTerminal = ['rejected', 'ghosted', 'withdrawn'].includes(b.status);
      if (aTerminal !== bTerminal) return aTerminal ? 1 : -1;
      return new Date(b.applied_date).getTime() - new Date(a.applied_date).getTime();
    });
  }, [applications, filter, searchQuery]);

  const filterButtons: { mode: FilterMode; label: string; icon: React.ReactNode; count: number }[] = [
    { mode: 'active', label: 'Active', icon: <TrendingUp size={12} />, count: stats.total - stats.rejected - stats.ghosted },
    { mode: 'stale', label: 'Stale', icon: <AlertTriangle size={12} />, count: stats.stale },
    { mode: 'terminal', label: 'Closed', icon: <XCircle size={12} />, count: stats.rejected + stats.ghosted },
    { mode: 'all', label: 'All', icon: <Filter size={12} />, count: stats.total },
  ];

  return (
    <div className="space-y-4">
      {/* Visual pipeline funnel */}
      <PipelineFunnel applications={applications} />

      {/* Pipeline summary bar */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {[
          { label: 'Applied', count: stats.applied, color: 'text-accent' },
          { label: 'Screening', count: stats.screening, color: 'text-info' },
          { label: 'Interview', count: stats.interview, color: 'text-warning' },
          { label: 'Offer', count: stats.offer, color: 'text-success' },
          { label: 'Rejected', count: stats.rejected, color: 'text-danger' },
          { label: 'Ghosted', count: stats.ghosted, color: 'text-secondary' },
          { label: 'Stale', count: stats.stale, color: 'text-warning' },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className={`text-lg sm:text-xl font-mono font-bold ${s.color}`}>{s.count}</p>
            <p className="text-[10px] text-secondary/60 uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + filter row */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/40" />
          <input
            type="text"
            placeholder="Search company, role, contact..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-elevated border border-border/60 rounded-lg text-sm text-primary placeholder:text-secondary/40 focus:outline-none focus:border-accent/50 transition-colors"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex gap-1">
          {filterButtons.map((btn) => (
            <button
              key={btn.mode}
              onClick={() => setFilter(btn.mode)}
              className={`
                inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors
                ${filter === btn.mode
                  ? 'bg-accent/15 text-accent border border-accent/30'
                  : 'bg-elevated text-secondary border border-border/40 hover:text-primary'
                }
              `}
            >
              {btn.icon}
              {btn.label}
              <span className="font-mono ml-0.5">{btn.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Application list */}
      <div className="grid gap-2">
        {filteredApps.length === 0 ? (
          <div className="text-center py-16 animate-fade-in">
            <p className="text-secondary text-sm">
              {searchQuery
                ? 'No applications match your search.'
                : filter === 'stale'
                  ? 'No stale applications. Pipeline is healthy!'
                  : 'No applications yet.'}
            </p>
          </div>
        ) : (
          filteredApps.map((app, i) => (
            <div key={app.id} className={`animate-fade-up stagger-${Math.min(i + 1, 5)}`}>
              <ApplicationRow
                application={app}
                onStatusChange={onStatusChange}
              />
            </div>
          ))
        )}
      </div>

      {/* Footer stats */}
      {filteredApps.length > 0 && (
        <p className="text-[10px] text-secondary/40 text-center font-mono">
          {filteredApps.length} of {stats.total} applications · {stats.stale > 0 ? `${stats.stale} need follow-up` : 'pipeline healthy'}
        </p>
      )}
    </div>
  );
}
