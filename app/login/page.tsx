"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, check, clearError, invalid } from "@/components/FieldError";
import { PasswordInput } from "@/components/PasswordInput";
import { collect, passwordError, required, usernameError, type FieldErrors } from "@/lib/validation";

export default function LoginPage() {
  const router = useRouter();
  const { user, ready, login, register } = useAuth();
  const [creating, setCreating] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  const continueToRequestedPage = () => {
    const next = sessionStorage.getItem("opentill_after_login") ?? "/";
    sessionStorage.removeItem("opentill_after_login");
    return next.startsWith("/") && !next.startsWith("//") ? next : "/";
  };

  useEffect(() => {
    if (ready && user) router.replace(continueToRequestedPage());
    // This redirect only follows auth readiness; the helper reads session storage at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const ok = check(
      collect(
        creating
          ? { username: usernameError(username), password: passwordError(password) }
          : { username: required(username, "Enter your username."), password: required(password, "Enter your password.") }
      ),
      setErrors
    );
    if (!ok) return;
    setPending(true);
    const message = creating
      ? await register(username, password)
      : await login(username, password, remember);
    setPending(false);
    if (message) {
      setError(message);
      return;
    }
    router.replace(continueToRequestedPage());
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
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="username" required>Username</Label>
            <Input
              id="username"
              {...invalid(errors, "username")}
              autoComplete="username"
              value={username}
              onChange={(event) => {
                clearError(setErrors, "username");
                setUsername(event.target.value);
              }}
            />
            <FieldError errors={errors} id="username" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password" required>Password</Label>
            <PasswordInput
              id="password"
              {...invalid(errors, "password")}
              autoComplete={creating ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => {
                clearError(setErrors, "password");
                setPassword(event.target.value);
              }}
            />
            <FieldError errors={errors} id="password" />
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
        <p className="mt-4 text-sm text-muted-foreground">
          {creating ? "Already have an account?" : "New here?"}{" "}
          <button
            type="button"
            className="cursor-pointer font-medium text-foreground underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
            onClick={() => {
              setCreating((value) => !value);
              setError("");
              setErrors({});
            }}
          >
            {creating ? "Sign in" : "Create an account"}
          </button>
        </p>
      </div>
    </main>
  );
}
