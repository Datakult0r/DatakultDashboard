'use client';

import { useState } from 'react';
import { ExternalLink, Briefcase, MapPin, DollarSign, FileText, Zap, RotateCcw, Sparkles } from 'lucide-react';
import type { TriageItem } from '@/types/triage';
import ScoreChip from './ScoreChip';

interface JobCardProps {
  /** The job item to display */
  item: TriageItem;
}

/**
 * Job pipeline card with company, role, location, salary, score, and deep links.
 * Supports card flip on click to show cover letter / CV notes on the back.
 */
export default function JobCard({ item }: JobCardProps) {
  const [flipped, setFlipped] = useState(false);

  const statusColors: Record<string, string> = {
    pending: 'bg-secondary/15 text-secondary',
    in_progress: 'bg-warning/15 text-warning',
    completed: 'bg-success/15 text-success',
    skipped: 'bg-danger/15 text-danger',
  };

  const statusColor = statusColors[item.status] || statusColors.pending;
  const jobLink = item.source_url || item.contact_url || null;
  const hasBackContent = Boolean(item.cover_letter || item.tailored_cv_notes || item.score_breakdown);

  return (
    <div
      className="relative"
      style={{ perspective: '1000px' }}
    >
      <div
        className="relative transition-transform duration-500 ease-in-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* ═══ FRONT ═══ */}
        <div
          className="bg-surface border border-border rounded-lg p-4 hover:border-secondary/60 transition-all duration-200 group relative overflow-hidden"
          style={{ backfaceVisibility: 'hidden' }}
        >
          {/* Subtle accent for high-scoring jobs */}
          {item.score && item.score >= 70 && (
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-success/10 to-transparent rounded-bl-full" />
          )}

          {/* Flip indicator */}
          {hasBackContent && (
            <button
              onClick={(e) => { e.stopPropagation(); setFlipped(true); }}
              className="absolute top-2 right-2 p-1.5 rounded-md bg-elevated/80 text-secondary/60 hover:text-accent hover:bg-accent/10 transition-all z-10"
              title="Flip for details"
            >
              <Sparkles size={14} />
            </button>
          )}

          {/* Top row: Company and status */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1 min-w-0">
              {item.company && (
                <h3 className="text-xs font-bold text-secondary uppercase tracking-wider">
                  {jobLink ? (
                    <a href={jobLink} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">
                      {item.company}
                    </a>
                  ) : item.company}
                </h3>
              )}
              {item.role_title && (
                <p className="text-base font-semibold text-primary mt-1 leading-tight">
                  {jobLink ? (
                    <a href={jobLink} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">
                      {item.role_title}
                    </a>
                  ) : item.role_title}
                </p>
              )}
            </div>
            {item.score !== null && item.score_label && (
              <ScoreChip score={item.score} label={item.score_label} />
            )}
          </div>

          {/* Location and salary row */}
          <div className="flex items-center gap-4 text-xs text-secondary mb-3">
            {item.location && (
              <div className="flex items-center gap-1">
                <MapPin size={13} />
                {item.location}
              </div>
            )}
            {item.salary_range && (
              <div className="flex items-center gap-1">
                <DollarSign size={13} />
                {item.salary_range}
              </div>
            )}
          </div>

          {/* Job type, flags, and cover letter indicator */}
          <div className="flex gap-1.5 flex-wrap mb-3">
            {item.job_type && (
              <span className="inline-block px-2 py-0.5 rounded-sm text-xs bg-elevated text-secondary">
                {item.job_type}
              </span>
            )}
            {item.easy_apply && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs bg-success/15 text-success font-medium">
                <Zap size={10} />
                Easy Apply
              </span>
            )}
            {item.recruiter_name && (
              <span className="inline-block px-2 py-0.5 rounded-sm text-xs bg-info/15 text-info">
                {item.recruiter_name}
              </span>
            )}
            {item.cover_letter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs bg-accent/15 text-accent">
                <FileText size={10} />
                Cover Letter
              </span>
            )}
            {item.tailored_cv_notes && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs bg-info/15 text-info">
                <Sparkles size={10} />
                CV Tailored
              </span>
            )}
          </div>

          {/* Status badge and actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <span className={`inline-block px-2 py-1 rounded-sm text-xs font-medium ${statusColor}`}>
              {item.status}
            </span>
            <div className="flex items-center gap-2">
              {item.contact_url && item.contact_url !== jobLink && (
                <a href={item.contact_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-info/70 hover:text-info transition-colors" title="View contact">
                  Contact <ExternalLink size={10} />
                </a>
              )}
              {jobLink && (
                <a href={jobLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-accent bg-accent/10 hover:bg-accent/20 rounded transition-colors">
                  View job <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* ═══ BACK ═══ */}
        {hasBackContent && (
          <div
            className="absolute inset-0 bg-surface border border-accent/30 rounded-lg p-4 overflow-y-auto"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            {/* Back header */}
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-accent flex items-center gap-1.5">
                <Sparkles size={14} />
                {item.company} — Details
              </h4>
              <button
                onClick={(e) => { e.stopPropagation(); setFlipped(false); }}
                className="p-1.5 rounded-md bg-elevated text-secondary hover:text-primary transition-colors"
                title="Flip back"
              >
                <RotateCcw size={14} />
              </button>
            </div>

            {/* Score breakdown */}
            {item.score_breakdown && Object.keys(item.score_breakdown).length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-1">Score Breakdown</p>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(item.score_breakdown).map(([factor, points]) => (
                    <span key={factor} className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-mono">
                      {factor}: +{points}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Cover letter */}
            {item.cover_letter && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-1">Cover Letter</p>
                <p className="text-xs text-primary leading-relaxed whitespace-pre-wrap">{item.cover_letter}</p>
              </div>
            )}

            {/* CV tailoring notes */}
            {item.tailored_cv_notes && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-1">CV Focus</p>
                <p className="text-xs text-primary leading-relaxed whitespace-pre-wrap">{item.tailored_cv_notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
