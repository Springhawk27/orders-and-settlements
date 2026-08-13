'use client';

import type { AuditEvent } from '@crossval/shared';
import { formatDateTime } from '@/lib/format';

type AuditTimelineProps = {
  events: AuditEvent[];
};

export const AuditTimeline = ({ events }: AuditTimelineProps) => {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity recorded yet.</p>;
  }

  return (
    <ol className="relative space-y-4 border-l pl-5">
      {events.map((event) => (
        <li key={event.id} className="space-y-0.5">
          <span
            aria-hidden
            className="absolute -left-[4.5px] mt-1.5 size-2 rounded-full bg-border ring-4 ring-background"
          />
          <p className="text-sm">{event.summary}</p>
          <p className="text-xs text-muted-foreground tabular-nums">{formatDateTime(event.at)}</p>
        </li>
      ))}
    </ol>
  );
};
