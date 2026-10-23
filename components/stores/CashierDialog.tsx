"use client";

import { useEffect, useState } from "react";
import { usePos } from "@/contexts/pos-context";
import { Cashier } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldError, check, clearError, invalid } from "@/components/FieldError";
import { PasswordInput } from "@/components/PasswordInput";
import { collect, numberError, numericInput, passwordError, required, usernameError, type FieldErrors } from "@/lib/validation";
import type { CashierInput } from "./use-cashiers";

export function CashierDialog({
  target,
  onClose,
  onSave,
}: {
  target: Cashier | "new" | null;
  onClose: () => void;
  /** Resolves to an error message, or null when saved. */
  onSave: (id: string | null, input: CashierInput) => Promise<string | null>;
}) {
  const { tenants, activeTenant } = usePos();
  const editing = target && target !== "new" ? target : null;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!target) return;
    setErrors({});
    setServerError("");
    setPassword("");
    setUsername(editing?.username ?? "");
    setMaxUses(String(editing?.linkMaxUses ?? 1));
    setTenantId(editing?.tenantId ?? activeTenant?.id ?? tenants[0]?.id ?? "");
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = check(
      collect({
        "cashier-username": usernameError(username),
        // Optional when editing: leaving it empty keeps the current password.
        "cashier-password": editing && !password ? undefined : passwordError(password),
        "cashier-store": required(tenantId, "Pick a store for this cashier."),
        "cashier-uses": numberError(maxUses, "the number of devices", { required: true, integer: true, min: 1, max: 20 }),
      }),
      setErrors
    );
    if (!ok) return;
    setPending(true);
    setServerError("");
    // No name field: like sign-up, the display name follows the username (the server keeps it in sync).
    const message = await onSave(editing?.id ?? null, {
      username: username.trim().toLowerCase(),
      tenantId,
      maxUses: Number(maxUses),
      ...(password ? { password } : {}),
    });
    setPending(false);
    if (message) setServerError(message);
    else onClose();
  };

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit cashier" : "Add cashier"}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Cashiers can only use the Register of their store. You set their password; they can't change it.
        </p>
        <form onSubmit={submit} noValidate className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="cashier-username" required>Username</Label>
            <Input
              id="cashier-username"
              {...invalid(errors, "cashier-username")}
              value={username}
              autoFocus
              autoCapitalize="none"
              autoComplete="off"
              onChange={(e) => {
                clearError(setErrors, "cashier-username");
                setUsername(e.target.value);
              }}
            />
            <FieldError errors={errors} id="cashier-username" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cashier-password" required={!editing}>{editing ? "New password" : "Password"}</Label>
            <PasswordInput
              id="cashier-password"
              {...invalid(errors, "cashier-password")}
              autoComplete="new-password"
              value={password}
              placeholder={editing ? "Leave empty to keep the current one" : "At least 8 characters"}
              onChange={(e) => {
                clearError(setErrors, "cashier-password");
                setPassword(e.target.value);
              }}
            />
            <FieldError errors={errors} id="cashier-password" />
            {editing ? <p className="text-xs text-muted-foreground">A new password signs this cashier out everywhere.</p> : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="cashier-store" required>Store</Label>
            <Select
              value={tenantId}
              onValueChange={(value) => {
                clearError(setErrors, "cashier-store");
                setTenantId(value);
              }}
            >
              <SelectTrigger id="cashier-store" {...invalid(errors, "cashier-store")} className="w-full">
                <SelectValue placeholder="Pick a store" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError errors={errors} id="cashier-store" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cashier-uses" required>Devices the sign-in link works on</Label>
            <Input
              id="cashier-uses"
              {...invalid(errors, "cashier-uses")}
              inputMode="numeric"
              value={maxUses}
              onChange={(e) => {
                clearError(setErrors, "cashier-uses");
                setMaxUses(numericInput(e.target.value, { decimals: false }));
              }}
            />
            <FieldError errors={errors} id="cashier-uses" />
            <p className="text-xs text-muted-foreground">
              1 means one phone or computer: the first one to open the link. It can use it again, but other devices can't.
            </p>
          </div>
          {serverError ? <p role="alert" className="text-sm text-destructive">{serverError}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving" : editing ? "Save changes" : "Add cashier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
