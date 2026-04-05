import { useState } from 'react';
import { Copy, ChevronDown } from 'lucide-react';
import { SourceTag } from './SourceTag';

interface TriageCardProps {
  id: string;
  title: string;
  source: 'email' | 'linkedin' | 'beeper' | 'calendar' | 'other';
  draftReply?: string;
  category: 'urgent' | 'review';
}

/**
 * Urgent/review item card with source tag, title, expandable draft reply
 * Includes copy-to-clipboard functionality
 */
export function TriageCard({
  id,
  title,
  source,
  draftReply,
  category,
}: TriageCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (draftReply) {
      await navigator.clipboard.writeText(draftReply);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-surface/40 backdrop-blur-sm border border-border/50 rounded-lg p-4 hover:bg-surface/60 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <SourceTag source={source} />
            {category === 'urgent' && (
              <span className="px-2 py-1 bg-danger/20 text-danger text-xs font-medium rounded">
                URGENT
              </span>
            )}
          </div>
          <h3 className="font-medium text-elevated text-sm">{title}</h3>
        </div>
      </div>

      {draftReply && (
        <div className="mt-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors mb-2"
          >
            <ChevronDown
              size={14}
              className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
            Draft Reply
          </button>

          {expanded && (
            <div className="bg-elevated/20 rounded p-3 mt-2 border border-border/30">
              <p className="text-xs text-base/80 leading-relaxed">{draftReply}</p>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 mt-3 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                <Copy size={12} />
                {copied ? 'Copied!' : 'Copy to clipboard'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TriageCard;
