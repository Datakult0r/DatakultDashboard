'use client';

import Image from 'next/image';
import { ExternalLink } from 'lucide-react';
import type { TriageItem } from '@/types/triage';

interface NewsCardProps {
  /** The news item to display */
  item: TriageItem;
}

/**
 * News card with thumbnail image on the left and headline on the right
 * Horizontal layout with image 80x60px rounded
 */
export default function NewsCard({ item }: NewsCardProps) {
  return (
    <div className="bg-surface border border-border rounded-lg p-3 hover:border-secondary transition-colors flex gap-3">
      {/* Thumbnail image */}
      {item.news_image_url && (
        <div className="flex-shrink-0">
          <div className="relative w-20 h-15 rounded-sm overflow-hidden bg-elevated">
            <Image
              src={item.news_image_url}
              alt={item.title}
              width={80}
              height={60}
              className="object-cover w-full h-full"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        {/* Header with source */}
        {item.news_source && (
          <p className="text-xs font-mono text-secondary/70 uppercase tracking-wider mb-1">
            {item.news_source}
          </p>
        )}

        {/* Title and subtitle */}
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-primary line-clamp-2 mb-1">
            {item.title}
          </h3>
          {item.subtitle && (
            <p className="text-xs text-secondary line-clamp-1">
              {item.subtitle}
            </p>
          )}
        </div>

        {/* Link button */}
        {item.source_url && (
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent hover:text-accent/80 flex items-center gap-1 w-fit mt-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent rounded px-1"
          >
            Read more
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}
