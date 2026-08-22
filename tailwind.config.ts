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
        // Display face -- page titles and numeric figures only (StatCard,
        // Measure captions, hero KPIs). Never panel headings or body text;
        // see components/patterns/stat-card.tsx.
        display: ["var(--font-archivo)", "var(--font-geist-sans)", "sans-serif"],
        // Reference numbers (PO/quotation numbers) -- a real mono stack
        // instead of falling through to Tailwind's default.
        mono: ["ui-monospace", "Cascadia Mono", "Segoe UI Mono", "Consolas", "monospace"],
      },
      boxShadow: {
        xs: "0 1px 2px 0 hsl(var(--foreground) / 0.04)",
        sm: "0 1px 2px 0 hsl(var(--foreground) / 0.05), 0 1px 3px 0 hsl(var(--foreground) / 0.04)",
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
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
