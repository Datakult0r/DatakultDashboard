'use client';

import { AlertCircle, X, ExternalLink } from 'lucide-react';
import { useState } from 'react';

interface SystemAlertProps {
  /** Alert type determines styling */
  type: 'warning' | 'error' | 'info';
  /** Main message */
  message: string;
  /** Optional action link */
  actionUrl?: string;
  /** Optional action label */
  actionLabel?: string;
  /** Whether the alert can be dismissed */
  dismissible?: boolean;
}

/**
 * System-level alert banner for dashboard-wide notifications.
 * Used for: 0 credits warnings, API errors, maintenance notices.
 */
export default function SystemAlert({
  type,
  message,
  actionUrl,
  actionLabel,
  dismissible = true,
}: SystemAlertProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const colors = {
    warning: 'bg-warning/10 border-warning/30 text-warning',
    error: 'bg-danger/10 border-danger/30 text-danger',
    info: 'bg-info/10 border-info/30 text-info',
  };

  return (
    <div className={`border rounded-lg px-4 py-3 flex items-center gap-3 ${colors[type]}`}>
      <AlertCircle size={18} className="flex-shrink-0" />
      <p className="text-sm flex-1">{message}</p>
      {actionUrl && (
        <a
          href={actionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium flex items-center gap-1 hover:opacity-80 whitespace-nowrap"
        >
          {actionLabel || 'Fix'}
          <ExternalLink size={12} />
        </a>
      )}
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="p-1 hover:opacity-60 transition-opacity"
          aria-label="Dismiss alert"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
