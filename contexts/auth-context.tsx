"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  clearPendingPassword,
  isCashier,
  isLocalOnly,
  matchLocalAccount,
  newLocalId,
  pendingAccounts,
  readLocalSession,
  readPendingProfile,
  refreshLocalSession,
  rememberLocalAccount,
  touchLocalAccount,
  updateLocalAccount,
  writeLocalSession,
  writePendingProfile,
  type LocalUser,
} from "@/lib/local-auth";
// Imported first, so even sign-in requests track whether the API is reachable.
import { isOnline } from "@/lib/offline";

interface AccountUpdate {
  name: string;
  username: string;
  currentPassword?: string;
  newPassword?: string;
  /** New profile picture (image data URL), or "" to remove it. */
  avatar?: string;
}

interface AuthContextValue {
  user: LocalUser | null;
  ready: boolean;
  login: (username: string, password: string, remember: boolean) => Promise<string | null>;
  register: (username: string, password: string) => Promise<string | null>;
  /** A cashier opens the sign-in link their admin shared. */
  join: (token: string) => Promise<string | null>;
  logout: () => Promise<void>;
  updateAccount: (body: AccountUpdate) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function errorMessage(res: Response) {
  const body = await res.json().catch(() => null);
  const message = body?.message;
  if (typeof message === "string") return message;
  if (Array.isArray(message) && typeof message[0] === "string") return message[0];
  return "Something went wrong.";
}

/** A non-JSON 404/5xx is the proxy (Vercel blocks localhost), not the Nest API. */
function apiMissing(res: Response) {
  if ((res.headers.get("content-type") ?? "").includes("json")) return false;
  return res.status === 404 || res.status >= 500;
}

function asUser(value: LocalUser): LocalUser {
  return {
    id: value.id,
    name: value.name,
    username: value.username,
    avatar: value.avatar ?? "",
    role: value.role ?? "ADMIN",
    tenantId: value.tenantId ?? null,
    pages: value.pages ?? null,
  };
}

async function syncPendingAccounts() {
  for (const account of pendingAccounts()) {
    if (!account.pendingPassword) continue;
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: account.id,
          name: account.name,
          username: account.username,
          password: account.pendingPassword,
        }),
      });
      if (apiMissing(res)) return;
      if (res.ok || res.status === 409) clearPendingPassword(account.id);
    } catch {
      return;
    }
  }
}

