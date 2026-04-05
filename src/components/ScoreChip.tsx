interface ScoreChipProps {
  score: number;
  label: 'strong' | 'apply' | 'light' | 'priority' | 'skip';
}

/**
 * Reusable score badge with color coding
 * strong: red, apply: amber, light: gray, priority: red-pulsing, skip: gray
 */
export function ScoreChip({ score, label }: ScoreChipProps) {
  const variants: Record<string, { bg: string; text: string }> = {
    strong: { bg: 'bg-red-900/40', text: 'text-red-300' },
    apply: { bg: 'bg-amber-900/40', text: 'text-amber-300' },
    light: { bg: 'bg-gray-700/40', text: 'text-gray-300' },
    priority: { bg: 'bg-red-900/40 animate-pulseGlow', text: 'text-red-300' },
    skip: { bg: 'bg-gray-700/40', text: 'text-gray-400' },
  };

  const config = variants[label];

  return (
    <div className={`inline-flex items-center px-3 py-1.5 rounded-md ${config.bg}`}>
      <span className={`text-xs font-semibold ${config.text}`}>{score}</span>
      <span className={`text-xs ml-1.5 ${config.text} opacity-75`}>{label}</span>
    </div>
  );
}

export default ScoreChip;
