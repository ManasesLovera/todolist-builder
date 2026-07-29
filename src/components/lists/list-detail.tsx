"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Item = {
  id: string;
  title: string;
  isComplete: boolean;
  dueDate: string | null;
};

type ListMeta = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
};

/**
 * Detail split view per DESIGN.md Section 6.2: left 65% task list (entry bar
 * + interactive rows), right 35% metadata panel on bg-accent-container.
 */
export function ListDetail({
  list,
  initialItems,
}: {
  list: ListMeta;
  initialItems: Item[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(initialItems);
  const [description, setDescription] = useState(list.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAddItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newTitle.trim()) return;
    setError(null);
    setAdding(true);
    try {
      // BUG (BUGS.md #11 timezone-naive due dates -- write path): the date
      // input gives a bare "YYYY-MM-DD" string. `new Date(...)` on a
      // date-only string parses it as UTC midnight (per the ECMA-262 date
      // string spec), not local midnight. That's stored as-is. See the read
      // path in TaskRow below, which formats with the *browser's local*
      // timezone -- for any timezone behind UTC, a date entered as "today"
      // comes back as "yesterday".
      const dueDate = newDueDate ? new Date(newDueDate).toISOString() : null;
      const response = await fetch(`/api/lists/${list.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, dueDate }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to add item.");
        return;
      }
      setItems((prev) => [...prev, data.item]);
      setNewTitle("");
      setNewDueDate("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function toggleComplete(item: Item) {
    setError(null);
    const previous = items;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isComplete: !i.isComplete } : i)),
    );
    try {
      const response = await fetch(`/api/lists/${list.id}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isComplete: !item.isComplete }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Unable to update item.");
        setItems(previous);
      }
    } catch {
      setError("Network error. Please try again.");
      setItems(previous);
    }
  }

  async function renameItem(item: Item, title: string) {
    if (!title.trim() || title === item.title) return;
    setError(null);
    try {
      const response = await fetch(`/api/lists/${list.id}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to update item.");
        return;
      }
      setItems((prev) => prev.map((i) => (i.id === item.id ? data.item : i)));
    } catch {
      setError("Network error. Please try again.");
    }
  }

  async function deleteItem(item: Item) {
    setError(null);
    try {
      const response = await fetch(`/api/lists/${list.id}/items/${item.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Unable to delete item.");
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch {
      setError("Network error. Please try again.");
    }
  }

  async function saveDescription() {
    setError(null);
    try {
      const response = await fetch(`/api/lists/${list.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description || null }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Unable to update description.");
      }
    } catch {
      setError("Network error. Please try again.");
    }
  }

  async function deleteList() {
    if (!window.confirm(`Delete "${list.title}"? This cannot be undone.`)) {
      return;
    }
    setError(null);
    try {
      const response = await fetch(`/api/lists/${list.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Unable to delete list.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    }
  }

  const completedCount = items.filter((i) => i.isComplete).length;

  return (
    <div>
      <h1 className="text-4xl font-bold leading-[2.5rem] text-primary">
        {list.title}
      </h1>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-control border border-status-warning bg-status-warning/10 px-4 py-3 text-sm font-medium text-status-warning-text"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        {/* Left column: 65% - task list */}
        <div className="rounded-card border border-border-subtle bg-surface p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] lg:w-[65%]">
          <form onSubmit={handleAddItem} className="flex gap-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Add a task…"
              aria-label="New task title"
            />
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              aria-label="Due date"
              className="rounded-control border border-border-subtle bg-surface px-3 py-2 text-sm text-primary outline-none focus:border-2 focus:border-primary"
            />
            <Button type="submit" disabled={adding} className="whitespace-nowrap">
              {adding ? "Adding…" : "Add"}
            </Button>
          </form>

          <ul className="mt-4 flex flex-col divide-y divide-border-subtle">
            {items.map((item) => (
              <TaskRow
                key={item.id}
                item={item}
                onToggle={() => toggleComplete(item)}
                onRename={(title) => renameItem(item, title)}
                onDelete={() => deleteItem(item)}
              />
            ))}
          </ul>

          {items.length === 0 ? (
            <p className="mt-4 text-sm leading-5 text-secondary">
              No tasks yet — add your first one above.
            </p>
          ) : null}
        </div>

        {/* Right column: 35% - metadata panel */}
        <div className="rounded-card border border-border-subtle bg-accent-container p-6 lg:w-[35%]">
          <h2 className="text-lg font-medium leading-7 text-primary">Details</h2>

          <dl className="mt-4 space-y-3 text-sm leading-5 text-primary">
            <div>
              <dt className="font-medium">Created</dt>
              <dd className="text-secondary">
                {new Date(list.createdAt).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Progress</dt>
              <dd className="text-secondary">
                {completedCount} of {items.length} tasks complete
              </dd>
            </div>
          </dl>

          <div className="mt-4">
            <label htmlFor="list-description" className="mb-1.5 block text-sm font-medium text-primary">
              Description
            </label>
            <textarea
              id="list-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={saveDescription}
              rows={4}
              className="w-full rounded-control border border-border-subtle bg-surface px-4 py-3 text-sm text-primary outline-none focus:border-2 focus:border-primary"
              placeholder="Add a description…"
            />
          </div>

          <Button
            variant="danger"
            className="mt-6 w-full bg-surface"
            onClick={deleteList}
          >
            Delete list
          </Button>
        </div>
      </div>
    </div>
  );
}

function TaskRow({
  item,
  onToggle,
  onRename,
  onDelete,
}: {
  item: Item;
  onToggle: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);

  return (
    <li className="flex items-center gap-3 py-3">
      <input
        type="checkbox"
        checked={item.isComplete}
        onChange={onToggle}
        aria-label={`Mark "${item.title}" ${item.isComplete ? "incomplete" : "complete"}`}
        className="h-4 w-4 shrink-0 accent-brand-primary"
      />

      {editing ? (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            setEditing(false);
            onRename(title);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              setTitle(item.title);
              setEditing(false);
            }
          }}
          className="flex-1 rounded-control border border-border-subtle bg-surface px-2 py-1 text-sm text-primary outline-none focus:border-2 focus:border-primary"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`flex-1 truncate text-left text-sm leading-5 ${
            item.isComplete ? "text-secondary line-through" : "text-primary"
          }`}
        >
          {item.title}
        </button>
      )}

      {item.dueDate ? (
        // BUG (BUGS.md #11 timezone-naive due dates -- read path): formats
        // the stored UTC-midnight instant using the *browser's local*
        // timezone via toLocaleDateString(). Combined with the write path
        // in handleAddItem above (which stores date-only input as UTC
        // midnight), any timezone behind UTC displays one day earlier than
        // what was entered -- e.g. pick "today", see "yesterday" here.
        <span className="shrink-0 text-xs leading-5 text-secondary">
          {new Date(item.dueDate).toLocaleDateString()}
        </span>
      ) : null}

      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete "${item.title}"`}
        className="shrink-0 text-secondary transition-colors hover:text-red-600"
      >
        ✕
      </button>
    </li>
  );
}
