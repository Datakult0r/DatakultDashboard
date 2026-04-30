'use client';

import { useEffect, useState, useMemo } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PauseCircle,
  Clock,
  RefreshCw,
  Play,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { SystemHealthRow } from '@/types/triage';
import { useToast } from './Toast';

/**
 * SystemHealthPanel — Operational visibility into the triage automation pipeline.
 * Pulls the latest row per source/operation pair from system_health_summary view.
 *
 * Why this exists: the cron has been silently failing for days (Gmail OAuth revoked,
 * env vars missing) without any user-facing surface. Philippe now sees green/red
 * status for every integration on the dashboard itself.
 */
export default function SystemHealthPanel() {
  const [rows, setRows] = useState<SystemHealthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [running, setRunning] = useState(false);
  const toast = useToast();

  const runApproved = async () => {
    if (!confirm('Mark all approved items as executed (clears the SLA queue)?')) return;
    setRunning(true);
    try {
      const r = await fetch('/api/actions/run-approved', { method: 'POST' });
      const data = await r.json();
      if (r.ok) {
        toast.push('success', `Executed ${data.executed} item${data.executed === 1 ? '' : 's'}`);
      } else {
        toast.push('error', data.error || 'Failed to run');
      }
    } finally {
      setRunning(false);
    }
  };

  const runCron = async () => {
    if (!confirm('Trigger a fresh triage run now? This will fetch Gmail, score, and write to the dashboard.')) return;
    setRunning(true);
    toast.push('info', 'Cron triggered — this can take up to 5 minutes…');
    try {
      const r = await fetch('/api/triage/run', { method: 'POST' });
      const data = await r.json();
      if (r.ok && data.ok) {
        toast.push('success', `Cron complete — ${data.result?.gmail?.fetched ?? 0} emails fetched`);
        setRefreshKey((k) => k + 1);
      } else {
        toast.push('error', data.result?.errors?.[0] || data.error || 'Cron failed');
      }
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Cron call failed');
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from('system_health_summary')
        .select('*')
        .eq('recency_rank', 1)
        .order('source')
        .order('operation');

      if (cancelled) return;
      if (error) {
        console.error('Failed to load system_health_summary', error);
        setRows([]);
      } else {
        setRows((data || []) as SystemHealthRow[]);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const stats = useMemo(() => {
    const counts = { ok: 0, error: 0, skipped: 0, fallback: 0, timeout: 0 };
    for (const r of rows) {
      if (r.status in counts) counts[r.status as keyof typeof counts] += 1;
    }
    const lastRun = rows
      .map((r) => new Date(r.created_at).getTime())
      .reduce((a, b) => Math.max(a, b), 0);
    return {
      counts,
      total: rows.length,
      lastRunAt: lastRun > 0 ? new Date(lastRun) : null,
    };
  }, [rows]);

  const grouped = useMemo(() => {
    const map = new Map<string, SystemHealthRow[]>();
    for (const r of rows) {
      const list = map.get(r.source) || [];
      list.push(r);
      map.set(r.source, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* Header card — overall pipeline health at a glance */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <Activity size={16} className="text-accent" />
              Pipeline Health
            </h3>
            <p className="text-xs text-secondary/80 mt-0.5">
              {stats.lastRunAt ? (
                <>
                  Last cron run {formatDistanceToNow(stats.lastRunAt, { addSuffix: true })} ·{' '}
                  <span className="font-mono">{format(stats.lastRunAt, 'MMM d HH:mm')}</span>
                </>
              ) : (
                'No cron runs recorded yet.'
              )}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={runCron}
              disabled={running}
              className="text-xs px-2 py-1 rounded bg-accent/10 text-accent hover:bg-accent/20 border border-accent/30 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
              title="Trigger /api/triage/collect now (Gmail + Apify + Firecrawl + Claude)"
            >
              <Play size={12} className={running ? 'animate-spin' : ''} />
              Run cron now
            </button>
            <button
              onClick={runApproved}
              disabled={running}
              className="text-xs px-2 py-1 rounded bg-money/10 text-money hover:bg-money/20 border border-money/30 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
              title="Mark all approved items as executed and clear their SLA timers"
            >
              <CheckCircle2 size={12} />
              Run approved
            </button>
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              disabled={loading}
              className="text-xs px-2 py-1 rounded bg-elevated text-secondary hover:text-primary hover:bg-elevated/80 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
              aria-label="Refresh health"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2">
          <HealthStat label="OK" count={stats.counts.ok} icon={<CheckCircle2 size={14} />} color="success" />
          <HealthStat label="Error" count={stats.counts.error} icon={<XCircle size={14} />} color="danger" />
          <HealthStat label="Skipped" count={stats.counts.skipped} icon={<PauseCircle size={14} />} color="secondary" />
          <HealthStat label="Fallback" count={stats.counts.fallback} icon={<AlertTriangle size={14} />} color="warning" />
          <HealthStat label="Timeout" count={stats.counts.timeout} icon={<Clock size={14} />} color="warning" />
        </div>
      </div>

      {/* Per-source rows */}
      {loading && rows.length === 0 ? (
        <div className="text-secondary text-xs py-4 text-center">Loading system health…</div>
      ) : rows.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-6 text-center">
          <p className="text-sm text-secondary">
            No health data in the last 7 days. The cron may not have run yet, or the
            <code className="mx-1 px-1.5 py-0.5 rounded bg-elevated font-mono text-[10px]">system_health</code>
            table is empty.
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {grouped.map(([source, sourceRows]) => (
            <div key={source} className="bg-surface border border-border rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-elevated/40 border-b border-border/40 flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-secondary">{source}</span>
                <span className="text-[10px] text-secondary/60">
                  {sourceRows.length} operation{sourceRows.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="divide-y divide-border/30">
                {sourceRows.map((r) => (
                  <HealthRow key={`${r.source}-${r.operation}-${r.cron_run_id}`} row={r} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface HealthStatProps {
  label: string;
  count: number;
  icon: React.ReactNode;
  color: 'success' | 'danger' | 'warning' | 'secondary';
}

function HealthStat({ label, count, icon, color }: HealthStatProps) {
  const colorMap = {
    success: 'text-success bg-success/8',
    danger: 'text-danger bg-danger/8',
    warning: 'text-warning bg-warning/8',
    secondary: 'text-secondary bg-elevated/60',
  } as const;
  return (
    <div className={`rounded-md px-2 py-2 ${colorMap[color]}`}>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className="text-lg font-mono font-semibold mt-0.5">{count}</p>
    </div>
  );
}

function HealthRow({ row }: { row: SystemHealthRow }) {
  const statusStyle: Record<string, { dot: string; text: string }> = {
    ok: { dot: 'bg-success', text: 'text-success' },
    error: { dot: 'bg-danger', text: 'text-danger' },
    skipped: { dot: 'bg-secondary', text: 'text-secondary' },
    fallback: { dot: 'bg-warning', text: 'text-warning' },
    timeout: { dot: 'bg-warning', text: 'text-warning' },
  };
  const style = statusStyle[row.status] || statusStyle.skipped;

  return (
    <div className="px-3 py-2 flex items-start gap-3 hover:bg-elevated/20 transition-colors">
      <div className="mt-1.5 flex-shrink-0">
        <span className={`block w-2 h-2 rounded-full ${style.dot}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-primary">{row.operation}</span>
          <span className={`text-xs font-mono uppercase ${style.text}`}>{row.status}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-secondary mt-0.5 font-mono">
          <span>{row.items_count} items</span>
          <span>·</span>
          <span>{row.duration_ms}ms</span>
          <span>·</span>
          <span>{formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}</span>
        </div>
        {row.error_message && (
          <p className="text-[11px] text-danger/90 mt-1 break-words font-mono leading-relaxed">
            {row.error_message.slice(0, 220)}
            {row.error_message.length > 220 && '…'}
          </p>
        )}
        {row.fallback_used && (
          <p className="text-[11px] text-warning/90 mt-1">
            Fallback used: <span className="font-mono">{row.fallback_used}</span>
          </p>
        )}
      </div>
    </div>
  );
}
