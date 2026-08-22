"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export type MeasureTone = "booked" | "collected" | "ahead" | "close" | "behind";

const TONE_FILL_CLASSES: Record<MeasureTone, string> = {
  booked: "bg-data-booked",
  collected: "bg-data-collected",
  ahead: "bg-status-approved",
  close: "bg-status-pending",
  behind: "bg-status-rejected",
};

type MeasureProps = {
  /** The quantity being measured, in the same units as `capacity`. */
  value: number;
  /**
   * The whole `value` is judged against -- a target, a quota, or the shared
   * max of a row set. Zero or negative renders an empty gauge rather than
   * dividing by zero.
   */
  capacity: number;
  /**
   * 0-100 position of a pace reference marker (e.g. fraction of the year
   * elapsed, for a YTD figure judged against a full-year capacity). Omit to
   * skip it.
   */
  pace?: number;
  /**
   * Fixed reference tick at 100% capacity -- the mark a value is judged
   * against when it's allowed to exceed capacity (an over-achieved quota).
   * Default false; the tick would just sit on the container's own edge for a
   * measure that can never exceed its capacity.
   */
  capTick?: boolean;
  tone?: MeasureTone;
  size?: "default" | "hero";
  /**
   * Floor the fill width so a near-zero value still reads as a mark rather
   * than vanishing, for a list of measures read side by side (0-100).
   */
  minFillPercent?: number;
  /**
   * Grow the fill from 0 on mount instead of rendering at final width.
   * Default false -- most call sites (and `patterns.test.tsx`) need a
   * synchronous width. Opt in per call site, not here. Reduced-motion
   * viewers get the final width immediately either way, since the width
   * transition itself is dropped under `motion-reduce`.
   */
  animate?: boolean;
  /** Stagger multiple animated rows -- delay in ms before this row grows. */
  animateDelayMs?: number;
  className?: string;
  ariaLabel?: string;
};

/**
 * The module's signature element: a quantity read against a reference, the
 * way an engineer reads a gauge rather than a decorative pill. Squared ends
 * (`rounded-[1px]`, not `rounded-full` like every bar it replaces) because an
 * instrument has ends you can read a value against. One primitive, one
 * meaning, used at every scale: it powers `StatProgress`, `QuotaRail`,
 * `RevenueTrendChart`, `BookedVsCollectedChart` (as a pair of measures, one
 * per tone), and `ClientDistributionChart`.
 *
 * Color carries information here on purpose: `booked` (graphite) is the
 * whole quantity, `collected` (verdigris) is the realized part, and
 * `ahead`/`close`/`behind` read a status against pace. Brand orange never
 * appears -- see the `--data-*` / `--status-*` tokens in globals.css.
 */
export function Measure({
  value,
  capacity,
  pace,
  capTick = false,
  tone = "booked",
  size = "default",
  minFillPercent = 0,
  animate = false,
  animateDelayMs = 0,
  className,
  ariaLabel,
}: MeasureProps) {
  const [grown, setGrown] = useState(!animate);

  useEffect(() => {
    if (!animate) {
      return;
    }
    const timer = setTimeout(() => {
      const frame = requestAnimationFrame(() => setGrown(true));
      return () => cancelAnimationFrame(frame);
    }, animateDelayMs);
    return () => clearTimeout(timer);
  }, [animate, animateDelayMs]);

  const rawPercent = capacity > 0 ? (value / capacity) * 100 : 0;
  const fillPercent = Math.max(minFillPercent, Math.min(100, rawPercent));
  const isHero = size === "hero";

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-[1px] bg-data-track",
        isHero ? "h-3.5" : "h-2.5",
        className,
      )}
      role="progressbar"
      aria-valuenow={Math.round(Math.max(0, Math.min(100, rawPercent)))}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      <div
        className={cn(
          "h-full rounded-[1px] transition-[width] duration-700 ease-out motion-reduce:transition-none",
          TONE_FILL_CLASSES[tone],
        )}
        style={{ width: grown ? `${fillPercent}%` : "0%" }}
      />
      {capTick ? (
        <div
          className="absolute inset-y-0 right-0 w-px bg-data-tick/70"
          aria-hidden="true"
        />
      ) : null}
      {pace !== undefined ? (
        <div
          className="absolute inset-y-0 w-px bg-data-tick/40"
          style={{ left: `${Math.min(99, Math.max(0, pace))}%` }}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}
