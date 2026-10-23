"use client";

import { useCallback, useEffect, useState } from "react";
import type { Cashier } from "@/lib/types";

export interface CashierInput {
  name?: string;
  username?: string;
  password?: string;
  tenantId?: string;
  /** How many devices the sign-in link may sign in. */
  maxUses?: number;
}

/** A cashier plus the sign-in link token the server returns when it makes a link (shown once). */
export type CashierInvite = Cashier & { inviteToken: string };

async function failure(res: Response) {
  const message = (await res.json().catch(() => null))?.message;
  if (message) return Array.isArray(message) ? message[0] : message;
  // Not JSON: the page got an error page, not an answer from the API.
  return res.status === 404 || res.status >= 500
    ? `The server isn't answering properly (error ${res.status}). Try again in a moment.`
    : "Something went wrong.";
}

/** Cashier accounts live on the server only, so unlike products they can't be edited offline. */
export function useCashiers() {
  const [cashiers, setCashiers] = useState<Cashier[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/cashiers");
      if (!res.ok) throw new Error(await failure(res));
      setCashiers(await res.json());
      setError("");
    } catch (err) {
      setError(navigator.onLine && err instanceof Error ? err.message : "You're offline. Cashier accounts need a connection.");
      setCashiers((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** `error` is a message, or null on success. */
  const send = async <T = unknown>(url: string, method: string, body?: CashierInput): Promise<{ error: string | null; data?: T }> => {
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) return { error: await failure(res) };
      const data = (await res.json().catch(() => undefined)) as T;
      await load();
      return { error: null, data };
    } catch {
      return { error: "Couldn't reach the server. Cashier accounts need a connection." };
    }
  };
  const message = async (request: Promise<{ error: string | null }>) => (await request).error;

  return {
    cashiers,
    error,
    reload: load,
    create: (body: CashierInput) => send<CashierInvite>("/api/cashiers", "POST", body),
    update: (id: string, body: CashierInput) => message(send(`/api/cashiers/${id}`, "PATCH", body)),
    remove: (id: string) => message(send(`/api/cashiers/${id}`, "DELETE")),
    /** Same link, usage back to zero; the cashier is signed out everywhere. */
    resetLink: (id: string) => message(send(`/api/cashiers/${id}/reset-link`, "POST")),
    /** A brand-new sign-in link for an existing cashier; the old link stops working and usage starts again. */
    invite: (id: string) => send<CashierInvite>(`/api/cashiers/${id}/invite`, "POST"),
  };
}
