"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";

interface Invite {
  username: string;
  store: string;
}

/**
 * Where a cashier lands from the sign-in link or QR code their admin shared. Signing in takes a tap, not a page load,
 * so link previews and scanners can't use up the one-time link.
 */
export default function JoinPage() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const { join } = useAuth();
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined);
  const [problem, setProblem] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/auth/invite/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok) return setInvite(body);
        setProblem(typeof body?.message === "string" ? body.message : "This link isn't working. Ask your admin for a new one.");
        setInvite(null);
      })
      .catch(() => {
        if (cancelled) return;
        setProblem("Couldn't reach the server. Connect to the internet and try again.");
        setInvite(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const signIn = async () => {
    setError("");
    setPending(true);
    const message = await join(token);
    setPending(false);
    if (message) setError(message);
    else router.replace("/orders");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <img src="/icon-light.png" alt="" width={32} height={32} className="size-8 dark:invert" />
          OpenTill
        </h1>
        {invite === undefined ? (
          <p className="mt-1 text-sm text-muted-foreground">Checking your link…</p>
        ) : invite === null ? (
          <p role="alert" className="mt-4 text-sm text-destructive">{problem}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="mt-1 text-sm text-muted-foreground">
              Hi {invite.username}! Sign in to start working{invite.store ? ` at ${invite.store}` : ""}.
            </p>
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <Button onClick={() => void signIn()} disabled={pending}>
              {pending ? "Please wait" : `Sign in as ${invite.username}`}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
