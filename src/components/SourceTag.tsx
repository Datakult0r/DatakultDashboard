import { Badge } from '@/components/ui/badge';

interface SourceTagProps {
  source: 'email' | 'linkedin' | 'beeper' | 'calendar' | 'other';
}

/**
 * Displays a colored pill badge for different source types
 */
export function SourceTag({ source }: SourceTagProps) {
  const variants: Record<string, { bg: string; text: string; label: string }> = {
    email: { bg: 'bg-blue-900/30', text: 'text-blue-300', label: 'Email' },
    linkedin: { bg: 'bg-green-900/30', text: 'text-green-300', label: 'LinkedIn' },
    beeper: { bg: 'bg-violet-900/30', text: 'text-violet-300', label: 'Beeper' },
    calendar: { bg: 'bg-amber-900/30', text: 'text-amber-300', label: 'Calendar' },
    other: { bg: 'bg-gray-700/30', text: 'text-gray-300', label: 'Other' },
  };

  const config = variants[source] || variants.other;

  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
}

export default SourceTag;
