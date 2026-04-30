'use client';

import { useState } from 'react';
import {
  Building2,
  MapPin,
  DollarSign,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  User,
  Mail,
  CalendarClock,
  FileText,
  Zap,
  Globe,
  UserPlus,
  Megaphone,
  Wrench,
} from 'lucide-react';
import type { JobApplication, ApplicationStatus } from '@/types/triage';
import ScoreChip from './ScoreChip';

/** Status color and label mapping */
const STATUS_CONFIG: Record<ApplicationStatus, { label: string; bg: string; text: string }> = {
  applied: { label: 'Applied', bg: 'bg-accent/15', text: 'text-accent' },
  screening: { label: 'Screening', bg: 'bg-info/15', text: 'text-info' },
  interview: { label: 'Interview', bg: 'bg-warning/15', text: 'text-warning' },
  offer: { label: 'Offer', bg: 'bg-success/15', text: 'text-success' },
  rejected: { label: 'Rejected', bg: 'bg-danger/15', text: 'text-danger' },
  ghosted: { label: 'Ghosted', bg: 'bg-secondary/10', text: 'text-secondary' },
  withdrawn: { label: 'Withdrawn', bg: 'bg-secondary/10', text: 'text-secondary' },
};

/** Method icons */
const METHOD_ICON: Record<string, React.ReactNode> = {
  easy_apply: <Zap size={12} />,
  website: <Globe size={12} />,
  referral: <UserPlus size={12} />,
  recruiter: <Megaphone size={12} />,
  manual: <Wrench size={12} />,
};

const METHOD_LABEL: Record<string, string> = {
  easy_apply: 'Easy Apply',
  website: 'Website',
  referral: 'Referral',
  recruiter: 'Recruiter',
  manual: 'Manual',
};

interface ApplicationRowProps {
  /** The job application data */
  application: JobApplication;
  /** Callback when status changes */
  onStatusChange: (id: string, status: ApplicationStatus) => void;
}

/** Pipeline stages in order for the progress indicator */
const PIPELINE_STAGES: ApplicationStatus[] = ['applied', 'screening', 'interview', 'offer'];

/**
 * Individual job application row with expandable details
 */
