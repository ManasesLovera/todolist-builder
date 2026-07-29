import type { InputHTMLAttributes, LabelHTMLAttributes } from "react";

/** Form input per DESIGN.md Section 5.3 (Form Inputs). */
export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-control border border-border-subtle bg-surface px-4 py-3 text-sm text-primary placeholder:text-secondary/60 outline-none transition-colors focus:border-2 focus:border-primary ${className}`}
      {...props}
    />
  );
}

export function Label({
  className = "",
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`mb-1.5 block text-sm font-medium text-primary ${className}`}
      {...props}
    />
  );
}
