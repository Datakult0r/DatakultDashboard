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
    email: { bg: 'bg-info/10', text: 'text-info' },
    gmail: { bg: 'bg-info/10', text: 'text-info' },
    gmail_personal: { bg: 'bg-purple-700/10', text: 'text-purple-700' },
    linkedin: { bg: 'bg-teal-700/10', text: 'text-teal-700' },
    linkedin_dm: { bg: 'bg-teal-700/10', text: 'text-teal-700' },
    beeper: { bg: 'bg-accent/10', text: 'text-accent' },
    whatsapp: { bg: 'bg-success/10', text: 'text-success' },
    calendar: { bg: 'bg-orange-700/10', text: 'text-orange-700' },
    system: { bg: 'bg-gray-300/40', text: 'text-gray-500' },
    other: { bg: 'bg-gray-300/40', text: 'text-secondary' },
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
