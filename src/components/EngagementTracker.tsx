'use client';

import { useEffect, useState, useMemo } from 'react';
import { Plus, Target } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { CustomerEngagement, EngagementStage, PipelineHealthRow } from '@/types/triage';
import EngagementCard from './EngagementCard';

const ACTIVE_STAGES: EngagementStage[] = ['lead', 'discovery', 'proposal'];
const TERMINAL_STAGES: EngagementStage[] = ['won', 'lost', 'paused'];
const STAGE_LABELS: Record<EngagementStage, string> = {
  lead: 'Lead',
  discovery: 'Discovery',
  proposal: 'Proposal',
  won: 'Won',
  lost: 'Lost',
  paused: 'Paused',
};

/** Customer pipeline tracker — kanban-style by stage. */
export default function EngagementTracker() {
  const [engagements, setEngagements] = useState<CustomerEngagement[]>([]);
  const [health, setHealth] = useState<PipelineHealthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newCompany, setNewCompany] = useState('');
  const [showTerminal, setShowTerminal] = useState(false);

  const reload = async () => {
    setLoading(true);
    const [{ data: eng }, { data: h }] = await Promise.all([
      supabase.from('customer_engagements').select('*').order('updated_at', { ascending: false }),
      supabase.from('pipeline_health').select('*'),
    ]);
    setEngagements((eng ?? []) as CustomerEngagement[]);
    setHealth((h ?? []) as PipelineHealthRow[]);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    const channel = supabase
      .channel('engagement_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_engagements' }, reload)
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, []);

  const handleAdd = async () => {
    if (!newCompany.trim()) return;
    const r = await fetch('/api/engagements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: newCompany.trim() }),
    });
    if (r.ok) {
      setNewCompany('');
      setAdding(false);
      reload();
    }
  };

  const handleUpdate = async (id: string, patch: Partial<CustomerEngagement>) => {
    const r = await fetch(`/api/engagements/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (r.ok) reload();
  };

  const handleDelete = async (id: string) => {
    const r = await fetch(`/api/engagements/${id}`, { method: 'DELETE' });
    if (r.ok) reload();
  };

  const byStage = useMemo(() => {
    const map: Record<EngagementStage, CustomerEngagement[]> = {
      lead: [], discovery: [], proposal: [], won: [], lost: [], paused: [],
    };
    for (const e of engagements) map[e.stage].push(e);
    return map;
  }, [engagements]);

  const totalActiveValue = health
    .filter((h) => ACTIVE_STAGES.includes(h.stage))
    .reduce((acc, h) => acc + h.weighted_value_eur, 0);

  const stagesToShow = showTerminal ? [...ACTIVE_STAGES, ...TERMINAL_STAGES] : ACTIVE_STAGES;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target size={16} className="text-accent" />
          <h3 className="text-sm font-semibold text-primary">Customer Pipeline</h3>
          {totalActiveValue > 0 && (
            <span className="text-[11px] font-mono text-money">
              €{totalActiveValue.toLocaleString()} weighted
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTerminal((s) => !s)}
            className="text-[11px] font-mono text-tertiary hover:text-secondary"
          >
            {showTerminal ? 'Active only' : 'Show won/lost'}
          </button>
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-accent/15 text-accent rounded hover:bg-accent/25 transition-colors"
            >
              <Plus size={12} />
              Add
            </button>
          )}
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <div className="bg-surface border border-accent/30 rounded-lg p-3 flex items-center gap-2 animate-fade-in">
          <input
            autoFocus
            value={newCompany}
            onChange={(e) => setNewCompany(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Company name"
            className="flex-1 bg-elevated border border-border rounded px-2 py-1 text-sm text-primary focus:outline-none focus:border-accent"
          />
          <button onClick={handleAdd}
            className="px-3 py-1 bg-accent text-base text-sm font-semibold rounded hover:bg-accent-bright">
            Create
          </button>
          <button onClick={() => { setAdding(false); setNewCompany(''); }}
            className="px-3 py-1 text-sm text-tertiary hover:text-secondary">
            Cancel
          </button>
        </div>
      )}

      {/* Loading / empty state */}
      {loading && engagements.length === 0 && (
        <div className="text-center py-12 text-secondary text-sm">Loading pipeline…</div>
      )}
      {!loading && engagements.length === 0 && (
        <div className="text-center py-12 bg-surface border border-border border-dashed rounded-lg">
          <Target size={32} className="mx-auto text-tertiary mb-2" />
          <p className="text-sm text-secondary">No customer engagements yet.</p>
          <p className="text-xs text-tertiary mt-1">
            Start with one — every closed deal tells you what to build next.
          </p>
        </div>
      )}

      {/* Kanban columns */}
      {engagements.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3" style={{ gridTemplateColumns: showTerminal ? 'repeat(auto-fit, minmax(260px, 1fr))' : 'repeat(3, 1fr)' }}>
          {stagesToShow.map((stage) => {
            const items = byStage[stage];
            const stageHealth = health.find((h) => h.stage === stage);
            return (
              <div key={stage} className="bg-elevated/30 border border-border rounded-lg p-3">
                <div className="flex items-baseline justify-between mb-3">
                  <h4 className="text-[11px] uppercase tracking-[0.15em] font-mono text-secondary">
                    {STAGE_LABELS[stage]}
                  </h4>
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="text-tertiary">{items.length}</span>
                    {stageHealth && stageHealth.weighted_value_eur > 0 && (
                      <span className="text-money">€{stageHealth.weighted_value_eur.toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {items.length === 0 ? (
                    <div className="text-[11px] text-tertiary italic py-4 text-center">empty</div>
                  ) : (
                    items.map((e) => (
                      <EngagementCard
                        key={e.id}
                        engagement={e}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
