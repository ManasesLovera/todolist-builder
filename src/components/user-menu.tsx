"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { logoutAction } from "@/lib/actions/logout";

/** Right-hand user icon in the nav bar, opens a Profile/Logout dropdown. */
export function UserMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initial = email.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="User menu"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-container text-sm font-medium text-primary"
      >
        {initial}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-11 w-48 rounded-card border border-border-subtle bg-surface p-2 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]"
        >
          <p className="truncate px-3 py-1.5 text-xs text-secondary">{email}</p>
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded-control px-3 py-2 text-sm font-medium text-primary hover:bg-border-subtle/60"
          >
            Profile
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="w-full rounded-control px-3 py-2 text-left text-sm font-medium text-primary hover:bg-border-subtle/60"
            >
              Log out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
