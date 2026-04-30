'use client';

/**
 * Shimmer loading skeleton for dashboard cards.
 * Shows 3 placeholder cards with animated gradient sweep.
 */
export function CardSkeleton() {
  return (
    <div className="bg-surface border border-border/40 rounded-lg p-4 animate-pulse">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <div className="h-3 w-24 bg-elevated rounded" />
          <div className="h-4 w-48 bg-elevated rounded mt-2" />
        </div>
        <div className="h-6 w-14 bg-elevated rounded-full" />
      </div>
      <div className="flex gap-2 mb-3">
        <div className="h-3 w-20 bg-elevated rounded" />
        <div className="h-3 w-16 bg-elevated rounded" />
      </div>
      <div className="flex gap-1.5 mb-3">
        <div className="h-5 w-16 bg-elevated rounded-sm" />
        <div className="h-5 w-20 bg-elevated rounded-sm" />
      </div>
      <div className="pt-2 border-t border-border/30 flex justify-between">
        <div className="h-5 w-16 bg-elevated rounded-sm" />
        <div className="h-5 w-20 bg-elevated rounded" />
      </div>
    </div>
  );
}

/** Grid of skeleton cards for tab loading states */
export default function LoadingSkeleton({ count = 3, columns = 1 }: { count?: number; columns?: number }) {
  return (
    <div className={`grid gap-3 ${columns === 2 ? 'md:grid-cols-2' : ''}`}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Stat card skeleton */
export function StatSkeleton() {
  return (
    <div className="bg-surface border border-border/40 rounded-lg p-3 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-elevated" />
        <div>
          <div className="h-5 w-8 bg-elevated rounded mb-1" />
          <div className="h-3 w-14 bg-elevated rounded" />
        </div>
      </div>
    </div>
  );
}