export default function ApplicationRow({ application, onStatusChange }: ApplicationRowProps) {
  const [expanded, setExpanded] = useState(false);
  const statusConfig = STATUS_CONFIG[application.status];
  const isTerminal = ['rejected', 'ghosted', 'withdrawn'].includes(application.status);

  // Calculate days since applied
  const daysSinceApplied = Math.floor(
    (Date.now() - new Date(application.applied_date).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Calculate days since last activity
  const daysSinceActivity = application.last_activity_date
    ? Math.floor(
        (Date.now() - new Date(application.last_activity_date).getTime()) / (1000 * 60 * 60 * 24)
      )
    : daysSinceApplied;

  // Stale flag: 5+ days no activity and not terminal
  const isStale = daysSinceActivity >= 5 && !isTerminal;

  // Pipeline progress index
  const pipelineIndex = PIPELINE_STAGES.indexOf(application.status);

  return (
    <div
      className={`
        rounded-lg border transition-all
        ${isStale ? 'border-warning/30 bg-warning/5' : 'border-border/60 bg-surface'}
        ${isTerminal ? 'opacity-60' : ''}
      `}
    >
      {/* Main row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 flex items-center gap-3"
      >
        {/* Pipeline progress dots */}
        <div className="hidden sm:flex items-center gap-1">
          {PIPELINE_STAGES.map((stage, i) => (
            <div
              key={stage}
              className={`
                w-2 h-2 rounded-full transition-colors
                ${isTerminal
                  ? 'bg-secondary/20'
                  : i <= pipelineIndex
                    ? 'bg-accent'
                    : 'bg-secondary/20'
                }
              `}
            />
          ))}
        </div>

        {/* Company + Role */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-secondary">
              {application.company}
            </span>
            {application.method && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-secondary/60">
                {METHOD_ICON[application.method]}
                {METHOD_LABEL[application.method]}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-primary truncate mt-0.5">
            {application.role}
          </p>
        </div>

        {/* Location */}
        {application.location && (
          <div className="hidden md:flex items-center gap-1 text-xs text-secondary shrink-0">
            <MapPin size={12} />
            <span className="truncate max-w-[120px]">{application.location}</span>
          </div>
        )}

        {/* Days counter */}
        <div className="text-right shrink-0">
          <span className={`text-xs font-mono ${isStale ? 'text-warning' : 'text-secondary'}`}>
            {daysSinceApplied}d
          </span>
        </div>

        {/* Status badge */}
        <span className={`
          inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider shrink-0
          ${statusConfig.bg} ${statusConfig.text}
        `}>
          {statusConfig.label}
        </span>

        {/* Score */}
        {application.score_label && (
          <ScoreChip score={application.score} label={application.score_label} />
        )}

        {/* Expand icon */}
        <span className="text-secondary/40">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border/40 animate-fade-in">
          <div className="grid gap-4 sm:grid-cols-2 mt-3">
            {/* Left column: details */}
            <div className="space-y-2">
              {application.salary_range && (
                <div className="flex items-center gap-2 text-xs text-secondary">
                  <DollarSign size={12} />
                  <span>{application.salary_range}</span>
                </div>
              )}
              {application.contact_name && (
                <div className="flex items-center gap-2 text-xs text-secondary">
                  <User size={12} />
                  <span>{application.contact_name}</span>
                  {application.contact_url && (
                    <a href={application.contact_url} target="_blank" rel="noopener noreferrer"
                       className="text-accent hover:underline">
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              )}
              {application.contact_email && (
                <div className="flex items-center gap-2 text-xs text-secondary">
                  <Mail size={12} />
                  <a href={`mailto:${application.contact_email}`} className="text-accent hover:underline">
                    {application.contact_email}
                  </a>
                </div>
              )}
              {application.recruiter_name && (
                <div className="flex items-center gap-2 text-xs text-secondary">
                  <Megaphone size={12} />
                  <span>Recruiter: {application.recruiter_name}</span>
                </div>
              )}
              {application.follow_up_date && (
                <div className="flex items-center gap-2 text-xs text-secondary">
                  <CalendarClock size={12} />
                  <span>Follow up: {application.follow_up_date}</span>
                </div>
              )}
              {isStale && (
                <p className="text-[10px] text-warning font-medium mt-1">
                  No activity for {daysSinceActivity} days — consider following up
                </p>
              )}
              {application.job_url && (
                <a
                  href={application.job_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-accent hover:underline mt-1"
                >
                  <ExternalLink size={10} />
                  View Job Posting
                </a>
              )}
            </div>

            {/* Right column: notes + cover letter */}
            <div className="space-y-2">
              {application.notes && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-secondary/60 mb-1">Notes</p>
                  <p className="text-xs text-secondary leading-relaxed">{application.notes}</p>
                </div>
              )}
              {application.cover_letter && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-secondary/60 mb-1 flex items-center gap-1">
                    <FileText size={10} /> Cover Letter
                  </p>
                  <p className="text-xs text-secondary leading-relaxed line-clamp-4">
                    {application.cover_letter}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Status transition buttons */}
          {!isTerminal && (
            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border/30">
              <span className="text-[10px] text-secondary/50 uppercase tracking-wider self-center mr-1">
                Move to:
              </span>
              {(['screening', 'interview', 'offer', 'rejected', 'withdrawn'] as ApplicationStatus[])
                .filter((s) => s !== application.status)
                .map((targetStatus) => {
                  const cfg = STATUS_CONFIG[targetStatus];
                  return (
                    <button
                      key={targetStatus}
                      onClick={(e) => {
                        e.stopPropagation();
                        onStatusChange(application.id, targetStatus);
                      }}
                      className={`
                        px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wider
                        border border-border/40 hover:border-border transition-colors
                        ${cfg.bg} ${cfg.text}
                      `}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
