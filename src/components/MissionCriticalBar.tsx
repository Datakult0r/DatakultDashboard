'use client';

import { useState } from 'react';
import {
  Target,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  Flame,
  Clock,
  ExternalLink,
} from 'lucide-react';

/** A single strategic focus item */
export interface MissionItem {
  id: string;
  title: string;
  subtitle: string;
  urgency: 'critical' | 'high' | 'tracking';
  deadline?: string;
  link?: string;
  progress?: number; // 0-100
  metric?: string;
}

interface MissionCriticalBarProps {
  /** Up to 3 mission-critical focus items */
  items: MissionItem[];
}

const urgencyConfig = {
  critical: {
    icon: Flame,
    gradient: 'from-danger/20 via-danger/5 to-transparent',
    border: 'border-danger/30',
    badge: 'bg-danger/15 text-danger',
    pulse: 'animate-pulse',
    ring: 'ring-danger/20',
    label: 'CRITICAL',
  },
  high: {
    icon: AlertTriangle,
    gradient: 'from-warning/15 via-warning/5 to-transparent',
    border: 'border-warning/30',
    badge: 'bg-warning/15 text-warning',
    pulse: '',
    ring: 'ring-warning/20',
    label: 'HIGH',
  },
  tracking: {
    icon: TrendingUp,
    gradient: 'from-accent/10 via-accent/5 to-transparent',
    border: 'border-accent/20',
    badge: 'bg-accent/10 text-accent',
    pulse: '',
    ring: 'ring-accent/20',
    label: 'TRACKING',
  },
};

/**
 * Mission-Critical Focus Bar
 * Always visible above tabs — shows 3 strategic objectives
 * Agent identifies and updates these based on pipeline, deadlines, and priorities
 */
export default function MissionCriticalBar({ items }: MissionCriticalBarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (items.length === 0) return null;

  return (
    <div className="border-b border-border/40 relative overflow-hidden">
      {/* Atmospheric shimmer behind the bar */}
      <div className="absolute inset-0 bg-gradient-to-r from-danger/[0.03] via-warning/[0.02] to-accent/[0.03] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 relative">
        {/* Section label */}
        <div className="flex items-center gap-2 mb-2.5">
          <Target size={13} className="text-secondary/50" />
          <span
            className="text-[10px] tracking-[0.2em] uppercase text-secondary/50 font-semibold"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Mission Critical
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent" />
        </div>

        {/* 3-column grid of focus items */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {items.slice(0, 3).map((item) => {
            const config = urgencyConfig[item.urgency];
            const UrgencyIcon = config.icon;
            const isHovered = hoveredId === item.id;

            return (
              <div
                key={item.id}
                className={`
                  relative group rounded-lg border ${config.border} p-3
                  bg-gradient-to-br ${config.gradient}
                  hover:ring-1 ${config.ring}
                  transition-all duration-300 cursor-default
                  ${isHovered ? 'scale-[1.01]' : ''}
                `}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Top row: urgency badge + deadline */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider ${config.badge} ${config.pulse}`}>
                    <UrgencyIcon size={10} />
                    {config.label}
                  </span>
                  {item.deadline && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-secondary/70 font-mono">
                      <Clock size={10} />
                      {item.deadline}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h4 className="text-sm font-semibold text-primary leading-tight mb-1">
                  {item.title}
                </h4>

                {/* Subtitle / context */}
                <p className="text-xs text-secondary/80 leading-relaxed line-clamp-2 mb-2">
                  {item.subtitle}
                </p>

                {/* Progress bar (if provided) */}
                {item.progress !== undefined && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-secondary/60 font-mono">Progress</span>
                      <span className="text-[10px] text-secondary/80 font-mono font-bold">{item.progress}%</span>
                    </div>
                    <div className="h-1 bg-elevated rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          item.urgency === 'critical' ? 'bg-danger' :
                          item.urgency === 'high' ? 'bg-warning' : 'bg-accent'
                        }`}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Metric or link */}
                <div className="flex items-center justify-between">
                  {item.metric && (
                    <span className="text-[10px] font-mono text-secondary/60">
                      {item.metric}
                    </span>
                  )}
                  {item.link && (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-accent/70 hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
                    >
                      Open <ExternalLink size={9} />
                    </a>
                  )}
                  {!item.metric && !item.link && (
                    <ChevronRight size={14} className="text-secondary/30 group-hover:text-secondary/60 transition-colors ml-auto" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
