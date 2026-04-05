const CURRENCY_FORMATTER = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

const PERCENT_FORMATTERS = new Map<number, Intl.NumberFormat>();

function getPercentFormatter(fractionDigits: number): Intl.NumberFormat {
  if (!PERCENT_FORMATTERS.has(fractionDigits)) {
    PERCENT_FORMATTERS.set(
      fractionDigits,
      new Intl.NumberFormat("en-PH", {
        style: "percent",
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }),
    );
  }

  return PERCENT_FORMATTERS.get(fractionDigits)!;
}

export function formatCurrency(value: number | null | undefined): string {
  return CURRENCY_FORMATTER.format(Number(value ?? 0));
}

export function formatPercent(value: number | null | undefined, fractionDigits = 2): string {
  const numericValue = Number(value ?? 0);
  return getPercentFormatter(fractionDigits).format(numericValue / 100);
}
