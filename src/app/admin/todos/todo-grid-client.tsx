"use client";

import { useMemo, useState } from "react";

type Owner = { id: string; name: string; email: string };

type ItemData = {
  id: string;
  title: string;
  isComplete: boolean;
  position: number;
  dueDate: string | null;
  createdAt: string;
};

type ListData = {
  id: string;
  title: string;
  description: string | null;
  owner: Owner;
  items: ItemData[];
};

type SortColumn = "default" | "owner" | "list" | "title" | "status" | "dueDate";
type SortDir = "asc" | "desc";

type FlatRow = {
  listId: string;
  listTitle: string;
  owner: Owner;
  item: ItemData;
};

const DOT_ICON = (
  <svg viewBox="0 0 8 20" className="h-5 w-2" aria-hidden="true">
    {[2, 8, 14].map((cy) => (
      <circle key={cy} cx="4" cy={cy} r="1.5" fill="currentColor" />
    ))}
  </svg>
);

export function TodoGridClient({
  initialLists,
}: {
  initialLists: ListData[];
}) {
  const [lists, setLists] = useState<ListData[]>(initialLists);
  const [sortColumn, setSortColumn] = useState<SortColumn>("default");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [filters, setFilters] = useState({
    owner: "",
    list: "",
    title: "",
    status: "all" as "all" | "complete" | "incomplete",
  });

  const [error, setError] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{
    itemId: string;
    field: "title" | "dueDate";
  } | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [confirmingDeleteItemId, setConfirmingDeleteItemId] = useState<
    string | null
  >(null);
  const [confirmingDeleteListId, setConfirmingDeleteListId] = useState<
    string | null
  >(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  const filtersActive =
    filters.owner !== "" ||
    filters.list !== "" ||
    filters.title !== "" ||
    filters.status !== "all";
  const dragEnabled = sortColumn === "default" && !filtersActive;

  function reportError(message: string) {
    setError(message);
  }

  async function patchItem(itemId: string, data: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/admin/todos/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) {
        reportError(body.error ?? "Failed to update item");
        return null;
      }
      return body.item as ItemData;
    } catch {
      reportError("Network error — please try again");
      return null;
    }
  }

  function updateLocalItem(itemId: string, patch: Partial<ItemData>) {
    setLists((prev) =>
      prev.map((list) => ({
        ...list,
        items: list.items.map((item) =>
          item.id === itemId ? { ...item, ...patch } : item,
        ),
      })),
    );
  }

  async function handleTitleCommit(itemId: string, value: string) {
    setEditingCell(null);
    if (value.trim().length === 0) {
      reportError("Title cannot be empty");
      return;
    }
    const updated = await patchItem(itemId, { title: value.trim() });
    if (updated) updateLocalItem(itemId, { title: updated.title });
  }

  async function handleDueDateCommit(itemId: string, value: string) {
    setEditingCell(null);
    const updated = await patchItem(itemId, {
      dueDate: value === "" ? null : value,
    });
    if (updated) updateLocalItem(itemId, { dueDate: updated.dueDate });
  }

  async function handleToggleComplete(itemId: string, next: boolean) {
    updateLocalItem(itemId, { isComplete: next });
    const updated = await patchItem(itemId, { isComplete: next });
    if (!updated) updateLocalItem(itemId, { isComplete: !next });
  }

  async function handleDeleteItem(itemId: string, listId: string) {
    try {
      const res = await fetch(`/api/admin/todos/items/${itemId}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) {
        reportError(body.error ?? "Failed to delete item");
        return;
      }
      setLists((prev) =>
        prev.map((list) =>
          list.id === listId
            ? { ...list, items: list.items.filter((i) => i.id !== itemId) }
            : list,
        ),
      );
      setConfirmingDeleteItemId(null);
    } catch {
      reportError("Network error — please try again");
    }
  }

  async function handleDeleteList(listId: string) {
    try {
      const res = await fetch(`/api/admin/todos/lists/${listId}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) {
        reportError(body.error ?? "Failed to delete list");
        return;
      }
      setLists((prev) => prev.filter((l) => l.id !== listId));
      setConfirmingDeleteListId(null);
    } catch {
      reportError("Network error — please try again");
    }
  }

  async function handleListTitleCommit(listId: string, value: string) {
    setEditingListId(null);
    if (value.trim().length === 0) {
      reportError("List title cannot be empty");
      return;
    }
    try {
      const res = await fetch(`/api/admin/todos/lists/${listId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: value.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        reportError(body.error ?? "Failed to update list");
        return;
      }
      setLists((prev) =>
        prev.map((l) =>
          l.id === listId ? { ...l, title: body.list.title } : l,
        ),
      );
    } catch {
      reportError("Network error — please try again");
    }
  }

  async function handleDrop(listId: string, targetItemId: string) {
    if (!draggedItemId || draggedItemId === targetItemId) {
      setDraggedItemId(null);
      return;
    }
    const list = lists.find((l) => l.id === listId);
    if (!list) return;
    const sourceIndex = list.items.findIndex((i) => i.id === draggedItemId);
    if (sourceIndex === -1) {
      // Dragged item isn't in this list — cross-list drag isn't supported.
      setDraggedItemId(null);
      return;
    }
    const targetIndex = list.items.findIndex((i) => i.id === targetItemId);
    const reordered = [...list.items];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    setLists((prev) =>
      prev.map((l) => (l.id === listId ? { ...l, items: reordered } : l)),
    );
    setDraggedItemId(null);

    try {
      const res = await fetch(`/api/admin/todos/lists/${listId}/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderedItemIds: reordered.map((i) => i.id),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        reportError(body.error ?? "Failed to save new order");
      }
    } catch {
      reportError("Network error — please try again");
    }
  }

  function toggleSort(column: Exclude<SortColumn, "default">) {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortColumn("default");
      setSortDir("asc");
    }
  }

  const flatRows: FlatRow[] = useMemo(() => {
    const rows: FlatRow[] = [];
    for (const list of lists) {
      for (const item of list.items) {
        rows.push({ listId: list.id, listTitle: list.title, owner: list.owner, item });
      }
    }
    return rows;
  }, [lists]);

  const filteredSortedRows: FlatRow[] = useMemo(() => {
    let rows = flatRows.filter((row) => {
      if (
        filters.owner &&
        !`${row.owner.name} ${row.owner.email}`
          .toLowerCase()
          .includes(filters.owner.toLowerCase())
      )
        return false;
      if (
        filters.list &&
        !row.listTitle.toLowerCase().includes(filters.list.toLowerCase())
      )
        return false;
      if (
        filters.title &&
        !row.item.title.toLowerCase().includes(filters.title.toLowerCase())
      )
        return false;
      if (filters.status === "complete" && !row.item.isComplete) return false;
      if (filters.status === "incomplete" && row.item.isComplete) return false;
      return true;
    });

    if (sortColumn !== "default") {
      rows = [...rows].sort((a, b) => {
        let cmp = 0;
        switch (sortColumn) {
          case "owner":
            cmp = a.owner.name.localeCompare(b.owner.name);
            break;
          case "list":
            cmp = a.listTitle.localeCompare(b.listTitle);
            break;
          case "title":
            cmp = a.item.title.localeCompare(b.item.title);
            break;
          case "status":
            cmp = Number(a.item.isComplete) - Number(b.item.isComplete);
            break;
          case "dueDate":
            cmp =
              (a.item.dueDate ? Date.parse(a.item.dueDate) : Infinity) -
              (b.item.dueDate ? Date.parse(b.item.dueDate) : Infinity);
            break;
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return rows;
  }, [flatRows, filters, sortColumn, sortDir]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold leading-8 text-primary">
          All ToDo Lists &amp; Items
        </h2>
        {!dragEnabled && (
          <p className="text-xs text-secondary">
            Drag-to-reorder is available in the default view with no sort or
            filters applied.
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-control bg-status-warning/20 px-4 py-2 text-sm text-status-warning-text">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-card border border-border-subtle bg-surface shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="bg-border-subtle">
              <th className="w-8 px-2 py-3" aria-hidden="true" />
              <SortableTh
                label="Owner"
                active={sortColumn === "owner"}
                dir={sortDir}
                onClick={() => toggleSort("owner")}
              />
              <SortableTh
                label="List"
                active={sortColumn === "list"}
                dir={sortDir}
                onClick={() => toggleSort("list")}
              />
              <SortableTh
                label="Title"
                active={sortColumn === "title"}
                dir={sortDir}
                onClick={() => toggleSort("title")}
              />
              <SortableTh
                label="Status"
                active={sortColumn === "status"}
                dir={sortDir}
                onClick={() => toggleSort("status")}
              />
              <SortableTh
                label="Due Date"
                active={sortColumn === "dueDate"}
                dir={sortDir}
                onClick={() => toggleSort("dueDate")}
              />
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-primary">
                Actions
              </th>
            </tr>
            <tr className="bg-border-subtle/60">
              <th className="px-2 py-2" aria-hidden="true" />
              <th className="px-4 py-2">
                <FilterInput
                  placeholder="Filter owner…"
                  value={filters.owner}
                  onChange={(v) => setFilters((f) => ({ ...f, owner: v }))}
                />
              </th>
              <th className="px-4 py-2">
                <FilterInput
                  placeholder="Filter list…"
                  value={filters.list}
                  onChange={(v) => setFilters((f) => ({ ...f, list: v }))}
                />
              </th>
              <th className="px-4 py-2">
                <FilterInput
                  placeholder="Filter title…"
                  value={filters.title}
                  onChange={(v) => setFilters((f) => ({ ...f, title: v }))}
                />
              </th>
              <th className="px-4 py-2">
                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      status: e.target.value as typeof filters.status,
                    }))
                  }
                  className="w-full rounded-control border border-border-subtle bg-surface px-2 py-1 text-xs text-primary"
                >
                  <option value="all">All</option>
                  <option value="complete">Complete</option>
                  <option value="incomplete">Incomplete</option>
                </select>
              </th>
              <th className="px-4 py-2" aria-hidden="true" />
              <th className="px-4 py-2" aria-hidden="true" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {filteredSortedRows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-secondary"
                >
                  No items match the current filters.
                </td>
              </tr>
            )}
            {filteredSortedRows.map((row) => (
              <tr
                key={row.item.id}
                className="group"
                draggable={dragEnabled}
                onDragStart={() => setDraggedItemId(row.item.id)}
                onDragOver={(e) => dragEnabled && e.preventDefault()}
                onDrop={() => dragEnabled && handleDrop(row.listId, row.item.id)}
              >
                <td className="px-2 py-3 text-secondary">
                  {dragEnabled && (
                    <span
                      className="invisible cursor-grab group-hover:visible"
                      aria-label="Drag to reorder"
                    >
                      {DOT_ICON}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-primary">
                  <div className="font-medium">{row.owner.name}</div>
                  <div className="text-xs text-secondary">
                    {row.owner.email}
                  </div>
                </td>
                <td className="px-4 py-3 text-primary">
                  {editingListId === row.listId ? (
                    <input
                      autoFocus
                      defaultValue={row.listTitle}
                      onBlur={(e) =>
                        handleListTitleCommit(row.listId, e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setEditingListId(null);
                      }}
                      className="w-full rounded-control border border-primary bg-surface px-2 py-1 text-sm text-primary"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingListId(row.listId)}
                      className="text-left hover:underline"
                    >
                      {row.listTitle}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-primary">
                  {editingCell?.itemId === row.item.id &&
                  editingCell.field === "title" ? (
                    <input
                      autoFocus
                      defaultValue={row.item.title}
                      onBlur={(e) =>
                        handleTitleCommit(row.item.id, e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setEditingCell(null);
                      }}
                      className="w-full rounded-control border border-primary bg-surface px-2 py-1 text-sm text-primary"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setEditingCell({ itemId: row.item.id, field: "title" })
                      }
                      className={
                        row.item.isComplete
                          ? "text-left text-secondary line-through hover:underline"
                          : "text-left hover:underline"
                      }
                    >
                      {row.item.title}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={row.item.isComplete}
                    onChange={(e) =>
                      handleToggleComplete(row.item.id, e.target.checked)
                    }
                    className="h-4 w-4"
                  />
                </td>
                <td className="px-4 py-3 text-primary">
                  {editingCell?.itemId === row.item.id &&
                  editingCell.field === "dueDate" ? (
                    <input
                      autoFocus
                      type="date"
                      defaultValue={row.item.dueDate?.slice(0, 10) ?? ""}
                      onBlur={(e) =>
                        handleDueDateCommit(row.item.id, e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setEditingCell(null);
                      }}
                      className="rounded-control border border-primary bg-surface px-2 py-1 text-sm text-primary"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setEditingCell({
                          itemId: row.item.id,
                          field: "dueDate",
                        })
                      }
                      className="text-left hover:underline"
                    >
                      {row.item.dueDate
                        ? new Date(row.item.dueDate).toLocaleDateString()
                        : "—"}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  {confirmingDeleteItemId === row.item.id ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteItem(row.item.id, row.listId)
                        }
                        className="rounded-control bg-brand-primary px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteItemId(null)}
                        className="rounded-control border border-primary px-3 py-1.5 text-xs font-medium text-primary"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteItemId(row.item.id)}
                      className="rounded-control border border-status-warning-text px-3 py-1.5 text-xs font-medium text-status-warning-text hover:bg-status-warning/20"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-medium leading-7 text-primary">
          Lists ({lists.length})
        </h3>
        <div className="flex flex-wrap gap-2">
          {lists.map((list) => (
            <div
              key={list.id}
              className="flex items-center gap-2 rounded-control border border-border-subtle bg-surface px-3 py-2 text-xs"
            >
              <span className="font-medium text-primary">{list.title}</span>
              <span className="text-secondary">({list.owner.email})</span>
              {confirmingDeleteListId === list.id ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleDeleteList(list.id)}
                    className="rounded-control bg-brand-primary px-2 py-1 font-bold text-white"
                  >
                    Confirm delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteListId(null)}
                    className="rounded-control border border-primary px-2 py-1 text-primary"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDeleteListId(list.id)}
                  className="rounded-control border border-status-warning-text px-2 py-1 text-status-warning-text"
                >
                  Delete list
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-primary">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 hover:text-secondary"
      >
        {label}
        <span aria-hidden="true">
          {active ? (dir === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </button>
    </th>
  );
}

function FilterInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-control border border-border-subtle bg-surface px-2 py-1 text-xs text-primary placeholder:text-secondary/60"
    />
  );
}
