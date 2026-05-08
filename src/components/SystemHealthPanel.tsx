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

interface VendorTest {
  status: 'ok' | 'no_credits' | 'invalid_key' | 'rate_limited' | 'network_error' | 'unknown';
  message?: string;
  keyMasked?: string;
  keyLength?: number;
  httpStatus?: number;
}

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
  const [anthropic, setAnthropic] = useState<VendorTest | null>(null);
  const [browserUse, setBrowserUse] = useState<VendorTest | null>(null);
  const [testingAnthropic, setTestingAnthropic] = useState(false);
  const [testingBrowserUse, setTestingBrowserUse] = useState(false);
  const toast = useToast();

  const testAnthropic = async () => {
    setTestingAnthropic(true);
    try {
      const r = await fetch('/api/anthropic/test', { cache: 'no-store' });
      const data = await r.json();
      setAnthropic(data as VendorTest);
      if (data.status === 'ok') {
        toast.push('success', 'Anthropic API working — credits available');
      } else if (data.status === 'no_credits') {
        toast.push('error', 'Anthropic credits exhausted', {
          label: 'Billing',
          run: () => { window.open('https://console.anthropic.com/settings/billing', '_blank'); },
        });
      } else {
        toast.push('error', `Anthropic test: ${data.status}`);
      }
    } finally {
      setTestingAnthropic(false);
    }
  };

  const testBrowserUse = async () => {
    setTestingBrowserUse(true);
    try {
      const r = await fetch('/api/browser-use/test', { cache: 'no-store' });
      const data = await r.json();
      setBrowserUse(data as VendorTest);
    } finally {
      setTestingBrowserUse(false);
    }
  };

  // Auto-test both on mount so user sees state without clicking
  useEffect(() => {
    testAnthropic();
    testBrowserUse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const result = data.result || {};
      if (result.gmail_needs_reauth) {
        toast.push('error', 'Gmail OAuth needs re-auth — refresh token revoked', {
          label: 'Console',
          run: () => { window.open('https://console.cloud.google.com/apis/credentials?project=gen-lang-client-0970726892', '_blank'); },
        });
      } else if (r.ok && data.ok) {
        const fetched = result.gmail?.fetched ?? 0;
        const inserted = result.gmail?.inserted ?? 0;
        toast.push('success', `Cron complete — ${fetched} emails fetched, ${inserted} inserted`);
      } else {
        toast.push('error', result.errors?.[0] || data.error || 'Cron failed');
      }
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Cron call failed');
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const reload = async () => {
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
    };

    reload();

    // Realtime — auto-refresh when a new system_health row lands (e.g. cron just ran)
    const channel = supabase
      .channel('system_health_panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_health' }, () => {
        reload();
      })
      .subscribe();

    return () => {
      cancelled = true;
      channel.unsubscribe();
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
    <div className="space-y-5">
      {/* Vendor API credentials — gates briefing, scoring, Easy Apply */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <VendorCard
          label="Anthropic API"
          help="Powers briefing + cron scoring + CV tailoring"
          billingUrl="https://console.anthropic.com/settings/billing"
          test={anthropic}
          testing={testingAnthropic}
          onRetest={testAnthropic}
        />
        <VendorCard
          label="Browser Use Cloud"
          help="Powers approved Easy Apply submissions"
          billingUrl="https://cloud.browser-use.com"
          test={browserUse}
          testing={testingBrowserUse}
          onRetest={testBrowserUse}
        />
      </div>

      {/* Header card — overall pipeline health at a glance */}
      <div className="bg-surface border border-border/50 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-primary flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center">
                <Activity size={14} className="text-accent" />
              </div>
              Pipeline Health
            </h3>
            <p className="text-[11px] text-secondary/70 mt-1 font-mono">
              {stats.lastRunAt ? (
                <>
                  Last run {formatDistanceToNow(stats.lastRunAt, { addSuffix: true })} · {format(stats.lastRunAt, 'MMM d HH:mm')}
                </>
              ) : (
                'No cron runs recorded yet.'
              )}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={runCron}
              disabled={running}
              className="glow-btn text-xs px-3 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 border border-accent/25 transition-all disabled:opacity-50 inline-flex items-center gap-1.5 font-medium"
              title="Trigger /api/triage/collect now"
            >
              <Play size={11} className={running ? 'animate-spin' : ''} />
              Run cron
            </button>
            <button
              onClick={runApproved}
              disabled={running}
              className="text-xs px-3 py-1.5 rounded-lg bg-money/8 text-money hover:bg-money/15 border border-money/20 transition-all disabled:opacity-50 inline-flex items-center gap-1.5 font-medium"
            >
              <CheckCircle2 size={11} />
              Run approved
            </button>
            <a
              href="/auth/gmail"
              className="text-xs px-3 py-1.5 rounded-lg bg-warning/8 text-warning hover:bg-warning/15 border border-warning/20 transition-all inline-flex items-center gap-1.5 font-medium"
            >
              Re-auth Gmail
            </a>
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              disabled={loading}
              className="text-xs px-2 py-1.5 rounded-lg bg-elevated/50 text-secondary hover:text-primary transition-all disabled:opacity-50 inline-flex items-center gap-1"
              aria-label="Refresh health"
            >
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2">
          <HealthStat label="OK" count={stats.counts.ok} icon={<CheckCircle2 size={13} />} color="success" />
          <HealthStat label="Error" count={stats.counts.error} icon={<XCircle size={13} />} color="danger" />
          <HealthStat label="Skipped" count={stats.counts.skipped} icon={<PauseCircle size={13} />} color="secondary" />
          <HealthStat label="Fallback" count={stats.counts.fallback} icon={<AlertTriangle size={13} />} color="warning" />
          <HealthStat label="Timeout" count={stats.counts.timeout} icon={<Clock size={13} />} color="warning" />
        </div>
      </div>

      {/* Per-source rows */}
      {loading && rows.length === 0 ? (
        <div className="text-secondary text-xs py-8 text-center font-mono">Loading system health…</div>
      ) : rows.length === 0 ? (
        <div className="bg-surface border border-border/50 rounded-xl p-8 text-center">
          <Activity size={28} className="mx-auto text-tertiary/30 mb-3" />
          <p className="text-sm text-secondary">No health data in the last 7 days.</p>
          <p className="text-[11px] text-tertiary mt-1">
            The cron may not have run yet, or the system_health table is empty.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {grouped.map(([source, sourceRows]) => {
            const hasError = sourceRows.some((r) => r.status === 'error');
            return (
              <div key={source} className={`bg-surface border rounded-xl overflow-hidden ${hasError ? 'border-danger/25' : 'border-border/50'}`}>
                <div className={`px-4 py-2.5 border-b flex items-center justify-between ${hasError ? 'bg-danger/5 border-danger/15' : 'bg-elevated/30 border-border/30'}`}>
                  <span className="text-xs font-mono uppercase tracking-wider text-secondary font-semibold">{source}</span>
                  <span className="text-[10px] text-tertiary/60 font-mono">
                    {sourceRows.length} op{sourceRows.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="divide-y divide-border/20">
                  {sourceRows.map((r) => (
                    <HealthRow key={`${r.source}-${r.operation}-${r.cron_run_id}`} row={r} />
                  ))}
                </div>
              </div>
            );
          })}
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
    success: 'text-success bg-success/6 border-success/15',
    danger: 'text-danger bg-danger/6 border-danger/15',
    warning: 'text-warning bg-warning/6 border-warning/15',
    secondary: 'text-secondary bg-elevated/40 border-border/30',
  } as const;
  return (
    <div className={`rounded-xl px-3 py-2.5 border ${colorMap[color]} stat-glow transition-all`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="opacity-70">{icon}</span>
        <span className="text-[10px] uppercase tracking-[0.1em] font-semibold">{label}</span>
      </div>
      <p className="text-xl font-mono font-bold count-animate">{count}</p>
    </div>
  );
}

interface VendorCardProps {
  label: string;
  help: string;
  billingUrl: string;
  test: VendorTest | null;
  testing: boolean;
  onRetest: () => void;
}

/** Vendor API credential status card — used for Anthropic + Browser Use. */
function VendorCard({ label, help, billingUrl, test, testing, onRetest }: VendorCardProps) {
  const status = test?.status ?? 'unknown';
  const tone =
    status === 'ok'
      ? { border: 'border-success/30', text: 'text-success', dot: 'bg-success' }
      : status === 'no_credits'
        ? { border: 'border-danger/40', text: 'text-danger', dot: 'bg-danger' }
        : status === 'invalid_key'
          ? { border: 'border-warning/40', text: 'text-warning', dot: 'bg-warning' }
          : { border: 'border-border', text: 'text-tertiary', dot: 'bg-tertiary' };

  return (
    <div className={`surface-card bg-surface border rounded-xl p-4 ${tone.border} transition-all`}>
      <div className="flex items-start gap-3">
        <div className={`w-3 h-3 rounded-full mt-1 ${tone.dot} flex-shrink-0 ${status === 'ok' ? '' : status === 'no_credits' || status === 'invalid_key' ? 'status-dot-error' : ''}`} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-primary flex items-center gap-2">
            {label}
            <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-md ${tone.text} ${
              status === 'ok' ? 'bg-success/8' : status === 'no_credits' ? 'bg-danger/8' : status === 'invalid_key' ? 'bg-warning/8' : 'bg-elevated/60'
            }`}>
              {status}
            </span>
          </div>
          <div className="text-[11px] text-tertiary mt-1">{help}</div>
          {test && (
            <div className="text-[11px] text-tertiary/70 font-mono mt-1 truncate">
              {test.keyMasked ? `key ${test.keyMasked} (${test.keyLength} chars)` : 'no key info'}
              {test.httpStatus ? ` · HTTP ${test.httpStatus}` : ''}
            </div>
          )}
          {(status === 'no_credits' || status === 'invalid_key') && (
            <a href={billingUrl} target="_blank" rel="noopener noreferrer"
              className={`inline-block mt-1.5 text-[11px] font-medium underline underline-offset-2 decoration-current/30 hover:no-underline ${tone.text}`}>
              Open billing →
            </a>
          )}
        </div>
        <button
          onClick={onRetest}
          disabled={testing}
          className="text-xs px-2.5 py-1.5 rounded-lg bg-elevated/60 border border-border/40 text-secondary hover:text-primary hover:bg-elevated disabled:opacity-50 inline-flex items-center gap-1.5 flex-shrink-0 transition-all"
        >
          <RefreshCw size={11} className={testing ? 'animate-spin' : ''} />
          Re-test
        </button>
      </div>
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
    <div className="px-4 py-3 flex items-start gap-3 hover:bg-elevated/30 transition-all group">
      <div className="mt-1.5 flex-shrink-0">
        <span className={`block w-2.5 h-2.5 rounded-full ${style.dot} ${row.status === 'error' ? 'status-dot-error' : ''}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-primary">{row.operation}</span>
          <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-md ${style.text} ${
            row.status === 'ok' ? 'bg-success/8' : row.status === 'error' ? 'bg-danger/8' : row.status === 'fallback' || row.status === 'timeout' ? 'bg-warning/8' : 'bg-elevated/60'
          }`}>
            {row.status}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-secondary/70 mt-1 font-mono">
          <span className="bg-elevated/40 px-1.5 py-0.5 rounded">{row.items_count} items</span>
          <span className="text-tertiary/40">·</span>
          <span className="bg-elevated/40 px-1.5 py-0.5 rounded">{row.duration_ms}ms</span>
          <span className="text-tertiary/40">·</span>
          <span>{formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}</span>
        </div>
        {row.error_message && (
          <div className="mt-2 bg-danger/5 border border-danger/15 rounded-lg px-3 py-2">
            <p className="text-[11px] text-danger/90 break-words font-mono leading-relaxed">
              {row.error_message.slice(0, 220)}
              {row.error_message.length > 220 && '…'}
            </p>
          </div>
        )}
        {row.fallback_used && (
          <div className="mt-2 bg-warning/5 border border-warning/15 rounded-lg px-3 py-2">
            <p className="text-[11px] text-warning/90">
              Fallback used: <span className="font-mono">{row.fallback_used}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
