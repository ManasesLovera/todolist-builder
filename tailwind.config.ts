import type { Config } from "tailwindcss";

/**
 * Design tokens sourced from DESIGN.md Section 5 (Visual Identity & Design
 * System). Keep these in sync with the CSS custom properties defined in
 * `src/app/globals.css` — the hex values must match exactly.
 */
const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // App background (Soft Light Mint) -> bg-canvas
        canvas: "#F0FDF4",
        // Cards, panels, input surfaces -> bg-surface
        surface: "#FFFFFF",
        // Headings / primary body text (Deep Forest Green) -> text-primary
        primary: "#166534",
        // Subtitles, labels, secondary body text -> text-secondary
        secondary: "#15803D",
        // Primary CTAs, active buttons (Vibrant Orange) -> bg-brand-primary / text-brand-primary
        "brand-primary": "#EA580C",
        // Highlight panels, statistics containers -> bg-accent-container
        "accent-container": "#A7F3D0",
        // Status badges, tags, pending indicators -> bg-status-warning
        "status-warning": "#FBBF24",
        // Dark Amber text for warning badge variant -> text-status-warning-text
        "status-warning-text": "#78350F",
        // Structural borders, input outlines, table dividers -> border-subtle
        "border-subtle": "#DCFCE7",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        card: "1rem",
        control: "0.75rem",
      },
      maxWidth: {
        container: "1280px",
      },
      spacing: {
        nav: "70px",
      },
    },
  },
};

export default config;
