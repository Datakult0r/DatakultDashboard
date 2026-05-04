'use client';

import { useState, useEffect } from 'react';
import { Target, Briefcase } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { JobApplication, ApplicationStatus, PipelineHealthRow } from '@/types/triage';
import EngagementTracker from './EngagementTracker';
import JobsTracker from './JobsTracker';
import AutoApplyQueue from './AutoApplyQueue';
import ApplicationTracker from './ApplicationTracker';

interface PipelineSurfaceProps {
  applications: JobApplication[];
  onApplicationStatusChange: (id: string, status: ApplicationStatus) => Promise<void>;
}

type PipelineSubtab = 'customers' | 'jobs' | 'applied';

/** PIPELINE — customers + scored jobs (philippe_jobs) + applied jobs (job_applications). */
export default function PipelineSurface({ applications, onApplicationStatusChange }: PipelineSurfaceProps) {
  const [subtab, setSubtab] = useState<PipelineSubtab>('jobs');
  const [health, setHealth] = useState<PipelineHealthRow[]>([]);
  const [jobsTotal, setJobsTotal] = useState<number>(0);

  useEffect(() => {
    const reload = async () => {
      const { data } = await supabase.from('pipeline_health').select('*');
      setHealth((data ?? []) as PipelineHealthRow[]);
      const { count } = await supabase.from('philippe_jobs').select('*', { count: 'exact', head: true });
      setJobsTotal(count ?? 0);
    };
    reload();
    const ch = supabase
      .channel('pipeline_health_summary')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_engagements' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'philippe_jobs' }, reload)
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, []);

  const activeStages = ['lead', 'discovery', 'proposal'] as const;
  const wonStage = health.find((h) => h.stage === 'won');
  const totalActive = health
    .filter((h) => activeStages.includes(h.stage as typeof activeStages[number]))
    .reduce((a, h) => a + h.count, 0);
  const weightedActive = health
    .filter((h) => activeStages.includes(h.stage as typeof activeStages[number]))
    .reduce((a, h) => a + h.weighted_value_eur, 0);
  const activeApps = applications.filter((a) => !['rejected', 'ghosted', 'withdrawn'].includes(a.status)).length;

  const subtabs: { id: PipelineSubtab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'jobs',      label: 'Scored Jobs', icon: <Briefcase size={14} />, count: jobsTotal },
    { id: 'customers', label: 'Leads',       icon: <Target size={14} />,    count: totalActive },
    { id: 'applied',   label: 'Applied',     icon: <Briefcase size={14} />, count: applications.length },
  ];

  return (
    <div className="space-y-5">
      {(totalActive > 0 || weightedActive > 0 || (wonStage && wonStage.count > 0) || activeApps > 0 || jobsTotal > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryTile label="Scored jobs" value={jobsTotal.toString()} color="info" icon={<Briefcase size={14} />} />
          <SummaryTile label="Active leads" value={totalActive.toString()} color="accent" icon={<Target size={14} />} />
          <SummaryTile label="Weighted pipeline" value={`€${weightedActive.toLocaleString()}`} color="money" icon={<Target size={14} />} />
          <SummaryTile label="Deals won" value={(wonStage?.count ?? 0).toString()} color="success" icon={<Target size={14} />} />
        </div>
      )}

      <div className="flex items-center gap-1">
        {subtabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubtab(t.id)}
            className={`relative flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              subtab === t.id
                ? 'bg-accent/12 text-accent shadow-sm shadow-accent/5'
                : 'text-secondary/70 hover:text-primary hover:bg-elevated/40'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
            {t.count > 0 && (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                subtab === t.id ? 'bg-accent/15 text-accent' : 'bg-elevated/60 text-tertiary'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {subtab === 'jobs' ? (
        <div className="space-y-4">
          <AutoApplyQueue />
          <JobsTracker />
        </div>
      ) : subtab === 'customers' ? (
        <EngagementTracker />
      ) : (
        <ApplicationTracker applications={applications} onStatusChange={onApplicationStatusChange} />
      )}
    </div>
  );
}

function SummaryTile({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    accent:  { bg: 'bg-accent/5',  text: 'text-accent',  border: 'border-accent/15' },
    money:   { bg: 'bg-money/5',   text: 'text-money',   border: 'border-money/15' },
    success: { bg: 'bg-success/5', text: 'text-success', border: 'border-success/15' },
    info:    { bg: 'bg-info/5',    text: 'text-info',    border: 'border-info/15' },
  };
  const c = colorMap[color] || colorMap.accent;
  return (
    <div className={`relative ${c.bg} border ${c.border} rounded-xl px-4 py-3 overflow-hidden stat-glow ${c.text}`}>
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wider text-tertiary font-mono">{label}</div>
          <span className="opacity-20">{icon}</span>
        </div>
        <div className={`text-2xl font-mono font-bold mt-1 ${c.text} count-animate`}>{value}</div>
      </div>
    </div>
  );
}
