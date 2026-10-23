"use client";

import { useEffect, useState } from "react";
import { Tenant } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Deleting a store is permanent, so the button stays off until the store's name (or DELETE for several) is typed. */
export function DeleteStoresDialog({
  stores,
  sales,
  accounts,
  onCancel,
  onConfirm,
}: {
  stores: Tenant[] | null;
  sales: number;
  accounts: number;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => setTyped(""), [stores]);

  const many = (stores?.length ?? 0) > 1;
  const phrase = many ? "DELETE" : stores?.[0]?.name ?? "";
  const what = many ? `${stores!.length} stores` : `"${phrase}"`;

  return (
    <Dialog open={stores !== null} onOpenChange={(open) => !open && !pending && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {what}?</DialogTitle>
          <DialogDescription>
            This permanently removes its products, {sales} recorded {sales === 1 ? "sale" : "sales"}, suppliers, expenses and stock history
            {accounts ? `, and ${accounts} cashier ${accounts === 1 ? "account" : "accounts"}` : ""}. It can't be undone.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (typed.trim() !== phrase) return;
            setPending(true);
            await onConfirm();
            setPending(false);
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="confirm-delete">
              Type <span className="font-semibold">{phrase}</span> to confirm
            </Label>
            <Input id="confirm-delete" value={typed} autoComplete="off" autoFocus onChange={(event) => setTyped(event.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending || typed.trim() !== phrase}>
              {pending ? "Deleting" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
