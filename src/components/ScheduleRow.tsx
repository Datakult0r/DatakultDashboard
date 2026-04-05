import { Clock } from 'lucide-react';

interface ScheduleRowProps {
  title: string;
  time: string;
  status: 'confirmed' | 'pending' | 'completed';
  type: 'meeting' | 'call' | 'followup';
}

/**
 * Calendar item row with time display and status badges
 */
export function ScheduleRow({ title, time, status, type }: ScheduleRowProps) {
  const statusColor = {
    confirmed: 'bg-success/20 text-success',
    pending: 'bg-warning/20 text-warning',
    completed: 'bg-base/20 text-base',
  }[status];

  const typeLabel = {
    meeting: 'Meeting',
    call: 'Call',
    followup: 'Follow-up',
  }[type];

  return (
    <div className="flex items-center gap-3 p-3 bg-surface/30 hover:bg-surface/50 rounded-lg transition-colors border border-border/30">
      <Clock size={16} className="text-base/60 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-elevated">{title}</p>
        <p className="text-xs text-base/60 mt-0.5">{time}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-xs font-medium px-2 py-1 rounded ${statusColor}`}>
          {typeLabel}
        </span>
      </div>
    </div>
  );
}

export default ScheduleRow;
