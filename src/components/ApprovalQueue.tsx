'use client';

import { useState } from 'react';
import { Shield, CheckCheck, Filter, Check, X } from 'lucide-react';
import type { TriageItem } from '@/types/triage';
import ActionCard from './ActionCard';
import { useToast } from './Toast';

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const bulkApprove = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      let ok = 0;
      for (const id of selected) {
        try {
          await onApprove(id);
          ok++;
        } catch {
          /* keep going */
        }
      }
      toast.push('success', `Approved ${ok} / ${selected.size}`);
      clearSelection();
    } finally {
      setBusy(false);
    }
  };
  const bulkReject = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Skip ${selected.size} item(s)? You can undo each individually.`)) return;
    setBusy(true);
    try {
      let ok = 0;
      for (const id of selected) {
        try {
          await onReject(id);
          ok++;
        } catch {
          /* keep going */
        }
      }
      toast.push('info', `Skipped ${ok} / ${selected.size}`);
      clearSelection();
    } finally {
      setBusy(false);
    }
  };

  // Defensively treat both canonical 'pending_review' AND legacy 'pending' as pending,
  // since older Cowork session writers used 'pending'. CHECK constraint blocks new bad writes,
  // but old data may still flow through realtime updates during the rollout window.
  const pendingItems = items.filter(
    (i) => i.action_status === 'pending_review' || (i.action_status as string) === 'pending'
  );
  const approvedItems = items.filter(
    (i) => i.action_status === 'approved' || i.action_status === 'executing' || i.action_status === 'executed'
  );
  const rejectedItems = items.filter((i) => i.action_status === 'rejected' || i.action_status === 'failed');

  const filteredItems = filter === 'pending'
    ? pendingItems
    : filter === 'approved'
      ? approvedItems
      : filter === 'rejected'
        ? rejectedItems
        : items;

  // Sort: pending first (by priority desc, then score), then everything else by score
  const isPending = (s: string | null | undefined) => s === 'pending_review' || s === 'pending';
  const sortedItems = [...filteredItems].sort((a, b) => {
    const aPending = isPending(a.action_status);
    const bPending = isPending(b.action_status);
    if (aPending && !bPending) return -1;
    if (!aPending && bPending) return 1;
    const priorityDiff = (b.priority || 0) - (a.priority || 0);
    if (priorityDiff !== 0) return priorityDiff;
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

      {/* Bulk action bar — appears when items are selected */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between bg-accent/10 border border-accent/30 rounded-md px-3 py-2 animate-fade-in">
          <span className="text-xs font-mono text-accent">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={bulkApprove}
              disabled={busy}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-accent text-base rounded hover:bg-accent-bright disabled:opacity-50"
            >
              <Check size={12} />
              Approve all
            </button>
            <button
              onClick={bulkReject}
              disabled={busy}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-secondary hover:text-danger hover:bg-danger/10 border border-border rounded disabled:opacity-50"
            >
              <X size={12} />
              Skip all
            </button>
            <button
              onClick={clearSelection}
              disabled={busy}
              className="px-2 py-1 text-xs text-tertiary hover:text-secondary"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Bulk select-all when filter=pending and there are items */}
      {filter === 'pending' && pendingItems.length > 1 && (
        <div className="mb-3 flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono text-tertiary">
          <input
            type="checkbox"
            id="select-all-pending"
            checked={pendingItems.every((p) => selected.has(p.id))}
            onChange={(e) => {
              if (e.target.checked) setSelected(new Set(pendingItems.map((p) => p.id)));
              else clearSelection();
            }}
            className="accent-accent"
          />
          <label htmlFor="select-all-pending" className="cursor-pointer hover:text-secondary">
            Select all pending ({pendingItems.length})
          </label>
        </div>
      )}

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
          sortedItems.map((item) => {
            const canSelect = isPending(item.action_status);
            return (
              <div key={item.id} className="flex items-start gap-2">
                {canSelect && (
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => toggle(item.id)}
                    className="mt-3 accent-accent flex-shrink-0"
                    aria-label={`Select ${item.title}`}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <ActionCard
                    item={item}
                    onApprove={onApprove}
                    onReject={onReject}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
