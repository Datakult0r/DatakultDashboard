interface ApplicationRowProps {
  company: string;
  position: string;
  status: string;
  score: number;
  onClick?: () => void;
}

/**
 * Individual application row display
 */
export function ApplicationRow({
  company,
  position,
  status,
  score,
  onClick,
}: ApplicationRowProps) {
  const statusColor = {
    applied: 'bg-primary/10 text-primary',
    screening: 'bg-secondary/10 text-secondary',
    interview: 'bg-accent/10 text-accent',
    offer: 'bg-success/10 text-success',
    rejected: 'bg-danger/10 text-danger',
  }[status] || 'bg-base/10 text-base';

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-3 bg-surface/30 hover:bg-surface/50 rounded-lg cursor-pointer transition-colors border border-border/30"
    >
      <div className="flex-1">
        <p className="text-sm font-medium text-elevated">{position}</p>
        <p className="text-xs text-base/60">{company}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded ${statusColor}`}>
          {status}
        </span>
        <span className="text-sm font-semibold text-primary">{score}</span>
      </div>
    </div>
  );
}

export default ApplicationRow;
