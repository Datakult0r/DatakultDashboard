'use client';

import Image from 'next/image';
import { ExternalLink } from 'lucide-react';
import type { TriageItem } from '@/types/triage';

interface NewsCardProps {
  /** The news item to display */
  item: TriageItem;
}

/**
 * News card with large image at top and headline below
 * Vertical layout optimized for 3-column grid with hover zoom effect
 */
export default function NewsCard({ item }: NewsCardProps) {
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden hover:border-secondary/50 transition-all hover:-translate-y-0.5 hover:shadow-lg">
      {/* Large image area at top */}
      {item.news_image_url && (
        <div className="relative w-full h-40 bg-elevated overflow-hidden">
          <Image
            src={item.news_image_url}
            alt={item.title}
            width={400}
            height={160}
            className="object-cover w-full h-full hover:scale-105 transition-transform duration-300"
          />
          {/* Source badge overlay */}
          {item.news_source && (
            <div className="absolute top-2 left-2">
              <span className="inline-block px-2 py-0.5 rounded-sm text-xs font-medium bg-base/90 text-secondary uppercase tracking-wider">
                {item.news_source}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Content area */}
      <div className="p-4 flex flex-col gap-2">
        {/* Title */}
        <h3 className="text-base font-semibold text-primary line-clamp-2">
          {item.title}
        </h3>

        {/* Subtitle/summary */}
        {item.subtitle && (
          <p className="text-sm text-secondary line-clamp-2 flex-1">
            {item.subtitle}
          </p>
        )}

        {/* Read more link at bottom */}
        {item.source_url && (
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent hover:text-accent/80 flex items-center gap-1 w-fit mt-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent rounded px-1"
          >
            Read more
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}