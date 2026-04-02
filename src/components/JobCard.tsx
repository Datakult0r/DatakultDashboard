'use client';

import { ExternalLink, Briefcase, MapPin, DollarSign, FileText, Zap } from 'lucide-react';
import type { TriageItem } from '@/types/triage';
import ScoreChip from './ScoreChip';

interface JobCardProps {
  /** The job item to display */
  item: TriageItem;
}

/**
 * Job pipeline card with company, role, location, salary, score, and deep links
 */
export default function JobCard({ item }: JobCardProps) {
  const statusColors: Record<string, string> = {
    pending: 'bg-secondary/15 text-secondary',
    in_progress: 'bg-warning/15 text-warning',
    completed: 'bg-success/15 text-success',
    skipped: 'bg-danger/15 text-danger',
  };

  const statusColor = statusColors[item.status] || statusColors.pending;
  const jobLink = item.source_url || item.contact_url || null;

  return (
    <div className="bg-surface border border-border rounded-lg p-4 hover:border-secondary/60 transition-all duration-200 group relative overflow-hidden">
      {/* Subtle accent for high-scoring jobs */}
      {item.score && item.score >= 70 && (        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-success/10 to-transparent rounded-bl-full" />
      )}

      {/* Top row: Company and status */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          {item.company && (
            <h3 className="text-xs font-bold text-secondary uppercase tracking-wider">
              {jobLink ? (
                <a
                  href={jobLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent transition-colors"
                >
                  {item.company}
                </a>
              ) : (
                item.company
              )}
            </h3>
          )}
          {item.role_title && (
            <p className="text-base font-semibold text-primary mt-1 leading-tight">
              {jobLink ? (
                <a
                  href={jobLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent transition-colors"                >
                  {item.role_title}
                </a>
              ) : (
                item.role_title
              )}
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
      </div>

      {/* Status badge and actions */}
      <div className="flex items-center justify-between pt-2 border-t border-border/40">        <span
          className={`inline-block px-2 py-1 rounded-sm text-xs font-medium ${statusColor}`}
        >
          {item.status}
        </span>

        <div className="flex items-center gap-2">
          {item.contact_url && item.contact_url !== jobLink && (
            <a
              href={item.contact_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-info/70 hover:text-info transition-colors"
              title="View contact"
            >
              Contact
              <ExternalLink size={10} />
            </a>
          )}
          {jobLink && (
            <a
              href={jobLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-accent bg-accent/10 hover:bg-accent/20 rounded transition-colors"
            >
              View job
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}