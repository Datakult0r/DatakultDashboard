'use client';

import { useEffect, useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface BriefingResponse {
  briefing: string;
  generatedAt: string;
  cached?: boolean;
  signals: {
    triage_yesterday: number;
    approved_yesterday: number;
    outbound_yesterday: number;
    engagements_active: number;
    engagements_overdue: number;
    sla_breaches: number;
  };
  error?: string;
}

/** Top-of-NOW chief-of-staff briefing. Calls /api/briefing (Claude haiku, cached 30m). */
export default function MorningBriefing() {
  const [data, setData] = useState<BriefingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (force = false) => {
    if (force) setRefreshing(true); else setLoading(true);
    try {
      const r = await fetch('/api/briefing', force ? { cache: 'no-store' } : {});
      const json = await r.json();
      setData(json);
    } catch {
      setData({ briefing: '', generatedAt: '', signals: { triage_yesterday: 0, approved_yesterday: 0, outbound_yesterday: 0, engagements_active: 0, engagements_overdue: 0, sla_breaches: 0 }, error: 'Failed to load briefing' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading && !data) {
    return (
      <div className="bg-surface border border-border rounded-lg p-4 flex items-center gap-3 text-sm text-tertiary">
        <Sparkles size={14} className="text-accent animate-pulse" />
        <span>Generating today&apos;s briefing…</span>
      </div>
    );
  }

  // Surface error states explicitly — silent failure was making AI outages invisible
  if (data?.error) {
    const isCredits = data.error.toLowerCase().includes('credit balance');
    return (
      <div className={`rounded-lg p-3 border ${isCredits ? 'bg-danger/10 border-danger/30' : 'bg-warning/10 border-warning/30'}`}>
        <div className="flex items-start gap-2">
          <Sparkles size={14} className={`mt-0.5 ${isCredits ? 'text-danger' : 'text-warning'}`} />
          <div className="flex-1">
            <p className={`text-xs font-semibold ${isCredits ? 'text-danger' : 'text-warning'}`}>
              {isCredits ? 'Anthropic API credits exhausted' : 'Briefing unavailable'}
            </p>
            <p className="text-[11px] text-secondary mt-0.5">
              {isCredits
                ? 'Add credits at console.anthropic.com — until then, briefing, triage scoring and CV tailoring will all fail.'
                : 'Briefing failed to generate. Check the Health tab for details.'}
            </p>
            {isCredits && (
              <a
                href="https://console.anthropic.com/settings/billing"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-1.5 text-[11px] text-danger underline underline-offset-2 hover:no-underline"
              >
                Open billing →
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }
  if (!data || !data.briefing) return null;

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-accent" />
          <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-secondary">
            Chief of staff briefing
          </span>
          {data.generatedAt && (
            <span className="text-[10px] font-mono text-tertiary">
              · {formatDistanceToNow(new Date(data.generatedAt), { addSuffix: true })}
              {data.cached && ' (cached)'}
            </span>
          )}
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="text-tertiary hover:text-accent disabled:opacity-50"
          aria-label="Regenerate briefing"
          title="Regenerate"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>
      <p className="text-sm text-primary leading-relaxed">{data.briefing}</p>
    </div>
  );
}
