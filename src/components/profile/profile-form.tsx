"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function ProfileForm({
  initialName,
  initialEmail,
  role,
}: {
  initialName: string;
  initialEmail: string;
  role: "ADMIN" | "MEMBER";
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    const payload: Record<string, string> = {};
    if (name !== initialName) payload.name = name;
    if (email !== initialEmail) payload.email = email;
    if (newPassword) {
      payload.newPassword = newPassword;
      payload.currentPassword = currentPassword;
    }

    if (Object.keys(payload).length === 0) {
      setSubmitting(false);
      setError("Nothing to update.");
      return;
    }

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? "Unable to update profile.");
        return;
      }

      setSuccess("Profile updated.");
      setCurrentPassword("");
      setNewPassword("");
      router.refresh();
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {error ? (
        <p
          role="alert"
          className="rounded-control border border-status-warning bg-status-warning/10 px-4 py-3 text-sm font-medium text-status-warning-text"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          role="status"
          className="rounded-control border border-border-subtle bg-accent-container/40 px-4 py-3 text-sm font-medium text-primary"
        >
          {success}
        </p>
      ) : null}

      <div>
        <Label htmlFor="role">Role</Label>
        <Input id="role" value={role} disabled readOnly />
      </div>

      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="border-t border-border-subtle pt-5">
        <h2 className="text-lg font-medium leading-7 text-primary">
          Change password
        </h2>
        <p className="mt-1 text-sm leading-5 text-secondary">
          Leave blank to keep your current password.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          <div>
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={submitting} className="mt-2 w-full">
        {submitting ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
