import { ScoreChip } from './ScoreChip';

interface JobCardProps {
  company: string;
  position: string;
  score: number;
  scoreLabel: 'strong' | 'apply' | 'light' | 'priority' | 'skip';
  easyApply: boolean;
  onClick?: () => void;
}

/**
 * Job pipeline card with score breakdown
 * Includes easy-apply flag
 */
export function JobCard({
  company,
  position,
  score,
  scoreLabel,
  easyApply,
  onClick,
}: JobCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-surface/40 backdrop-blur-sm border border-border/50 rounded-lg p-4 hover:bg-surface/60 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-medium text-elevated text-sm">{position}</h3>
          <p className="text-xs text-base/60 mt-1">{company}</p>
        </div>
        <ScoreChip score={score} label={scoreLabel} />
      </div>
      {easyApply && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30">
          <span className="inline-flex items-center px-2 py-1 bg-success/20 text-success rounded text-xs font-medium">
            ✓ Easy Apply
          </span>
        </div>
      )}
    </div>
  );
}

export default JobCard;
