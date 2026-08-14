import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

// A link rather than a fetch: the proxy sends the auth cookie and the browser
// handles the attachment, so no blob or synthetic click is needed.
export const ExportOrdersButton = () => (
  <Button variant="outline" asChild>
    <a href="/api/v1/orders/export" download>
      <Download className="size-4" />
      Export CSV
    </a>
  </Button>
);
