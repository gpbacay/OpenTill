"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { EyeIcon, EyeOffIcon } from "@hugeicons/core-free-icons";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const { user, ready, login, register } = useAuth();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace("/");
  }, [ready, user, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");
    const message = creating
      ? await register(name, username, password)
      : await login(username, password, remember);
    setPending(false);
    if (message) {
      setError(message);
      return;
    }
    router.replace("/");
  };

  if (!ready || user) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <img src="/icon-light.png" alt="" width={32} height={32} className="size-8 dark:invert" />
          OpenTill
        </h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          {creating ? "Create an account on this device." : "Sign in on this device."}
        </p>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          {creating ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={creating ? "new-password" : "current-password"}
                className="pr-8"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((value) => !value)}
              >
                <HugeiconsIcon icon={showPassword ? EyeOffIcon : EyeIcon} size={16} />
              </button>
            </div>
          </div>
          {!creating ? (
            <div className="flex items-center gap-2">
              <input
                id="remember-me"
                type="checkbox"
                checked={remember}
                className="size-4 cursor-pointer accent-primary"
                onChange={(event) => setRemember(event.target.checked)}
              />
              <Label htmlFor="remember-me" className="cursor-pointer font-normal">
                Remember me
              </Label>
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Please wait" : creating ? "Create account" : "Sign in"}
          </Button>
        </form>
        <button
          type="button"
          className="mt-4 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => {
            setCreating((value) => !value);
            setError("");
          }}
        >
          {creating ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </div>
    </main>
  );
}
