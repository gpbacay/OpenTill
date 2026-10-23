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
import { collect, maxLength, passwordError, required, usernameError, type FieldErrors } from "@/lib/validation";
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
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!target) return;
    setErrors({});
    setServerError("");
    setPassword("");
    setName(editing?.name ?? "");
    setUsername(editing?.username ?? "");
    setTenantId(editing?.tenantId ?? activeTenant?.id ?? tenants[0]?.id ?? "");
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = check(
      collect({
        "cashier-name": required(name, "Enter the cashier's name.") ?? maxLength(name, 40, "The name"),
        "cashier-username": usernameError(username),
        // Optional when editing: leaving it empty keeps the current password.
        "cashier-password": editing && !password ? undefined : passwordError(password),
      }),
      setErrors
    );
    if (!ok) return;
    setPending(true);
    setServerError("");
    const message = await onSave(editing?.id ?? null, {
      name: name.trim(),
      username: username.trim().toLowerCase(),
      tenantId,
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
          Cashiers sign in with this username and password and can only use the Register of their store.
        </p>
        <form onSubmit={submit} noValidate className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="cashier-name" required>Name</Label>
            <Input
              id="cashier-name"
              {...invalid(errors, "cashier-name")}
              value={name}
              autoFocus
              onChange={(e) => {
                clearError(setErrors, "cashier-name");
                setName(e.target.value);
              }}
            />
            <FieldError errors={errors} id="cashier-name" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cashier-username" required>Username</Label>
            <Input
              id="cashier-username"
              {...invalid(errors, "cashier-username")}
              value={username}
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
            <Input
              id="cashier-password"
              {...invalid(errors, "cashier-password")}
              type="password"
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
            <Label>Store</Label>
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