/** Sends name and photo changes made offline. Resolves to the saved user, or null when nothing was saved. */
async function syncPendingProfile(userId: string): Promise<LocalUser | null> {
  const changes = readPendingProfile(userId);
  if (!changes) return null;
  try {
    const res = await fetch("/api/auth/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    if (apiMissing(res) || res.status === 401) return null; // not signed in on the server yet: try again later
    // Saved, or refused for good (e.g. an invalid name). Keep anything edited while this request was out.
    if (JSON.stringify(readPendingProfile(userId)) === JSON.stringify(changes)) writePendingProfile(userId, null);
    if (!res.ok) return null;
    const next = asUser(await res.json());
    touchLocalAccount(next);
    refreshLocalSession(next);
    return next;
  } catch {
    return null;
  }
}

/** The server's copy of the user with this device's unsent name and photo changes on top. */
const withPendingProfile = (user: LocalUser): LocalUser => ({ ...user, ...readPendingProfile(user.id) });

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<LocalUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const local = readLocalSession();
    if (local) {
      setUser(local);
      setReady(true);
    }
    let cancelled = false;
    fetch("/api/auth/me")
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          const server = asUser(await res.json());
          const next = (await syncPendingProfile(server.id)) ?? withPendingProfile(server);
          if (cancelled) return;
          touchLocalAccount(next);
          setUser(next);
          refreshLocalSession(next);
          return;
        }
        if (res.status === 401 && !local) {
          writeLocalSession(null);
          setUser(null);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    const syncOffline = async () => {
      await syncPendingAccounts();
      const current = readLocalSession();
      const next = current && (await syncPendingProfile(current.id));
      if (next && !cancelled) setUser(next);
    };
    void syncPendingAccounts();
    window.addEventListener("online", syncOffline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", syncOffline);
    };
  }, []);

  // While a cashier has the app open, ping now and then so their admin's Cashiers page shows them as active.
  const cashier = isCashier(user);
  useEffect(() => {
    if (!cashier) return;
    const ping = () => {
      if (document.visibilityState === "visible" && isOnline()) void fetch("/api/auth/me").catch(() => undefined);
    };
    const timer = setInterval(ping, 30_000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [cashier]);

  const login = async (username: string, password: string, remember: boolean) => {
    const normalized = username.trim().toLowerCase();
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: normalized, password, remember }),
      });
      if (apiMissing(res)) throw new Error("api");
      if (res.ok) {
        const next = asUser(await res.json());
        await rememberLocalAccount(next, password);
        writeLocalSession(next, remember);
        setUser(next);
        return null;
      }
      if (res.status !== 401) return errorMessage(res);
      const local = await matchLocalAccount(normalized, password);
      if (!local?.pendingPassword) return errorMessage(res);
      const registered = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: local.id,
          name: local.name,
          username: local.username,
          password,
          remember,
        }),
      });
      if (!registered.ok) return errorMessage(registered);
      const next = asUser(await registered.json());
      await rememberLocalAccount(next, password);
      writeLocalSession(next, remember);
      setUser(next);
      return null;
    } catch {
      const local = await matchLocalAccount(normalized, password);
      if (!local) return "Username or password is incorrect.";
      const next = asUser(local);
      writeLocalSession(next, remember);
      setUser(next);
      return null;
    }
  };

  const register = async (username: string, password: string) => {
    const normalized = username.trim().toLowerCase();
    if (!normalized) return "Enter a username.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    const id = newLocalId();
    // The display name starts as the username; it can be changed later in Account.
    const draft = { id, name: normalized, username: normalized, avatar: "" };
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, password }),
      });
      if (apiMissing(res)) throw new Error("api");
      if (!res.ok) return errorMessage(res);
      const next = asUser(await res.json());
      await rememberLocalAccount(next, password);
      writeLocalSession(next, true);
      setUser(next);
      return null;
    } catch {
      await rememberLocalAccount(draft, password, password);
      writeLocalSession(draft, true);
      setUser(draft);
      return null;
    }
  };

  const join = async (token: string) => {
    try {
      const res = await fetch("/api/auth/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (apiMissing(res)) return "Couldn't reach the server. Connect to the internet and try again.";
      if (!res.ok) return errorMessage(res);
      const next = asUser(await res.json());
      writeLocalSession(next, true);
      setUser(next);
      return null;
    } catch {
      return "Couldn't reach the server. Connect to the internet and try again.";
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // The local session still ends when the device is offline.
    }
    writeLocalSession(null);
    setUser(null);
    router.replace("/login");
  };

  const updateAccount = async (body: AccountUpdate) => {
    if (!user) return "Sign in on this device first.";
    try {
      if (!isOnline()) throw new Error("offline");
      const res = await fetch("/api/auth/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Unsent offline changes go along, so they can't later overwrite this save.
        body: JSON.stringify({ ...readPendingProfile(user.id), ...body }),
      });
      if (apiMissing(res)) throw new Error("api");
      if (res.status === 401) {
        const message = await errorMessage(res);
        if (message === "Sign in required.") {
          writeLocalSession(null);
          setUser(null);
          router.replace("/login");
        }
        return message;
      }
      if (!res.ok) return errorMessage(res);
      writePendingProfile(user.id, null);
      const next = asUser(await res.json());
      if (body.newPassword) await rememberLocalAccount(next, body.newPassword);
      else if (body.currentPassword) await rememberLocalAccount(next, body.currentPassword);
      else touchLocalAccount(next);
      refreshLocalSession(next);
      setUser(next);
      return null;
    } catch {
      // An account the server doesn't know yet is all local: its sign-up sync sends the latest details.
      if (isLocalOnly(user.id)) {
        const updated = await updateLocalAccount(user.id, body);
        if (typeof updated === "string") return updated;
        refreshLocalSession(updated);
        setUser(updated);
        return null;
      }
      // The server checks the current password, so these can't be changed offline.
      if (body.newPassword || body.username.trim().toLowerCase() !== user.username) {
        return "Changing your username or password needs a connection. Your name and photo can be changed offline.";
      }
      const name = body.name.trim();
      if (!name) return "Enter your name.";
      const changes = { ...readPendingProfile(user.id), name, ...(body.avatar === undefined ? {} : { avatar: body.avatar }) };
      writePendingProfile(user.id, changes);
      const next = { ...user, ...changes };
      touchLocalAccount(next);
      refreshLocalSession(next);
      setUser(next);
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ user, ready, login, register, join, logout, updateAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
