'use client';

import type { Order } from '@crossval/shared';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDeleteOrder } from '../hooks';

type OrderActionsProps = {
  order: Order;
};

export const OrderActions = ({ order }: OrderActionsProps) => {
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteOrder = useDeleteOrder();

  // The API refuses to delete an order with payments against it. Disabling the
  // action here explains why up front rather than letting it fail.
  const hasPayments = order.paymentCount > 0;

  const confirmDelete = async () => {
    await deleteOrder.mutateAsync(order.id);
    setConfirmingDelete(false);
    router.push('/orders');
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Order actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => router.push(`/orders/${order.id}/edit`)}>
            <Pencil className="size-4" />
            Edit order
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={hasPayments}
            onSelect={() => setConfirmingDelete(true)}
          >
            <Trash2 className="size-4" />
            Delete order
          </DropdownMenuItem>

          {/* Says why the action above is unavailable, rather than leaving a
              greyed-out item with no explanation. */}
          {hasPayments ? (
            <p className="px-2 pb-1.5 pt-1 text-xs text-muted-foreground">
              Orders with payments cannot be deleted. Void them first.
            </p>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {order.orderNumber}?</DialogTitle>
            <DialogDescription>
              This order has no payments against it, so nothing financial is lost. It cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteOrder.isPending}
              onClick={() => void confirmDelete()}
            >
              {deleteOrder.isPending ? 'Deleting…' : 'Delete order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
