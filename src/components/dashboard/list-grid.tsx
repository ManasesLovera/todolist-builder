"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

type ListSummary = {
  id: string;
  title: string;
  description: string | null;
  itemCount: number;
};

export function ListGrid({ initialLists }: { initialLists: ListSummary[] }) {
  const [lists, setLists] = useState<ListSummary[]>(initialLists);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-control border border-status-warning bg-status-warning/10 px-4 py-3 text-sm font-medium text-status-warning-text"
        >
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lists.map((list) =>
          editingId === list.id ? (
            <ListEditCard
              key={list.id}
              list={list}
              onCancel={() => setEditingId(null)}
              onSaved={(updated) => {
                setLists((prev) =>
                  prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)),
                );
                setEditingId(null);
              }}
              onError={setError}
            />
          ) : (
            <ListCard
              key={list.id}
              list={list}
              onEdit={() => setEditingId(list.id)}
              onDelete={async () => {
                if (!window.confirm(`Delete "${list.title}"? This cannot be undone.`)) {
                  return;
                }
                setError(null);
                try {
                  const response = await fetch(`/api/lists/${list.id}`, {
                    method: "DELETE",
                  });
                  if (!response.ok) {
                    const data = await response.json().catch(() => null);
                    setError(data?.error ?? "Unable to delete list.");
                    return;
                  }
                  setLists((prev) => prev.filter((l) => l.id !== list.id));
                } catch {
                  setError("Network error. Please try again.");
                }
              }}
            />
          ),
        )}

        {creating ? (
          <NewListCard
            onCancel={() => setCreating(false)}
            onCreated={(list) => {
              setLists((prev) => [...prev, { ...list, itemCount: 0 }]);
              setCreating(false);
            }}
            onError={setError}
          />
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex min-h-[10rem] flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-border-subtle bg-transparent p-6 text-secondary transition-colors hover:border-brand-primary hover:text-brand-primary"
          >
            <span className="text-2xl leading-none">+</span>
            <span className="text-sm font-medium">New list</span>
          </button>
        )}
      </div>

      {lists.length === 0 && !creating ? (
        <p className="mt-4 text-sm leading-5 text-secondary">
          You don&apos;t have any lists yet — create your first one above.
        </p>
      ) : null}
    </div>
  );
}

function ListCard({
  list,
  onEdit,
  onDelete,
}: {
  list: ListSummary;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex min-h-[10rem] flex-col justify-between rounded-card border border-border-subtle bg-surface p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]">
      <Link href={`/lists/${list.id}`} className="flex-1">
        <h2 className="text-lg font-medium leading-7 text-primary">
          {list.title}
        </h2>
        {list.description ? (
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-secondary">
            {list.description}
          </p>
        ) : null}
        <span className="mt-3 inline-block rounded-full bg-accent-container px-3 py-1 text-xs font-medium text-primary">
          {list.itemCount} {list.itemCount === 1 ? "task" : "tasks"}
        </span>
      </Link>
      <div className="mt-4 flex gap-2">
        <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={onEdit}>
          Edit
        </Button>
        <Button
          variant="danger"
          className="px-3 py-1.5 text-xs"
          onClick={onDelete}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

function NewListCard({
  onCancel,
  onCreated,
  onError,
}: {
  onCancel: () => void;
  onCreated: (list: {
    id: string;
    title: string;
    description: string | null;
  }) => void;
  onError: (message: string | null) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: description || undefined }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        onError(data?.error ?? "Unable to create list.");
        return;
      }
      onCreated(data.list);
    } catch {
      onError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-[10rem] flex-col gap-2 rounded-card border border-border-subtle bg-surface p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]"
    >
      <Label htmlFor="new-list-title">Title</Label>
      <Input
        id="new-list-title"
        autoFocus
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Groceries"
      />
      <Label htmlFor="new-list-description">Description (optional)</Label>
      <Input
        id="new-list-description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="mt-2 flex gap-2">
        <Button type="submit" disabled={submitting} className="px-4 py-2 text-xs">
          {submitting ? "Creating…" : "Create"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="px-4 py-2 text-xs"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ListEditCard({
  list,
  onCancel,
  onSaved,
  onError,
}: {
  list: ListSummary;
  onCancel: () => void;
  onSaved: (list: {
    id: string;
    title: string;
    description: string | null;
  }) => void;
  onError: (message: string | null) => void;
}) {
  const [title, setTitle] = useState(list.title);
  const [description, setDescription] = useState(list.description ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/lists/${list.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: description || null }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        onError(data?.error ?? "Unable to update list.");
        return;
      }
      onSaved(data.list);
    } catch {
      onError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-[10rem] flex-col gap-2 rounded-card border border-border-subtle bg-surface p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]"
    >
      <Label htmlFor={`edit-title-${list.id}`}>Title</Label>
      <Input
        id={`edit-title-${list.id}`}
        autoFocus
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Label htmlFor={`edit-description-${list.id}`}>Description</Label>
      <Input
        id={`edit-description-${list.id}`}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="mt-2 flex gap-2">
        <Button type="submit" disabled={submitting} className="px-4 py-2 text-xs">
          {submitting ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="px-4 py-2 text-xs"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
