'use client';

import type { SourceType } from '@/types/triage';

interface SourceTagProps {
  /** The source type for the triage item */
  source: string;
  /** Optional custom source type override */
  sourceType?: SourceType;
}

/**
 * Colored pill badge for source type
 */
export default function SourceTag({ source, sourceType }: SourceTagProps) {
  const normalizedSource = sourceType || (source.toLowerCase() as SourceType);

  const colorMap: Record<SourceType, { bg: string; text: string }> = {
    email: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    linkedin: { bg: 'bg-green-500/20', text: 'text-green-400' },
    beeper: { bg: 'bg-violet-500/20', text: 'text-violet-400' },
    calendar: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
    other: { bg: 'bg-gray-500/20', text: 'text-secondary' },
  };

  const colors = colorMap[normalizedSource] || colorMap.other;

  return (
    <span
      className={`inline-block px-2 py-1 rounded-sm text-xs font-medium ${colors.bg} ${colors.text}`}
    >
      {source}
    </span>
  );
}
