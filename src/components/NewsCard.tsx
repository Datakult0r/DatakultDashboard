'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import type { TriageItem } from '@/types/triage';

interface NewsCardProps {
  /** The news item to display */
  item: TriageItem;
}

/**
 * News card with thumbnail image, headline, and hover-to-expand abstract.
 * Horizontal layout: image 80x60px on left, content on right.
 * Hover or click expands to show full abstract.
 */
export default function NewsCard({ item }: NewsCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="bg-surface border border-border rounded-lg p-3 hover:border-secondary transition-all duration-200 group cursor-pointer"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onClick={() => setExpanded((prev) => !prev)}
    >
      <div className="flex gap-3">
        {/* Thumbnail image */}
        {item.news_image_url ? (
          <div className="flex-shrink-0">
            <div className="relative w-20 h-[60px] rounded-md overflow-hidden bg-elevated">
              <Image
                src={item.news_image_url}
                alt={item.title}
                width={80}
                height={60}
                className="object-cover w-full h-full"
                unoptimized
              />
            </div>
          </div>
        ) : (
          <div className="flex-shrink-0">
            <div className="w-20 h-[60px] rounded-md bg-elevated flex items-center justify-center">
              <span className="text-secondary/40 text-xs font-mono uppercase">
                {item.news_source?.slice(0, 4) || 'NEWS'}
              </span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          {/* Header with source + expand indicator */}
          <div className="flex items-center justify-between mb-1">
            {item.news_source && (
              <p className="text-xs font-mono text-secondary/70 uppercase tracking-wider">
                {item.news_source}
              </p>
            )}
            <span className="text-secondary/40 transition-transform duration-200">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-sm font-semibold text-primary line-clamp-2 mb-1 group-hover:text-accent transition-colors">
            {item.title}
          </h3>

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {item.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-elevated text-secondary/80 font-mono"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expandable abstract (hover/click to show) */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          expanded ? 'max-h-40 opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'
        }`}
      >
        <div className="border-t border-border/50 pt-3">
          {item.subtitle && (
            <p className="text-xs text-secondary leading-relaxed mb-2">
              {item.subtitle}
            </p>
          )}

          {/* Link button */}
          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-accent hover:text-accent/80 flex items-center gap-1 w-fit focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent rounded px-1"
            >
              Read full article
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
