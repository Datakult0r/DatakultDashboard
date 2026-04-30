'use client';

import { useState } from 'react';
import { Target, Briefcase } from 'lucide-react';
import type { JobApplication, ApplicationStatus } from '@/types/triage';
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

  const subtabs: { id: PipelineSubtab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'customers', label: 'Customers', icon: <Target size={14} />, count: 0 },
    { id: 'jobs', label: 'Job Apps', icon: <Briefcase size={14} />, count: applications.length },
  ];

  return (
    <div className="space-y-4">
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
