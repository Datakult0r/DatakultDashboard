'use client';

/**
 * CardMeta — uniform provenance + action + people strip for every card surface.
 *
 * Renders three optional rows:
 *   • Method: HOW we got this row (Apify / Beeper / Perplexity / …)
 *   • Action: WHAT we propose to do (Easy Apply / Reply DM / Apply on website / …)
 *   • Who:    Company + person, with safe hyperlinks (LinkedIn / mailto only).
 *
 * Designed to be dropped into NowSurface FollowUpRow, JobsTracker JobRow,
 * EngagementCard, TriageCard, NewsCard with consistent layout + tooltips.
 */

import {
  Globe2, Mail, MessageSquare, Briefcase, Newspaper, Calendar, Cpu, Link as LinkIcon,
  Building2, ExternalLink, Send, Zap,
} from 'lucide-react';
import { methodFor, actionFor, safeContactUrl, linkedInHandle } from '@/lib/provenance';
import { clearbitLogoUrl, locationFlag } from '@/lib/company-logo';

const METHOD_ICONS = {
  globe: Globe2,
  mail: Mail,
  message: MessageSquare,
  briefcase: Briefcase,
  newspaper: Newspaper,
  calendar: Calendar,
  cpu: Cpu,
  link: LinkIcon,
} as const;

const TONE_CLS: Record<string, string> = {
  info:     'bg-info/10 text-info border-info/20',
  accent:   'bg-accent/10 text-accent border-accent/20',
  success:  'bg-success/10 text-success border-success/20',
  money:    'bg-money/10 text-money border-money/20',
  warning:  'bg-warning/10 text-warning border-warning/20',
  tertiary: 'bg-elevated/60 text-tertiary border-border/40',
};

interface CardMetaProps {
  /** raw `source` value (linkedin / gmail / linkedin_dm / system / …) */
  source: string | null | undefined;
  /** raw category (job / news / event / review / …) */
  category?: string | null;
  /** raw `action_type` (apply_job_easy / send_message / …) */
  actionType?: string | null;
  /** for jobs: 'easy_apply' | 'website' */
  applyType?: string | null;
  /** Company name (for company chip + logo) */
  company?: string | null;
  /** Person name (for hyperlinked person chip) */
  contactName?: string | null;
  /** Person URL (LinkedIn profile usually) */
  contactUrl?: string | null;
  /** Person email (mailto:) */
  contactEmail?: string | null;
  /** Job/event location for country flag */
  location?: string | null;
  /** Posted text / when */
  postedText?: string | null;
  /** Compact mode (single-row, smaller chips) */
  compact?: boolean;
}

/** Provenance + action + who strip — drop on every card. */
export default function CardMeta({
  source, category, actionType, applyType,
  company, contactName, contactUrl, contactEmail, location, postedText, compact,
}: CardMetaProps) {
  const m = methodFor(source ?? null, category ?? null);
  const MIcon = METHOD_ICONS[m.icon] ?? LinkIcon;
  const a = actionFor(actionType ?? null, category ?? null, applyType ?? null);
  const flag = locationFlag(location);
  const safeContactHref = safeContactUrl(contactUrl);
  const handle = linkedInHandle(contactUrl);
  const companyDomain = clearbitLogoUrl(company ?? '') ? `https://${(company ?? '').toLowerCase().replace(/\s*\(.*?\)\s*/g,'').replace(/[^a-z0-9]+/g,'')}.com` : null;

  const ActionIcon = a?.short.includes('Easy Apply') ? Zap : a?.short.includes('Reply') || a?.short.includes('Send') ? Send : Briefcase;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
        <span title={m.hint} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border ${TONE_CLS[m.tone]}`}>
          <MIcon size={9} /> {m.short}
        </span>
        {a && (
          <span title={a.hint} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border ${TONE_CLS[a.tone]}`}>
            <ActionIcon size={9} /> {a.short}
          </span>
        )}
        {flag && <span aria-hidden className="text-xs leading-none">{flag}</span>}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Row 1 — provenance + action chips */}
      <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
        <span title={m.hint} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border ${TONE_CLS[m.tone]}`}>
          <MIcon size={10} /> via {m.short}
        </span>
        {a && (
          <span title={a.hint} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border ${TONE_CLS[a.tone]}`}>
            <ActionIcon size={10} /> {a.short}
          </span>
        )}
        {postedText && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border/40 bg-elevated/40 text-tertiary">
            <Calendar size={10} /> {postedText}
          </span>
        )}
      </div>

      {/* Row 2 — company + person hyperlinks (safe only) + flag */}
      {(company || contactName || flag) && (
        <div className="flex items-center gap-2 text-[11px] flex-wrap">
          {company && (
            <span className="inline-flex items-center gap-1 text-secondary">
              <Building2 size={11} className="text-tertiary" />
              {companyDomain ? (
                <a href={companyDomain} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors" title={`Best-effort company site for ${company}`}>
                  {company} <ExternalLink size={9} className="inline opacity-60" />
                </a>
              ) : (
                <span>{company}</span>
              )}
            </span>
          )}
          {contactName && (
            <span className="inline-flex items-center gap-1 text-secondary">
              <span className="opacity-30">·</span>
              {safeContactHref ? (
                <a href={safeContactHref} target="_blank" rel="noopener noreferrer"
                   className="hover:text-accent transition-colors"
                   title={handle ? `LinkedIn: linkedin.com/in/${handle}` : safeContactHref}>
                  {contactName}{handle ? <span className="text-tertiary/70"> · @{handle}</span> : null} <ExternalLink size={9} className="inline opacity-60" />
                </a>
              ) : (
                <span>{contactName}</span>
              )}
            </span>
          )}
          {contactEmail && (
            <span className="inline-flex items-center gap-1 text-secondary">
              <span className="opacity-30">·</span>
              <a href={`mailto:${contactEmail}`} className="hover:text-accent transition-colors" title={`Compose email to ${contactEmail}`}>
                <Mail size={11} className="inline" />
              </a>
            </span>
          )}
          {flag && (
            <span aria-hidden className="text-base leading-none" title={location ?? ''}>{flag}</span>
          )}
          {location && !flag && (
            <span className="text-tertiary text-[10px] font-mono">{location}</span>
          )}
        </div>
      )}
    </div>
  );
}
