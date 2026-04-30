import { Clock, AlertTriangle } from 'lucide-react';

interface SLABadgeProps {
  followUpAt: string | null;
  /** Compact mode renders a single line, no icon. */
  compact?: boolean;
}

/** Small chip showing time-to / time-since the SLA follow_up_at. */
export default function SLABadge({ followUpAt, compact = false }: SLABadgeProps) {
  if (!followUpAt) return null;

  const target = new Date(followUpAt).getTime();
  const now = Date.now();
  const diffMs = target - now;
  const overdue = diffMs < 0;
  const absHours = Math.abs(diffMs) / 3600000;
  const absDays = Math.floor(absHours / 24);

  const label = overdue
    ? absDays > 0
      ? `${absDays}d overdue`
      : `${Math.floor(absHours)}h overdue`
    : absDays > 0
      ? `Due in ${absDays}d`
      : `Due in ${Math.floor(absHours)}h`;

  const color = overdue
    ? 'text-danger bg-danger/10 border-danger/30'
    : absHours < 24
      ? 'text-warning bg-warning/10 border-warning/30'
      : 'text-secondary bg-elevated border-border';

  const Icon = overdue ? AlertTriangle : Clock;

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono ${color}`}>
      {!compact && <Icon size={10} />}
      <span>{label}</span>
    </span>
  );
}
