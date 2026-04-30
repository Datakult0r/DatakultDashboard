'use client';

import { useMemo } from 'react';
import type { JobApplication, ApplicationStatus } from '@/types/triage';

interface PipelineFunnelProps {
  /** All job applications */
  applications: JobApplication[];
}

/** Pipeline stage config */
const STAGES: { status: ApplicationStatus; label: string; color: string; glow: string }[] = [
  { status: 'applied', label: 'Applied', color: 'bg-accent', glow: 'shadow-accent/30' },
  { status: 'screening', label: 'Screening', color: 'bg-info', glow: 'shadow-info/30' },
  { status: 'interview', label: 'Interview', color: 'bg-warning', glow: 'shadow-warning/30' },
  { status: 'offer', label: 'Offer', color: 'bg-success', glow: 'shadow-success/30' },
];

const TERMINAL_STAGES: { status: ApplicationStatus; label: string; color: string }[] = [
  { status: 'rejected', label: 'Rejected', color: 'text-danger' },
  { status: 'ghosted', label: 'Ghosted', color: 'text-secondary' },
  { status: 'withdrawn', label: 'Withdrawn', color: 'text-secondary' },
];

/**
 * Visual pipeline funnel — Apollo-style horizontal bar chart
 * Shows application flow through stages with proportional widths
 */
export default function PipelineFunnel({ applications }: PipelineFunnelProps) {
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const stage of STAGES) {
      counts[stage.status] = 0;
    }
    for (const ts of TERMINAL_STAGES) {
      counts[ts.status] = 0;
    }
    for (const app of applications) {
      if (app.status in counts) {
        counts[app.status]++;
      }
    }
    return counts;
  }, [applications]);

  const maxCount = useMemo(() => {
    return Math.max(1, ...STAGES.map((s) => stageCounts[s.status]));
  }, [stageCounts]);

  const totalActive = STAGES.reduce((sum, s) => sum + stageCounts[s.status], 0);
  const totalTerminal = TERMINAL_STAGES.reduce((sum, s) => sum + stageCounts[s.status], 0);

  // Conversion rates between stages
  const conversionRates = useMemo(() => {
    const rates: string[] = [];
    for (let i = 1; i < STAGES.length; i++) {
      const prev = stageCounts[STAGES[i - 1].status];
      const curr = stageCounts[STAGES[i].status];
      if (prev > 0) {
        rates.push(`${Math.round((curr / prev) * 100)}%`);
      } else {
        rates.push('—');
      }
    }
    return rates;
  }, [stageCounts]);

  if (applications.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Funnel bars */}
      <div className="space-y-1.5">
        {STAGES.map((stage, i) => {
          const count = stageCounts[stage.status];
          const widthPercent = Math.max(8, (count / maxCount) * 100);

          return (
            <div key={stage.status} className="flex items-center gap-3">
              {/* Stage label */}
              <span className="text-[10px] font-mono uppercase tracking-wider text-secondary/60 w-20 text-right shrink-0">
                {stage.label}
              </span>

              {/* Bar container */}
              <div className="flex-1 relative h-7">
                <div
                  className={`
                    h-full rounded-md ${stage.color} shadow-sm ${stage.glow}
                    transition-all duration-700 ease-out
                    flex items-center justify-end pr-2
                  `}
                  style={{ width: `${widthPercent}%`, minWidth: count > 0 ? '40px' : '0px' }}
                >
                  {count > 0 && (
                    <span className="text-xs font-bold text-white font-mono drop-shadow-sm">
                      {count}
                    </span>
                  )}
                </div>

                {/* Conversion arrow between stages */}
                {i < STAGES.length - 1 && count > 0 && (
                  <span className="absolute -bottom-1 left-1 text-[9px] font-mono text-secondary/40">
                    ↓ {conversionRates[i]}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Terminal stages summary */}
      {totalTerminal > 0 && (
        <div className="flex items-center gap-4 pt-1 border-t border-border/30">
          <span className="text-[10px] font-mono uppercase tracking-wider text-secondary/40 w-20 text-right shrink-0">
            Closed
          </span>
          <div className="flex gap-3">
            {TERMINAL_STAGES.map((ts) => {
              const count = stageCounts[ts.status];
              if (count === 0) return null;
              return (
                <span key={ts.status} className={`text-xs font-mono ${ts.color}`}>
                  {ts.label}: {count}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Total + rate */}
      <div className="flex justify-between text-[10px] font-mono text-secondary/40">
        <span>{totalActive} active · {totalTerminal} closed</span>
        {stageCounts['offer'] > 0 && totalActive > 0 && (
          <span className="text-success">
            {Math.round((stageCounts['offer'] / applications.length) * 100)}% offer rate
          </span>
        )}
      </div>
    </div>
  );
}
