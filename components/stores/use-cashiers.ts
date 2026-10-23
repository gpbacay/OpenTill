"use client";

import { useCallback, useEffect, useState } from "react";
import type { Cashier } from "@/lib/types";

export interface CashierInput {
  name?: string;
  username?: string;
  password?: string;
  tenantId?: string;
}

async function failure(res: Response) {
  const message = (await res.json().catch(() => null))?.message;
  return (Array.isArray(message) ? message[0] : message) || "Something went wrong.";
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

  /** Resolves to an error message, or null on success. */
  const send = async (url: string, method: string, body?: CashierInput) => {
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) return await failure(res);
      await load();
      return null;
    } catch {
      return "Couldn't reach the server. Cashier accounts need a connection.";
    }
  };

  return {
    cashiers,
    error,
    reload: load,
    create: (body: CashierInput) => send("/api/cashiers", "POST", body),
    update: (id: string, body: CashierInput) => send(`/api/cashiers/${id}`, "PATCH", body),
    remove: (id: string) => send(`/api/cashiers/${id}`, "DELETE"),
  };
}
