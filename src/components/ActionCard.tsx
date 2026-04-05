interface ActionCardProps {
  type: 'send_message' | 'apply_job' | 'reply_email';
  title: string;
  payload: Record<string, unknown>;
}

/**
 * Declarative action card with payload display
 * Shows what action will be taken with details
 */
export function ActionCard({ type, title, payload }: ActionCardProps) {
  const typeColor = {
    send_message: 'bg-primary/10 text-primary',
    apply_job: 'bg-success/10 text-success',
    reply_email: 'bg-secondary/10 text-secondary',
  }[type];

  const typeLabel = {
    send_message: 'Send Message',
    apply_job: 'Apply to Job',
    reply_email: 'Reply to Email',
  }[type];

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded ${typeColor}`}>
          {typeLabel}
        </span>
        <h3 className="font-medium text-elevated text-sm">{title}</h3>
      </div>
      <div className="bg-elevated/10 rounded p-3 border border-border/30">
        <pre className="text-xs text-base/70 overflow-auto max-h-32 whitespace-pre-wrap break-words">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </div>
    </div>
  );
}

export default ActionCard;
