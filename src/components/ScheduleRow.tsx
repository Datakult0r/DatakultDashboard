'use client';

import { Clock, MapPin, ExternalLink, User, Video } from 'lucide-react';
import { format, isPast, isSameDay } from 'date-fns';
import type { TriageItem } from '@/types/triage';

interface ScheduleRowProps {
  /** The schedule item to display */
  item: TriageItem;
  /** Current time for highlighting current block */
  now?: Date;
}

/**
 * Time + event row for calendar items
 * Highlights current time block if applicable
 */
export default function ScheduleRow({ item, now = new Date() }: ScheduleRowProps) {
  if (!item.event_time) {
    return null;
  }

  const eventStart = new Date(item.event_time);
  const eventEnd = item.event_end_time ? new Date(item.event_end_time) : null;
  const isCurrentEvent =
    !isPast(eventStart) && eventEnd && isPast(eventEnd)
      ? false
      : !isPast(eventStart);
  const isSoon =
    eventStart.getTime() - now.getTime() < 1000 * 60 * 60 && !isPast(eventStart); // Within 1 hour

  const timeStr = format(eventStart, 'HH:mm');
  const endTimeStr = eventEnd ? format(eventEnd, 'HH:mm') : null;

  const isToday = isSameDay(eventStart, now);

  const highlightClass = isCurrentEvent
    ? 'bg-warning/10 border-warning'
    : isSoon
      ? 'bg-info/10 border-info'
      : '';

  return (
    <div
      className={`border border-border rounded-lg p-3 flex gap-3 items-start transition-colors ${highlightClass}`}
    >
      {/* Time */}
      <div className="flex-shrink-0 text-right">
        <div className="font-mono font-bold text-primary text-sm">
          {timeStr}
        </div>
        {endTimeStr && (
          <div className="text-xs text-secondary font-mono">
            {endTimeStr}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="flex-shrink-0 w-1 bg-border rounded-full" />

      {/* Event details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-semibold text-primary text-sm mb-0.5">
              {item.event_url ? (
                <a
                  href={item.event_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent transition-colors"
                >
                  {item.title}
                </a>
              ) : (
                item.title
              )}
            </h4>

            {/* Contact name linked */}
            {item.contact_name && (
              <div className="flex items-center gap-1 text-xs text-secondary/80 mb-1">
                <User size={11} />
                {item.contact_url ? (
                  <a
                    href={item.contact_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent/80 hover:text-accent underline underline-offset-2 decoration-accent/30"
                  >
                    {item.contact_name}
                  </a>
                ) : (
                  <span>{item.contact_name}</span>
                )}
              </div>
            )}
          </div>

          {/* Join button — prominent when soon/now */}
          {item.event_url && (isSoon || isCurrentEvent) && (
            <a
              href={item.event_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`
                flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all
                ${isCurrentEvent
                  ? 'bg-warning/20 text-warning border border-warning/30 hover:bg-warning/30 animate-pulse'
                  : 'bg-success/15 text-success border border-success/25 hover:bg-success/25'
                }
              `}
            >
              <Video size={13} />
              Join
            </a>
          )}
        </div>

        {item.subtitle && (
          <p className="text-xs text-secondary mb-1.5">
            {item.subtitle}
          </p>
        )}

        {/* Location and badges */}
        <div className="flex gap-2 items-center flex-wrap text-xs">
          {item.event_location && (
            <div className="flex items-center gap-1 text-secondary">
              <MapPin size={12} />
              {item.event_location}
            </div>
          )}
          {isToday && (
            <span className="inline-block px-1.5 py-0.5 rounded-sm bg-accent/20 text-accent text-xs font-medium">
              Today
            </span>
          )}
          {isCurrentEvent && (
            <span className="inline-block px-1.5 py-0.5 rounded-sm bg-warning/20 text-warning text-xs font-medium animate-pulse">
              Now
            </span>
          )}
          {isSoon && !isCurrentEvent && (
            <span className="inline-block px-1.5 py-0.5 rounded-sm bg-info/20 text-info text-xs font-medium">
              Soon
            </span>
          )}
        </div>

        {/* Link — shown when not soon/now (those get the Join button above) */}
        {item.event_url && !isSoon && !isCurrentEvent && (
          <a
            href={item.event_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-accent hover:text-accent/80 text-xs mt-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent rounded px-1"
          >
            Join/Details
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}
