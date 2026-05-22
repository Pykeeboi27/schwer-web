/**
 * Number formatting helpers shared across the quotation, PO, and dashboard
 * modules so every currency / numeric value renders with thousands
 * separators consistently (e.g. 100000 -> "100,000").
 */

/** Strip grouping commas (and surrounding whitespace) from a user-entered string. */
export function stripCommas(value: string): string {
  return value.replace(/,/g, "").trim();
}

/**
 * Format a numeric value (or numeric string) with comma thousands separators.
 * Returns an empty string for null/undefined/blank/non-numeric input so it is
 * safe to bind directly to a controlled input.
 */
export function formatNumberWithCommas(
  value: number | string | null | undefined,
  options: { maximumFractionDigits?: number; minimumFractionDigits?: number } = {},
): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const numeric = typeof value === "number" ? value : Number(stripCommas(value));
  if (!Number.isFinite(numeric)) {
    return "";
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  }).format(numeric);
}

/** Format a value as PHP currency with comma separators. */
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const numeric = typeof value === "number" ? value : Number(stripCommas(value));
  if (!Number.isFinite(numeric)) {
    return "—";
  }

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(numeric);
}

/**
 * Format a value while the user is typing: keeps the integer part grouped with
 * commas but preserves a trailing decimal point / partial decimals so the
 * caret behaves naturally (e.g. "1234." -> "1,234.", "1234.5" -> "1,234.5").
 */
export function formatNumberInput(raw: string): string {
  const cleaned = stripCommas(raw).replace(/[^0-9.]/g, "");
  if (cleaned === "") {
    return "";
  }

  const [intPart, ...decimalParts] = cleaned.split(".");
  const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (decimalParts.length === 0 && !cleaned.includes(".")) {
    return groupedInt;
  }

  // Re-join everything after the first dot, then trim to 2 decimal places.
  const decimals = decimalParts.join("").slice(0, 2);
  return `${groupedInt}.${decimals}`;
}

/** Parse a possibly comma-grouped numeric string to a number (NaN if invalid). */
export function parseNumeric(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined || raw === "") {
    return NaN;
  }
  return Number(typeof raw === "number" ? raw : stripCommas(raw));
}
