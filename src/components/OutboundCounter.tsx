'use client';

import { useEffect, useState } from 'react';
import { Send, Plus, Check, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type { OutboundLog } from '@/types/triage';

const DAILY_QUOTA = 5;

/** Daily outbound prospecting counter. Click + to log a touch; expand to see today's contacts. */
export default function OutboundCounter() {
  const [todayLogs, setTodayLogs] = useState<OutboundLog[]>([]);
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('linkedin');
  const [context, setContext] = useState('');
  const [busy, setBusy] = useState(false);

  const today = todayLogs.length;

  const reload = async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('outbound_log')
      .select('*')
      .eq('log_date', todayStr)
      .order('created_at', { ascending: false });
    setTodayLogs((data ?? []) as OutboundLog[]);
  };

  useEffect(() => {
    reload();
    const ch = supabase
      .channel('outbound_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outbound_log' }, reload)
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, []);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await fetch('/api/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: name.trim(),
          channel,
          context: context.trim() || null,
        }),
      });
      setName('');
      setContext('');
      setAdding(false);
      reload();
    } finally {
      setBusy(false);
    }
  };

  const pct = Math.min(100, Math.round((today / DAILY_QUOTA) * 100));
  const tone =
    today >= DAILY_QUOTA
      ? { text: 'text-success', bg: 'bg-success' }
      : today >= 3
        ? { text: 'text-warning', bg: 'bg-warning' }
        : { text: 'text-danger', bg: 'bg-danger' };

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Send size={14} className={tone.text} />
          <h3 className="text-sm font-semibold text-primary">Outbound today</h3>
          {today >= DAILY_QUOTA && <Check size={14} className="text-success" />}
        </div>
        <span className={`text-sm font-mono font-semibold ${tone.text}`}>
          {today} / {DAILY_QUOTA}
        </span>
      </div>

      <div className="h-1.5 bg-elevated rounded-full overflow-hidden mb-3">
        <div className={`h-full ${tone.bg} animate-fill`} style={{ width: `${pct}%` }} />
      </div>

      {adding ? (
        <div className="space-y-2 animate-fade-in">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contact name"
            className="w-full bg-elevated border border-border rounded px-2 py-1 text-xs text-primary focus:outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="bg-elevated border border-border rounded px-2 py-1 text-xs text-secondary"
            >
              <option value="linkedin">LinkedIn</option>
              <option value="email">Email</option>
              <option value="referral">Referral</option>
              <option value="event">Event</option>
              <option value="other">Other</option>
            </select>
            <input
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Why (optional)"
              className="flex-1 bg-elevated border border-border rounded px-2 py-1 text-xs text-secondary"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={busy || !name.trim()}
              className="flex-1 px-3 py-1.5 bg-accent text-base text-xs font-semibold rounded hover:bg-accent-bright disabled:opacity-50"
            >
              Log
            </button>
            <button
              onClick={() => { setAdding(false); setName(''); setContext(''); }}
              className="px-3 py-1.5 text-xs text-tertiary hover:text-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-secondary border border-dashed border-border rounded hover:border-accent hover:text-accent transition-colors"
        >
          <Plus size={12} />
          Log a prospect touch
        </button>
      )}

      {/* Today's log — expandable so the user can see who's already been touched */}
      {todayLogs.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/40">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="w-full flex items-center justify-between text-[10px] uppercase tracking-wider font-mono text-tertiary hover:text-secondary"
          >
            <span>Today · {todayLogs.length} contact{todayLogs.length === 1 ? '' : 's'}</span>
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
          {expanded && (
            <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {todayLogs.map((l) => (
                <li key={l.id} className="text-[11px] flex items-baseline justify-between gap-2 hover:bg-elevated/30 px-1 py-0.5 rounded">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {l.contact_url ? (
                      <a href={l.contact_url} target="_blank" rel="noopener noreferrer"
                        className="text-accent hover:text-accent-bright truncate inline-flex items-center gap-1">
                        {l.contact_name || 'Unnamed'}
                        <ExternalLink size={9} />
                      </a>
                    ) : (
                      <span className="text-secondary truncate">{l.contact_name || 'Unnamed'}</span>
                    )}
                    {l.context && <span className="text-tertiary truncate">— {l.context}</span>}
                  </div>
                  <span className="text-tertiary font-mono whitespace-nowrap">
                    {l.channel} · {format(new Date(l.created_at), 'HH:mm')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
