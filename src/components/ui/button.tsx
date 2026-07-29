import type { ButtonHTMLAttributes } from "react";

/**
 * Button variants per DESIGN.md Section 5.3 (Buttons). No "danger" variant is
 * specified in DESIGN.md, so destructive actions (delete list/item) fall
 * back to plain red text/borders rather than inventing a new brand token.
 */
type Variant = "primary" | "secondary" | "danger" | "ghost";

const base =
  "inline-flex items-center justify-center rounded-control px-6 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-brand-primary text-white hover:bg-brand-primary/90",
  secondary:
    "border border-primary text-primary bg-transparent hover:bg-primary/5",
  danger: "border border-red-300 text-red-600 bg-transparent hover:bg-red-50",
  ghost: "text-secondary hover:bg-border-subtle/60",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
