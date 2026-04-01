'use client';

import { ExternalLink, Briefcase, MapPin, DollarSign } from 'lucide-react';
import type { TriageItem } from '@/types/triage';
import ScoreChip from './ScoreChip';

interface JobCardProps {
  /** The job item to display */
  item: TriageItem;
}

/**
 * Job pipeline card with company, role, location, salary, and score
 */
export default function JobCard({ item }: JobCardProps) {
  const statusColors: Record<string, string> = {
    pending: 'bg-secondary/20 text-secondary',
    in_progress: 'bg-warning/20 text-warning',
    completed: 'bg-success/20 text-success',
    skipped: 'bg-danger/20 text-danger',
  };

  const statusColor = statusColors[item.status] || statusColors.pending;

  return (
    <div className="bg-surface border border-border rounded-lg p-4 hover:border-secondary transition-colors">
      {/* Top row: Company and status */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          {item.company && (
            <h3 className="text-sm font-bold text-primary">
              {item.company}
            </h3>
          )}
          {item.role_title && (
            <p className="text-base font-semibold text-primary mt-1">
              {item.role_title}
            </p>
          )}
        </div>
        {item.score !== null && item.score_label && (
          <ScoreChip
            score={item.score}
            label={item.score_label}
          />
        )}
      </div>

      {/* Location and salary row */}
      <div className="flex items-center gap-4 text-xs text-secondary mb-3">
        {item.location && (
          <div className="flex items-center gap-1">
            <MapPin size={14} />
            {item.location}
          </div>
        )}
        {item.salary_range && (
          <div className="flex items-center gap-1">
            <DollarSign size={14} />
            {item.salary_range}
          </div>
        )}
      </div>

      {/* Job type and flags */}
      <div className="flex gap-2 flex-wrap mb-3">
        {item.job_type && (
          <span className="inline-block px-2 py-0.5 rounded-sm text-xs bg-elevated text-secondary">
            {item.job_type}
          </span>
        )}
        {item.easy_apply && (
          <span className="inline-block px-2 py-0.5 rounded-sm text-xs bg-success/20 text-success font-medium">
            Easy Apply
          </span>
        )}
        {item.recruiter_name && (
          <span className="inline-block px-2 py-0.5 rounded-sm text-xs bg-info/20 text-info">
            Recruiter: {item.recruiter_name}
          </span>
        )}
      </div>

      {/* Status badge */}
      <div className="flex items-center justify-between">
        <span
          className={`inline-block px-2 py-1 rounded-sm text-xs font-medium ${statusColor}`}
        >
          {item.status}
        </span>

        {item.source_url && (
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-accent hover:text-accent/80 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent rounded transition-colors"
          >
            View job
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}
