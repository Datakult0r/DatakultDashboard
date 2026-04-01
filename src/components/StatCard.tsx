'use client';

import { ReactNode } from 'react';

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
}

/**
 * Large stat card displaying a big number with label
 * Inspired by ClickUp's stat cards
 */
export default function StatCard({
  number,
  label,
  icon,
  bgColor = 'bg-surface',
  numberColor = 'text-primary',
  subtext,
}: StatCardProps) {
  return (
    <div
      className={`${bgColor} border border-border rounded-lg p-4 sm:p-6 flex flex-col gap-2 min-w-[140px] hover:border-secondary transition-colors`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className={`text-3xl sm:text-4xl font-bold font-mono ${numberColor}`}>
            {number}
          </div>
          <div className="text-xs sm:text-sm text-secondary font-medium mt-1">
            {label}
          </div>
          {subtext && (
            <div className="text-xs text-secondary/60 mt-1">
              {subtext}
            </div>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 opacity-60">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
