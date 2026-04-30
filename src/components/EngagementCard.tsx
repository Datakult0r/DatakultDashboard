'use client';

import { useState } from 'react';
import { ExternalLink, Trash2, Edit3, Save, X } from 'lucide-react';
import { format } from 'date-fns';
import type { CustomerEngagement, EngagementStage } from '@/types/triage';

interface EngagementCardProps {
  engagement: CustomerEngagement;
  onUpdate: (id: string, patch: Partial<CustomerEngagement>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const STAGE_OPTIONS: EngagementStage[] = ['lead', 'discovery', 'proposal', 'won', 'lost', 'paused'];

/** Single customer engagement card. Click stage to advance, edit fields inline. */
export default function EngagementCard({ engagement, onUpdate, onDelete }: EngagementCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(engagement);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await onUpdate(engagement.id, {
        company: draft.company,
        contact_name: draft.contact_name,
        contact_email: draft.contact_email,
        contact_url: draft.contact_url,
        value_eur: draft.value_eur,
        probability: draft.probability,
        next_step: draft.next_step,
        next_step_at: draft.next_step_at,
        notes: draft.notes,
      });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const advanceStage = async (newStage: EngagementStage) => {
    setBusy(true);
    try {
      await onUpdate(engagement.id, { stage: newStage });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete engagement with ${engagement.company}?`)) return;
    setBusy(true);
    try {
      await onDelete(engagement.id);
    } finally {
      setBusy(false);
    }
  };

  const value = engagement.value_eur ?? 0;
  const prob = engagement.probability ?? 0;
  const weighted = Math.round((value * prob) / 100);
  const showFinancials = editing || value > 0;

  return (
    <div className="bg-surface border border-border rounded-lg p-4 hover:border-border-strong transition-colors">
      <div className="flex items-start justify-between gap-2 mb-3">
        {editing ? (
          <input
            value={draft.company}
            onChange={(e) => setDraft({ ...draft, company: e.target.value })}
            className="flex-1 bg-elevated border border-border rounded px-2 py-1 text-sm font-semibold text-primary focus:outline-none focus:border-accent"
          />
        ) : (
          <h4 className="text-base font-semibold text-primary leading-tight">{engagement.company}</h4>
        )}
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <button onClick={save} disabled={busy} title="Save"
                className="p-1 text-success hover:bg-success/10 rounded">
                <Save size={14} />
              </button>
              <button onClick={() => { setEditing(false); setDraft(engagement); }} disabled={busy} title="Cancel"
                className="p-1 text-tertiary hover:text-secondary rounded">
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} disabled={busy} title="Edit"
                className="p-1 text-tertiary hover:text-primary rounded">
                <Edit3 size={14} />
              </button>
              <button onClick={handleDelete} disabled={busy} title="Delete"
                className="p-1 text-tertiary hover:text-danger rounded">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Contact */}
      {editing ? (
        <div className="space-y-1.5 mb-2">
          <input
            value={draft.contact_name ?? ''}
            onChange={(e) => setDraft({ ...draft, contact_name: e.target.value || null })}
            placeholder="Contact name"
            className="w-full bg-elevated border border-border rounded px-2 py-1 text-xs text-secondary"
          />
          <input
            type="email"
            value={draft.contact_email ?? ''}
            onChange={(e) => setDraft({ ...draft, contact_email: e.target.value || null })}
            placeholder="Email"
            className="w-full bg-elevated border border-border rounded px-2 py-1 text-xs text-secondary"
          />
          <input
            type="url"
            value={draft.contact_url ?? ''}
            onChange={(e) => setDraft({ ...draft, contact_url: e.target.value || null })}
            placeholder="URL (LinkedIn, etc.)"
            className="w-full bg-elevated border border-border rounded px-2 py-1 text-xs text-secondary"
          />
        </div>
      ) : engagement.contact_name && (
        <div className="text-xs text-secondary mb-2 flex items-center gap-2">
          {engagement.contact_url ? (
            <a href={engagement.contact_url} target="_blank" rel="noopener noreferrer"
              className="text-accent hover:text-accent-bright underline underline-offset-2 decoration-accent/30">
              {engagement.contact_name}
            </a>
          ) : (
            <span>{engagement.contact_name}</span>
          )}
          {engagement.contact_url && <ExternalLink size={10} className="text-tertiary" />}
          {engagement.contact_email && (
            <a href={`mailto:${engagement.contact_email}`} className="text-tertiary hover:text-accent">
              · {engagement.contact_email}
            </a>
          )}
        </div>
      )}

      {/* Value + probability — only render if editing or value>0 (avoid €0 noise) */}
      {showFinancials && (
        <div className="flex items-center gap-3 text-[11px] font-mono mb-3">
          {editing ? (
            <>
              <input
                type="number"
                value={draft.value_eur ?? ''}
                onChange={(e) => setDraft({ ...draft, value_eur: Number(e.target.value) || null })}
                placeholder="EUR"
                className="w-20 bg-elevated border border-border rounded px-2 py-0.5 text-money"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={draft.probability ?? 0}
                onChange={(e) => setDraft({ ...draft, probability: Number(e.target.value) || 0 })}
                className="w-14 bg-elevated border border-border rounded px-2 py-0.5 text-secondary"
              />
              <span className="text-tertiary">%</span>
            </>
          ) : (
            <>
              <span className="text-money">€{value.toLocaleString()}</span>
              <span className="text-tertiary">·</span>
              <span className="text-secondary">{prob}%</span>
              <span className="text-tertiary">·</span>
              <span className="text-money/70">€{weighted.toLocaleString()} weighted</span>
            </>
          )}
        </div>
      )}

      {/* Next step */}
      {editing ? (
        <div className="space-y-1.5 mb-3">
          <input
            value={draft.next_step ?? ''}
            onChange={(e) => setDraft({ ...draft, next_step: e.target.value || null })}
            placeholder="Next step"
            className="w-full bg-elevated border border-border rounded px-2 py-1 text-xs text-primary"
          />
          <input
            type="date"
            value={draft.next_step_at ?? ''}
            onChange={(e) => setDraft({ ...draft, next_step_at: e.target.value || null })}
            className="w-full bg-elevated border border-border rounded px-2 py-1 text-xs text-secondary"
          />
        </div>
      ) : engagement.next_step && (
        <div className="bg-elevated/40 border border-border/40 rounded px-2 py-1.5 mb-3">
          <div className="text-[10px] uppercase tracking-wider text-tertiary font-mono mb-0.5">Next</div>
          <div className="text-xs text-primary">{engagement.next_step}</div>
          {engagement.next_step_at && (
            <div className="text-[10px] text-tertiary font-mono mt-0.5">
              by {format(new Date(engagement.next_step_at), 'MMM d')}
            </div>
          )}
        </div>
      )}

      {/* Stage advancer */}
      <div className="flex items-center gap-1 flex-wrap">
        {STAGE_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => advanceStage(s)}
            disabled={busy}
            className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-mono rounded border transition-colors ${
              engagement.stage === s
                ? 'bg-accent/15 text-accent border-accent/40'
                : 'text-tertiary border-border hover:text-secondary hover:border-border-strong'
            } disabled:opacity-50`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
