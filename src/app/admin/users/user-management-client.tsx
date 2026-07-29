"use client";

import { useState } from "react";

type Role = "ADMIN" | "MEMBER";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  listCount: number;
};

type CreateUserForm = {
  name: string;
  email: string;
  role: Role;
  password: string;
};

const emptyForm: CreateUserForm = {
  name: "",
  email: "",
  role: "MEMBER",
  password: "",
};

export function UserManagementClient({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserRow[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState<CreateUserForm>(emptyForm);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<{
    userId: string;
    userEmail: string;
    password: string;
  } | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) {
        setCreateError(body.error ?? "Failed to create user");
        return;
      }
      const created = body.user;
      setUsers((prev) => [
        ...prev,
        {
          id: created.id,
          name: created.name,
          email: created.email,
          role: created.role,
          createdAt: created.createdAt,
          listCount: 0,
        },
      ]);
      setForm(emptyForm);
      setShowCreateForm(false);
    } catch {
      setCreateError("Network error — please try again");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) {
        setDeleteError(body.error ?? "Failed to delete user");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setConfirmingDeleteId(null);
    } catch {
      setDeleteError("Network error — please try again");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleGeneratePassword(user: UserRow) {
    setGeneratingId(user.id);
    setGenerateError(null);
    try {
      const res = await fetch(
        `/api/admin/users/${user.id}/generate-password`,
        { method: "POST" },
      );
      const body = await res.json();
      if (!res.ok) {
        setGenerateError(body.error ?? "Failed to generate password");
        return;
      }
      setGeneratedPassword({
        userId: user.id,
        userEmail: user.email,
        password: body.password,
      });
    } catch {
      setGenerateError("Network error — please try again");
    } finally {
      setGeneratingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold leading-8 text-primary">
          Users
        </h2>
        <button
          type="button"
          onClick={() => {
            setShowCreateForm((v) => !v);
            setCreateError(null);
          }}
          className="rounded-control bg-brand-primary px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          {showCreateForm ? "Cancel" : "New User"}
        </button>
      </div>

      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-4 rounded-card border border-border-subtle bg-surface p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]"
        >
          {createError && (
            <p className="rounded-control bg-status-warning/20 px-4 py-2 text-sm text-status-warning-text">
              {createError}
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name">
              <input
                required
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                className="w-full rounded-control border border-border-subtle bg-surface px-4 py-3 text-sm text-primary focus:border-2 focus:border-primary focus:outline-none"
              />
            </Field>
            <Field label="Email">
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                className="w-full rounded-control border border-border-subtle bg-surface px-4 py-3 text-sm text-primary focus:border-2 focus:border-primary focus:outline-none"
              />
            </Field>
            <Field label="Role">
              <select
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({ ...f, role: e.target.value as Role }))
                }
                className="w-full rounded-control border border-border-subtle bg-surface px-4 py-3 text-sm text-primary focus:border-2 focus:border-primary focus:outline-none"
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
            </Field>
            <Field label="Initial Password">
              <input
                required
                type="text"
                minLength={8}
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                className="w-full rounded-control border border-border-subtle bg-surface px-4 py-3 text-sm text-primary focus:border-2 focus:border-primary focus:outline-none"
              />
            </Field>
          </div>
          <div>
            <button
              type="submit"
              disabled={creating}
              className="rounded-control bg-brand-primary px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create User"}
            </button>
          </div>
        </form>
      )}

      {deleteError && (
        <p className="rounded-control bg-status-warning/20 px-4 py-2 text-sm text-status-warning-text">
          {deleteError}
        </p>
      )}
      {generateError && (
        <p className="rounded-control bg-status-warning/20 px-4 py-2 text-sm text-status-warning-text">
          {generateError}
        </p>
      )}

      {generatedPassword && (
        <div className="flex flex-col gap-2 rounded-card border border-border-subtle bg-accent-container p-6">
          <p className="text-sm font-semibold text-primary">
            New password for {generatedPassword.userEmail}
          </p>
          <p className="text-xs text-secondary">
            This password is shown only once — copy it now and hand it to the
            user. It cannot be retrieved again after you close this.
          </p>
          <code className="w-fit rounded-control bg-surface px-4 py-2 font-mono text-sm text-primary">
            {generatedPassword.password}
          </code>
          <div>
            <button
              type="button"
              onClick={() => setGeneratedPassword(null)}
              className="rounded-control border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-surface"
            >
              Done — I copied it
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-card border border-border-subtle bg-surface shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="bg-border-subtle">
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Lists</Th>
              <Th>Created</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3 text-primary">{user.name}</td>
                <td className="px-4 py-3 text-primary">{user.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      user.role === "ADMIN"
                        ? "rounded-full bg-status-warning px-3 py-1 text-xs font-medium text-status-warning-text"
                        : "rounded-full bg-accent-container px-3 py-1 text-xs font-medium text-primary"
                    }
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-primary">{user.listCount}</td>
                <td className="px-4 py-3 text-secondary">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  {confirmingDeleteId === user.id ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs text-status-warning-text">
                        Delete {user.email}
                        {user.listCount > 0
                          ? ` and their ${user.listCount} list(s)?`
                          : "?"}{" "}
                        This cannot be undone.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={deletingId === user.id}
                          onClick={() => handleDelete(user.id)}
                          className="rounded-control bg-brand-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          {deletingId === user.id
                            ? "Deleting…"
                            : "Confirm Delete"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteId(null)}
                          className="rounded-control border border-primary px-3 py-1.5 text-xs font-medium text-primary"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={generatingId === user.id}
                        onClick={() => handleGeneratePassword(user)}
                        className="rounded-control border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-accent-container disabled:opacity-50"
                      >
                        {generatingId === user.id
                          ? "Generating…"
                          : "Generate Password"}
                      </button>
                      <button
                        type="button"
                        disabled={user.id === currentUserId}
                        title={
                          user.id === currentUserId
                            ? "You cannot delete your own account"
                            : undefined
                        }
                        onClick={() => setConfirmingDeleteId(user.id)}
                        className="rounded-control border border-status-warning-text px-3 py-1.5 text-xs font-medium text-status-warning-text hover:bg-status-warning/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-primary">
      {children}
    </th>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-secondary">{label}</span>
      {children}
    </label>
  );
}
