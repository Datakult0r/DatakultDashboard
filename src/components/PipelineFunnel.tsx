interface PipelineFunnelProps {
  applied: number;
  screening: number;
  interview: number;
  offer: number;
}

/**
 * Pipeline funnel visualization showing conversion rates
 */
export function PipelineFunnel({
  applied,
  screening,
  interview,
  offer,
}: PipelineFunnelProps) {
  const max = Math.max(applied, screening, interview, offer);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-base/80">Applied</span>
          <span className="text-sm font-semibold text-elevated">{applied}</span>
        </div>
        <div className="h-2 bg-border/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(applied / max) * 100}%` }}
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-base/80">Screening</span>
          <span className="text-sm font-semibold text-elevated">{screening}</span>
        </div>
        <div className="h-2 bg-border/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-secondary transition-all"
            style={{ width: `${(screening / max) * 100}%` }}
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-base/80">Interview</span>
          <span className="text-sm font-semibold text-elevated">{interview}</span>
        </div>
        <div className="h-2 bg-border/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${(interview / max) * 100}%` }}
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-base/80">Offer</span>
          <span className="text-sm font-semibold text-success">{offer}</span>
        </div>
        <div className="h-2 bg-border/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-success transition-all"
            style={{ width: `${(offer / max) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default PipelineFunnel;
