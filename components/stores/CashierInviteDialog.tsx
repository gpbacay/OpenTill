"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/motion/skeleton";
import { usePos } from "@/contexts/pos-context";
import type { CashierInvite } from "./use-cashiers";

/** The link (and QR code) that opens a cashier's sign-in page. Shown once: only a hash is stored. */
export function CashierInviteDialog({ invite, onClose }: { invite: CashierInvite | null; onClose: () => void }) {
  const { tenants } = usePos();
  const [image, setImage] = useState("");
  const [copied, setCopied] = useState(false);
  const link = invite ? `${window.location.origin}/join/${invite.inviteToken}` : "";

  useEffect(() => {
    setCopied(false);
    setImage("");
    if (!link) return;
    let cancelled = false;
    QRCode.toDataURL(link, { width: 512, margin: 2, errorCorrectionLevel: "M" })
      .then((dataUrl) => !cancelled && setImage(dataUrl))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [link]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      document.getElementById("cashier-invite-link")?.focus();
    }
  };

  const store = tenants.find((t) => t.id === invite?.tenantId)?.name;

  return (
    <Dialog open={invite !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign-in link for {invite?.username}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Send them this link or let them scan the code. They sign in{store ? ` to ${store}` : ""} with the password you set.
          It works on {invite?.linkMaxUses === 1 ? "one device" : `${invite?.linkMaxUses} devices`}: the first to open it {invite?.linkMaxUses === 1 ? "is" : "are"} remembered
          and can use it again; other devices can&apos;t. You won&apos;t be able to see this link again,
          but you can make a new one or reset its usage any time.
        </p>
        <div className="mx-auto w-full max-w-56 rounded-xl bg-white p-3">
          {image ? (
            <img src={image} alt="QR code for the invite link" className="aspect-square w-full" />
          ) : (
            <Skeleton className="aspect-square w-full rounded-none" />
          )}
        </div>
        <div className="flex gap-2">
          <Input id="cashier-invite-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" />
          <Button type="button" variant="secondary" onClick={() => void copy()}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
