'use client';

import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * Catches anything a page throws that its own query error states did not. The
 * message is deliberately generic — a stack trace is for the logs, not for
 * whoever is looking at the screen.
 */
const DashboardError = ({ reset }: { error: Error; reset: () => void }) => (
  <Alert variant="destructive">
    <AlertTitle>Something went wrong</AlertTitle>
    <AlertDescription className="flex flex-wrap items-center gap-3">
      <span>This page could not be displayed.</span>
      <Button variant="outline" size="sm" onClick={reset}>
        <RotateCcw className="size-4" />
        Try again
      </Button>
    </AlertDescription>
  </Alert>
);

export default DashboardError;
