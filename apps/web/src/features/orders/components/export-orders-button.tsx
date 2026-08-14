import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * A plain link rather than a fetch: the request goes through the same-origin
 * proxy so the auth cookie is sent automatically, and the browser handles the
 * attachment itself. Pulling it through JavaScript would mean building a blob
 * and a synthetic click for no gain.
 */
export const ExportOrdersButton = () => (
  <Button variant="outline" asChild>
    <a href="/api/v1/orders/export" download>
      <Download className="size-4" />
      Export CSV
    </a>
  </Button>
);
