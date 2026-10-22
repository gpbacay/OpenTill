"use client";

import { useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/auth-context";
import { usePos } from "@/contexts/pos-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Wraps any "Log out" control (`children`, a single button) so it asks before signing out. */
export function LogoutButton({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const { offlineQueue } = usePos();
  const [pending, setPending] = useState(false);
  const queued = offlineQueue.length;

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log out?</DialogTitle>
          <DialogDescription>
            You&apos;ll need your username and password to sign in again.
            {queued > 0
              ? ` ${queued} ${queued === 1 ? "sale is" : "sales are"} still waiting to be sent. ${queued === 1 ? "It stays" : "They stay"} on this device and will be sent the next time you sign in here.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => {
              setPending(true);
              void logout();
            }}
          >
            {pending ? "Logging out" : "Log out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
