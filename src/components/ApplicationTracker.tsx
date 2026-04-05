interface ApplicationTrackerProps {
  applications: Array<{
    id: string;
    company: string;
    position: string;
    status: 'applied' | 'screening' | 'interview' | 'offer' | 'rejected' | 'ghosted' | 'withdrawn';
    appliedDate: string;
    score: number;
  }>;
}

/**
 * Application tracking interface showing status timeline
 */
export function ApplicationTracker({ applications }: ApplicationTrackerProps) {
  const statusColors: Record<string, string> = {
    applied: 'bg-primary/20 text-primary',
    screening: 'bg-secondary/20 text-secondary',
    interview: 'bg-accent/20 text-accent',
    offer: 'bg-success/20 text-success',
    rejected: 'bg-danger/20 text-danger',
    ghosted: 'bg-warning/20 text-warning',
    withdrawn: 'bg-base/20 text-base',
  };

  return (
    <div className="space-y-3">
      {applications.map((app) => (
        <div
          key={app.id}
          className="bg-surface/40 backdrop-blur-sm border border-border/50 rounded-lg p-4 hover:bg-surface/60 transition-colors"
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-medium text-elevated text-sm">{app.position}</h3>
              <p className="text-xs text-base/60">{app.company}</p>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded ${statusColors[app.status]}`}>
              {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-base/60">
            <span>{app.appliedDate}</span>
            <span className="font-semibold text-elevated">{app.score}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ApplicationTracker;
