import { ReactNode } from 'react';

interface StatCardProps {
  icon?: ReactNode;
  label: string;
  value: string | number;
  trend?: { value: number; direction: 'up' | 'down' };
}

/**
 * Large stat display card with icon support
 * ClickUp-style layout
 */
export function StatCard({ icon, label, value, trend }: StatCardProps) {
  return (
    <div className="bg-surface/40 backdrop-blur-sm border border-border/50 rounded-lg p-6 hover:bg-surface/60 transition-colors">
      {icon && <div className="text-primary mb-3">{icon}</div>}
      <p className="text-sm text-base/60 mb-2">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-bold text-elevated">{value}</p>
        {trend && (
          <span
            className={`text-xs font-medium ${
              trend.direction === 'up' ? 'text-success' : 'text-danger'
            }`}
          >
            {trend.direction === 'up' ? '+' : '-'}
            {trend.value}%
          </span>
        )}
      </div>
    </div>
  );
}

export default StatCard;
