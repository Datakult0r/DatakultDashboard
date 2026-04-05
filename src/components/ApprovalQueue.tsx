'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { ActionCard } from './ActionCard';

interface PendingAction {
  id: string;
  type: 'send_message' | 'apply_job' | 'reply_email';
  title: string;
  payload: Record<string, unknown>;
}

interface ApprovalQueueProps {
  pending: PendingAction[];
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}

/**
 * Agentic action approval queue
 * Displays pending actions for user review and approval
 */
export function ApprovalQueue({
  pending,
  onApprove,
  onReject,
}: ApprovalQueueProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleApprove = async (id: string) => {
    setLoading(id);
    try {
      await onApprove(id);
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setLoading(id);
    try {
      await onReject(id);
    } finally {
      setLoading(null);
    }
  };

  if (pending.length === 0) {
    return (
      <div className="text-center py-8 text-base/60">
        <p className="text-sm">No pending actions</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pending.map((action) => (
        <div
          key={action.id}
          className="bg-surface/40 backdrop-blur-sm border border-primary/30 rounded-lg p-4"
        >
          <ActionCard
            type={action.type}
            title={action.title}
            payload={action.payload}
          />
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => handleApprove(action.id)}
              disabled={loading === action.id}
              className="flex-1 flex items-center justify-center gap-2 bg-success/20 hover:bg-success/30 text-success rounded py-2 transition-colors disabled:opacity-50"
            >
              <Check size={16} />
              <span className="text-sm font-medium">Approve</span>
            </button>
            <button
              onClick={() => handleReject(action.id)}
              disabled={loading === action.id}
              className="flex-1 flex items-center justify-center gap-2 bg-danger/20 hover:bg-danger/30 text-danger rounded py-2 transition-colors disabled:opacity-50"
            >
              <X size={16} />
              <span className="text-sm font-medium">Reject</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ApprovalQueue;
