'use client';

/**
 * EventsPanel — right rail on NowSurface showing AI events with attendance hints.
 *
 * Reads triage_items where category='event' (Perplexity Switzerland/EU + DM-detected).
 * Free events get an "Auto-register" button (Browser Use Cloud, future); paid get
 * a manual "Register" link.
 *
 * Compact card style — designed for the right column of NowSurface, ~360px wide.
 */

import { useEffect, useMemo, useState } from 'react';
import { Calendar, MapPin, ExternalLink, Sparkles, Globe2 } from 'lucide-react';
import { format, isAfter } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type { TriageItem } from '@/types/triage';

export default function EventsPanel() {
  const [events, setEvents] = useState<TriageItem[]>([]);

  const reload = async () => {
    const { data } = await supabase
      .from('triage_items')
      .select('*')
      .eq('category', 'event')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('event_time', { ascending: true, nullsFirst: false })
      .limit(30);
    setEvents((data ?? []) as TriageItem[]);
  };

  useEffect(() => {
    reload();
    const ch = supabase.channel('events_panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'triage_items', filter: 'category=eq.event' }, reload)
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, []);

  const upcoming = useMemo(() => {
    const now = new Date();
    return events
      .filter((e) => !e.event_time || isAfter(new Date(e.event_time), now))
      .slice(0, 8);
  }, [events]);

  return (
    <div className="rounded-xl border border-success/20 bg-success/[0.03] p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-success flex items-center gap-2">
          <Calendar size={14} /> AI Events
        </h3>
        <span className="text-[10px] font-mono text-tertiary">{upcoming.length} upcoming</span>
      </div>

      {upcoming.length === 0 ? (
        <p className="text-xs text-tertiary leading-snug">
          No events queued. Perplexity discovers Swiss + EU AI events daily; DM-detected invites also land here.
        </p>
      ) : (
        <ul className="space-y-2">
          {upcoming.map((event) => <EventCard key={event.id} event={event} />)}
        </ul>
      )}
    </div>
  );
}

function EventCard({ event }: { event: TriageItem }) {
  const eventDate = event.event_time ? new Date(event.event_time) : null;
  const isFree = !/(\$|€|£|paid|premium|fee)/i.test(`${event.subtitle ?? ''} ${event.title}`);
  const url = event.event_url ?? event.source_url ?? null;

  const flag = (loc: string | null | undefined): string => {
    if (!loc) return '';
    const t = loc.toLowerCase();
    if (t.includes('zurich') || t.includes('switzer') || t.includes('basel') || t.includes('geneva') || t.includes('lausanne')) return '🇨🇭';
    if (t.includes('lisbon') || t.includes('portug')) return '🇵🇹';
    if (t.includes('berlin') || t.includes('germ') || t.includes('munich')) return '🇩🇪';
    if (t.includes('london') || t.includes('uk')) return '🇬🇧';
    if (t.includes('amsterdam') || t.includes('netherl')) return '🇳🇱';
    if (t.includes('paris') || t.includes('france')) return '🇫🇷';
    if (t.includes('malta')) return '🇲🇹';
    if (t.includes('online') || t.includes('virtual') || t.includes('remote')) return '🌐';
    return '🌍';
  };

  return (
    <li className="rounded-md border border-border/40 bg-surface px-3 py-2.5 hover:border-success/30 transition-colors">
      <div className="flex items-start gap-2">
        <div className="text-base shrink-0">{flag(event.event_location)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-tertiary uppercase tracking-wider">
            {eventDate && (
              <span className="text-success font-semibold">
                {format(eventDate, 'MMM d')}
              </span>
            )}
            {event.event_location && (
              <>
                <span className="opacity-30">·</span>
                <span className="inline-flex items-center gap-0.5"><MapPin size={9} /> {event.event_location}</span>
              </>
            )}
            <span className="opacity-30">·</span>
            <span className={isFree ? 'text-success' : 'text-money'}>{isFree ? 'free' : 'paid'}</span>
          </div>
          <h4 className="text-xs font-medium text-primary mt-0.5 leading-snug line-clamp-2" title={event.title}>{event.title}</h4>
          {event.subtitle && (
            <p className="text-[10px] text-secondary line-clamp-2 mt-1">{event.subtitle}</p>
          )}
          {url && (
            <div className="mt-2 flex items-center gap-2">
              <a href={url} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-success bg-success/10 hover:bg-success/20 rounded-md transition-colors">
                {isFree ? 'Register' : 'View'} <ExternalLink size={9} />
              </a>
              {isFree && (
                <span className="text-[9px] text-tertiary italic" title="Auto-register via Browser Use Cloud (coming soon)">
                  · auto-register pending wire-up
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
