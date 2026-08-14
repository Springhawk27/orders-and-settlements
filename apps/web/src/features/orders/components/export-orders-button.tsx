'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

const daysAgo = (days: number): string => {
  const date = new Date();

  date.setUTCDate(date.getUTCDate() - days);

  return toIsoDate(date);
};

const startOfThisMonth = (): string => {
  const now = new Date();

  return toIsoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
};

const startOfThisYear = (): string =>
  toIsoDate(new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)));

const PRESETS = [
  { label: 'Last 30 days', from: () => daysAgo(30) },
  { label: 'This month', from: startOfThisMonth },
  { label: 'This year', from: startOfThisYear },
];

export const ExportOrdersButton = () => {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const search = new URLSearchParams();

  if (from) {
    search.set('from', from);
  }

  if (to) {
    search.set('to', to);
  }

  const query = search.toString();
  const rangeIsBackwards = Boolean(from && to && from > to);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="size-4" />
          Export CSV
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export orders</DialogTitle>
          <DialogDescription>
            Every order issued in the range, whatever the filters on the list are set to. Leave both
            dates empty to export all of them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFrom(preset.from());
                  setTo(toIsoDate(new Date()));
                }}
              >
                {preset.label}
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setFrom('');
                setTo('');
              }}
            >
              All time
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="export-from">Issued from</Label>
              <Input
                id="export-from"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="export-to">Issued to</Label>
              <Input
                id="export-to"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
          </div>

          {rangeIsBackwards ? (
            <p className="text-sm text-destructive">The start date is after the end date.</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          {/* A link rather than a fetch: the proxy sends the auth cookie and the
              browser handles the attachment, so no blob or synthetic click.
              `disabled` does nothing to an anchor, so the invalid case renders a
              real button instead of a link that still works. */}
          {rangeIsBackwards ? (
            <Button disabled>
              <Download className="size-4" />
              Download
            </Button>
          ) : (
            <Button asChild>
              <a
                href={`/api/v1/orders/export${query ? `?${query}` : ''}`}
                download
                onClick={() => setOpen(false)}
              >
                <Download className="size-4" />
                Download
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
