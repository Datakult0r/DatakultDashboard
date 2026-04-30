'use client';

import { useState, useEffect } from 'react';
import { Target, Briefcase } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { JobApplication, ApplicationStatus, PipelineHealthRow } from '@/types/triage';
import EngagementTracker from './EngagementTracker';
import ApplicationTracker from './ApplicationTracker';

interface PipelineSurfaceProps {
  applications: JobApplication[];
  onApplicationStatusChange: (id: string, status: ApplicationStatus) => Promise<void>;
}

type PipelineSubtab = 'customers' | 'jobs';

/** PIPELINE surface — combines customer engagements + job applications under one tab. */
export default function PipelineSurface({ applications, onApplicationStatusChange }: PipelineSurfaceProps) {
  const [subtab, setSubtab] = useState<PipelineSubtab>('customers');
  const [health, setHealth] = useState<PipelineHealthRow[]>([]);

  useEffect(() => {
    const reload = async () => {
      const { data } = await supabase.from('pipeline_health').select('*');
      setHealth((data ?? []) as PipelineHealthRow[]);
    };
    reload();
    const ch = supabase
      .channel('pipeline_health_summary')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_engagements' }, reload)
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, []);

  const activeStages = ['lead', 'discovery', 'proposal'] as const;
  const wonStage = health.find((h) => h.stage === 'won');
  const totalActive = health.filter((h) => activeStages.includes(h.stage as typeof activeStages[number])).reduce((a, h) => a + h.count, 0);
  const weightedActive = health.filter((h) => activeStages.includes(h.stage as typeof activeStages[number])).reduce((a, h) => a + h.weighted_value_eur, 0);
  const activeApps = applications.filter((a) => !['rejected','ghosted','withdrawn'].includes(a.status)).length;

  const subtabs: { id: PipelineSubtab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'customers', label: 'Customers', icon: <Target size={14} />, count: totalActive },
    { id: 'jobs', label: 'Job Apps', icon: <Briefcase size={14} />, count: applications.length },
  ];

  return (
    <div className="space-y-4">
      {/* Summary stats row */}
      {(totalActive > 0 || weightedActive > 0 || (wonStage && wonStage.count > 0) || activeApps > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <SummaryTile label="Active customers"   value={totalActive.toString()} color="text-accent" />
          <SummaryTile label="Weighted pipeline"  value={`€${weightedActive.toLocaleString()}`} color="text-money" />
          <SummaryTile label="Deals won"          value={(wonStage?.count ?? 0).toString()} color="text-success" />
          <SummaryTile label="Active job apps"    value={activeApps.toString()} color="text-info" />
        </div>
      )}

      <div className="flex items-center gap-1 border-b border-border/40 pb-2">
        {subtabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubtab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              subtab === t.id
                ? 'bg-accent/15 text-accent'
                : 'text-secondary hover:text-primary hover:bg-elevated/40'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
            {t.count > 0 && (
              <span className="text-[10px] font-mono opacity-70">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {subtab === 'customers' ? (
        <EngagementTracker />
      ) : (
        <ApplicationTracker
          applications={applications}
          onStatusChange={onApplicationStatusChange}
        />
      )}
    </div>
  );
}

function SummaryTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface border border-border rounded-md px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-tertiary font-mono">{label}</div>
      <div className={`text-lg font-mono font-semibold mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}
