'use client';

import { useState } from 'react';
import { Shield, CheckCheck, Filter } from 'lucide-react';
import type { TriageItem } from '@/types/triage';
import ActionCard from './ActionCard';

interface ApprovalQueueProps {
  /** All items that have an action_type set */
  items: TriageItem[];
  /** Callback when user approves an item */
  onApprove: (id: string) => Promise<void>;
  /** Callback when user rejects an item */
  onReject: (id: string) => Promise<void>;
}

type QueueFilter = 'pending' | 'approved' | 'rejected' | 'all';

/**
 * ApprovalQueue — The AG-UI delegation surface
 * Shows all agent-prepared actions, grouped by status
 * Philippe reviews, approves, or rejects with one click
 */
export default function ApprovalQueue({ items, onApprove, onReject }: ApprovalQueueProps) {
  const [filter, setFilter] = useState<QueueFilter>('pending');

  const pendingItems = items.filter((i) => i.action_status === 'pending_review');
  const approvedItems = items.filter((i) => i.action_status === 'approved' || i.action_status === 'executing' || i.action_status === 'executed');
  const rejectedItems = items.filter((i) => i.action_status === 'rejected');

  const filteredItems = filter === 'pending'
    ? pendingItems
    : filter === 'approved'
      ? approvedItems
      : filter === 'rejected'
        ? rejectedItems
        : items;

  // Sort: pending_review first (by score descending), then by created_at
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (a.action_status === 'pending_review' && b.action_status !== 'pending_review') return -1;
    if (a.action_status !== 'pending_review' && b.action_status === 'pending_review') return 1;
    return (b.score || 0) - (a.score || 0);
  });

  const filters: { id: QueueFilter; label: string; count: number }[] = [
    { id: 'pending', label: 'Pending', count: pendingItems.length },
    { id: 'approved', label: 'Approved', count: approvedItems.length },
    { id: 'rejected', label: 'Rejected', count: rejectedItems.length },
    { id: 'all', label: 'All', count: items.length },
  ];

  return (
    <div>
      {/* Queue header with stats */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-warning">
            <Shield size={18} />
            <span className="text-sm font-semibold">
              {pendingItems.length} awaiting review
            </span>
          </div>
          {approvedItems.length > 0 && (
            <div className="flex items-center gap-1.5 text-success/70">
              <CheckCheck size={14} />
              <span className="text-xs">{approvedItems.length} approved</span>
            </div>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1">
          <Filter size={14} className="text-secondary mr-1" />
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-2.5 py-1 text-xs rounded-sm font-medium transition-colors ${
                filter === f.id
                  ? 'bg-accent/15 text-accent border border-accent/30'
                  : 'text-secondary hover:text-primary hover:bg-elevated border border-transparent'
              }`}
            >
              {f.label}
              {f.count > 0 && (
                <span className="ml-1 opacity-70">{f.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Action cards grid */}
      <div className="grid gap-3">
        {sortedItems.length === 0 ? (
          <div className="text-center py-16">
            <Shield size={32} className="mx-auto text-secondary/40 mb-3" />
            <p className="text-secondary text-sm">
              {filter === 'pending'
                ? 'No actions awaiting review. The agent will prepare more during the next triage.'
                : `No ${filter} items.`}
            </p>
          </div>
        ) : (
          sortedItems.map((item) => (
            <ActionCard
              key={item.id}
              item={item}
              onApprove={onApprove}
              onReject={onReject}
            />
          ))
        )}
      </div>
    </div>
  );
}
