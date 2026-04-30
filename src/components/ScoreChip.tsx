'use client';

import type { ScoreLabel } from '@/types/triage';

interface ScoreChipProps {
  /** Numeric score (0-100) */
  score: number | null;
  /** Label for the score */
  label: ScoreLabel | null;
  /** Optional additional className */
  className?: string;
}

/**
 * Reusable score badge showing number + label
 * Colors: strong (red), apply (amber), light (gray), priority (red pulsing), skip (gray)
 */
export default function ScoreChip({
  score,
  label,
  className = '',
}: ScoreChipProps) {
  if (score === null || label === null) {
    return null;
  }

  const colorMap: Record<ScoreLabel, { bg: string; text: string; pulse?: boolean }> = {
    strong: { bg: 'bg-danger', text: 'text-white' },
    apply: { bg: 'bg-warning', text: 'text-white' },
    light: { bg: 'bg-secondary/20', text: 'text-secondary' },
    skip: { bg: 'bg-secondary/10', text: 'text-secondary' },
    priority: { bg: 'bg-danger', text: 'text-white', pulse: true },
  };

  const colors = colorMap[label] || colorMap.light;
  const pulseClass = colors.pulse ? 'animate-pulse' : '';

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-semibold font-mono ${colors.bg} ${colors.text} ${pulseClass} ${className}`}
    >
      <span>{score}</span>
      <span className="text-[0.65rem] font-normal opacity-75">{label}</span>
    </div>
  );
}
