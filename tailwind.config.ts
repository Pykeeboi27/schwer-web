import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-geist-sans)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        // Display face -- page titles, hero headlines (landing, auth panel) and
        // numeric figures only (StatCard, Measure captions, hero KPIs). Never
        // panel headings or body text; see components/patterns/stat-card.tsx.
        display: ["var(--font-archivo)", "var(--font-geist-sans)", "sans-serif"],
        // Reference numbers (PO/quotation numbers) -- a real mono stack
        // instead of falling through to Tailwind's default.
        mono: ["ui-monospace", "Cascadia Mono", "Segoe UI Mono", "Consolas", "monospace"],
      },
      // Shadows read off --shadow-color (near-black in both themes), not
      // --foreground, which is near-white in dark mode and would halo.
      // card: static surfaces (border does the work, shadow is a hairline).
      // float: overlays only (dialogs, sheets, menus, toasts). nav: sticky bar.
      boxShadow: {
        xs: "0 1px 2px 0 hsl(var(--shadow-color) / 0.05)",
        sm: "0 1px 2px 0 hsl(var(--shadow-color) / 0.06), 0 1px 3px 0 hsl(var(--shadow-color) / 0.05)",
        card: "0 1px 3px 0 hsl(var(--shadow-color) / 0.08)",
        float: "0 0 32px 0 hsl(var(--shadow-color) / 0.10)",
        nav: "0 5px 20px 0 hsl(var(--shadow-color) / 0.10)",
      },
      // Text-only accent fill for a single keyword: bg-keyword bg-clip-text
      // text-transparent. Never on a surface (buttons, cards, inputs).
      backgroundImage: {
        keyword:
          "linear-gradient(104deg, hsl(var(--foreground)) 9.56%, hsl(var(--primary)) 102.66%)",
      },
      fontSize: {
        // sm is 15px, not Tailwind's 14: comfortable density across the app.
        sm: ["0.9375rem", { lineHeight: "1.4rem" }],
        // Uppercase label recipe shared by PageHeader scope lines, StatCard hero
        // labels, and ScopeRule. Pair with `uppercase`.
        eyebrow: [
          "0.75rem",
          { lineHeight: "1.33", letterSpacing: "0.14em", fontWeight: "700" },
        ],
      },
      letterSpacing: {
        tight: "-0.02em",
        tighter: "-0.03em",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        field: "hsl(var(--field))",
        wash: "hsl(var(--wash))",
        frame: "hsl(var(--frame))",
        band: {
          DEFAULT: "hsl(var(--band))",
          foreground: "hsl(var(--band-foreground))",
        },
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        data: {
          booked: "hsl(var(--data-booked))",
          collected: "hsl(var(--data-collected))",
          track: "hsl(var(--data-track))",
          tick: "hsl(var(--data-tick))",
        },
        status: {
          pending: "hsl(var(--status-pending))",
          approved: "hsl(var(--status-approved))",
          rejected: "hsl(var(--status-rejected))",
          neutral: "hsl(var(--status-neutral))",
          info: "hsl(var(--status-info))",
          returned: "hsl(var(--status-returned))",
        },
      },
      // xl is overridden on purpose: Tailwind's 12px default would sit below lg.
      borderRadius: {
        sm: "calc(var(--radius) - 8px)",
        md: "calc(var(--radius) - 4px)",
        lg: "var(--radius)",
        xl: "var(--radius)",
        "2xl": "calc(var(--radius) + 4px)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
