"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { PencilEdit01Icon } from "@hugeicons/core-free-icons";
import { useAuth } from "@/contexts/auth-context";
import { isCashier } from "@/lib/local-auth";
import { useOnline } from "@/lib/offline";
import { ImagePicker } from "@/components/ImagePicker";
import { LogoutButton } from "@/components/LogoutButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, check, clearError, invalid } from "@/components/FieldError";
import { collect, maxLength, passwordError, required, usernameError, type FieldErrors } from "@/lib/validation";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AccountPage() {
  const { user, updateAccount } = useAuth();
  const online = useOnline();
  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [photoError, setPhotoError] = useState("");
  const [photoPending, setPhotoPending] = useState(false);
  const [editing, setEditing] = useState(false);

  if (!user) return null;
  // A cashier's username and password belong to their admin.
  const locked = isCashier(user);

  const changePhoto = async (avatar: string) => {
    setPhotoPending(true);
    setPhotoError("");
    const message = await updateAccount({ name: user.name, username: user.username, avatar });
    setPhotoPending(false);
    if (message) setPhotoError(message);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaved(false);
    setError("");
    const usernameChanged = username.trim().toLowerCase() !== user.username;
    const ok = check(
      collect({
        "account-name": required(name, "Enter your name.") ?? maxLength(name, 60, "Your name"),
        // Existing usernames keep working; the format rule only applies to a new one.
        "account-username": usernameChanged ? usernameError(username) : undefined,
        "current-password":
          (usernameChanged || newPassword) && !currentPassword ? "Enter your current password to change your username or password." : undefined,
        "new-password": newPassword ? passwordError(newPassword) : undefined,
      }),
      setErrors
    );
    if (!ok) return;
    setPending(true);
    const message = await updateAccount({
      name,
      username,
      currentPassword: currentPassword || undefined,
      newPassword: newPassword || undefined,
    });
    setPending(false);
    if (message) {
      setError(message);
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setSaved(true);
    setEditing(false);
  };

  const cancel = () => {
    setName(user.name);
    setUsername(user.username);
    setCurrentPassword("");
    setNewPassword("");
    setError("");
    setErrors({});
    setEditing(false);
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col gap-8 overflow-y-auto py-6">
      <div className="space-y-2">
        <ImagePicker
          label={user.name}
          value={user.avatar ?? ""}
          onChange={(avatar) => void changePhoto(avatar)}
          max={192}
          round
          disabled={photoPending || !editing}
          fallback={<span className="text-xl font-semibold text-foreground">{initials(user.name) || "OT"}</span>}
        />
        <p className="text-sm text-muted-foreground">
          {photoPending ? "Saving photo…" : `Signed in as ${user.username}. Your photo shows in the menu.`}
        </p>
        {photoError ? <p className="text-sm text-destructive">{photoError}</p> : null}
      </div>
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Account details</h2>
          {editing ? null : (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label="Edit account details"
              title="Edit account details"
              onClick={() => {
                setSaved(false);
                setEditing(true);
              }}
            >
              <HugeiconsIcon icon={PencilEdit01Icon} size={16} />
            </Button>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="account-name" required>Name</Label>
          <Input
            id="account-name"
            {...invalid(errors, "account-name")}
            readOnly={!editing}
            value={name}
            onChange={(event) => {
              clearError(setErrors, "account-name");
              setName(event.target.value);
            }}
          />
          <FieldError errors={errors} id="account-name" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="account-username" required>Username</Label>
          <Input
            id="account-username"
            {...invalid(errors, "account-username")}
            autoComplete="username"
            readOnly={locked || !editing}
            value={username}
            onChange={(event) => {
              clearError(setErrors, "account-username");
              setUsername(event.target.value);
            }}
          />
          <FieldError errors={errors} id="account-username" />
        </div>
        {!editing ? null : locked ? (
          <p className="text-sm text-muted-foreground">Your admin manages your username and password. Ask them to change either.</p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                {...invalid(errors, "current-password")}
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => {
                  clearError(setErrors, "current-password");
                  setCurrentPassword(event.target.value);
                }}
              />
              <FieldError errors={errors} id="current-password" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                {...invalid(errors, "new-password")}
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => {
                  clearError(setErrors, "new-password");
                  setNewPassword(event.target.value);
                }}
              />
              <FieldError errors={errors} id="new-password" />
            </div>
            {online ? null : (
              <p className="text-sm text-muted-foreground">You're offline. Your name and photo still save; changing your username or password needs a connection.</p>
            )}
          </>
        )}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {saved ? (
          <p className="text-sm text-muted-foreground">{online ? "Saved." : "Saved on this device. It syncs when you're back online."}</p>
        ) : null}
        {editing ? (
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" disabled={pending} onClick={cancel}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={pending}>
              {pending ? "Saving" : "Save"}
            </Button>
          </div>
        ) : null}
      </form>
      <LogoutButton>
        <Button variant="ghost" className="self-start">
          Log out
        </Button>
      </LogoutButton>
    </div>
  );
}
