'use client';

import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  /** Large number to display */
  number: number;
  /** Label beneath the number */
  label: string;
  /** Icon or color indicator */
  icon?: ReactNode;
  /** Background color class */
  bgColor?: string;
  /** Number color class */
  numberColor?: string;
  /** Optional subtext */
  subtext?: string;
  /** Trend: positive, negative, or neutral */
  trend?: 'up' | 'down' | 'flat';
  /** Trend label (e.g. "+3 today") */
  trendLabel?: string;
  /** Mini sparkline data points (last 7 values) */
  sparkline?: number[];
}

/**
 * Stat card with big number, optional sparkline, and trend indicator
 * Inspired by Dialpad live stat cards + Apollo metrics
 */
export default function StatCard({
  number,
  label,
  icon,
  bgColor = 'bg-surface',
  numberColor = 'text-primary',
  subtext,
  trend,
  trendLabel,
  sparkline,
}: StatCardProps) {
  return (
    <div
      className={`${bgColor} border border-border rounded-lg p-3 sm:p-4 flex flex-col gap-1.5 min-w-[120px] hover:border-secondary/40 transition-all duration-300 group relative overflow-hidden`}
    >
      {/* Subtle hover glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-t from-transparent via-transparent to-white/[0.02] pointer-events-none" />

      <div className="flex items-start justify-between relative">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <div className={`text-2xl sm:text-3xl font-bold font-mono ${numberColor} tabular-nums`}>
              {number}
            </div>
            {trend && (
              <span className={`inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold ${
                trend === 'up' ? 'text-success' :
                trend === 'down' ? 'text-danger' : 'text-secondary/50'
              }`}>
                {trend === 'up' ? <TrendingUp size={10} /> :
                 trend === 'down' ? <TrendingDown size={10} /> :
                 <Minus size={10} />}
                {trendLabel}
              </span>
            )}
          </div>
          <div className="text-[11px] sm:text-xs text-secondary font-medium mt-0.5">
            {label}
          </div>
          {subtext && (
            <div className="text-[10px] text-secondary/50 mt-0.5 font-mono">
              {subtext}
            </div>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 opacity-40 group-hover:opacity-60 transition-opacity">
            {icon}
          </div>
        )}
      </div>

      {/* Mini sparkline */}
      {sparkline && sparkline.length > 1 && (
        <div className="mt-1 h-5 flex items-end gap-[2px]">
          {sparkline.map((value, i) => {
            const max = Math.max(...sparkline);
            const height = max > 0 ? (value / max) * 100 : 0;
            const isLast = i === sparkline.length - 1;
            return (
              <div
                key={i}
                className={`flex-1 rounded-sm transition-all duration-500 ${
                  isLast ? numberColor.replace('text-', 'bg-') + '/60' : 'bg-border/60'
                }`}
                style={{
                  height: `${Math.max(height, 8)}%`,
                  animationDelay: `${i * 0.05}s`,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
