"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { formatNumberInput, stripCommas } from "@/lib/utils/number-format";

type NumberInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "defaultValue" | "onChange"
> & {
  /** Form field name. A hidden input carries the raw (un-grouped) numeric value. */
  name?: string;
  /** Controlled raw value (un-grouped numeric string). Omit for uncontrolled use. */
  value?: string;
  /** Initial raw value for uncontrolled use. */
  defaultValue?: string | number;
  /** Fires with the raw (un-grouped) numeric string whenever the value changes. */
  onValueChange?: (raw: string) => void;
};

/**
 * Text input that displays a number with comma thousands separators while the
 * user types, but submits / reports the raw un-grouped value. Works with both
 * FormData forms (via the hidden input named `name`) and controlled React state
 * (via `value` + `onValueChange`).
 */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ name, value, defaultValue, onValueChange, inputMode = "decimal", ...props }, ref) => {
    const isControlled = value !== undefined;
    const [internalRaw, setInternalRaw] = React.useState(
      defaultValue === undefined ? "" : stripCommas(String(defaultValue)),
    );
    const raw = isControlled ? value! : internalRaw;
    const display = formatNumberInput(raw);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextRaw = stripCommas(event.target.value).replace(/[^0-9.]/g, "");
      if (!isControlled) {
        setInternalRaw(nextRaw);
      }
      onValueChange?.(nextRaw);
    };

    return (
      <>
        <Input
          {...props}
          ref={ref}
          type="text"
          inputMode={inputMode}
          value={display}
          onChange={handleChange}
          autoComplete="off"
        />
        {name ? <input type="hidden" name={name} value={raw} /> : null}
      </>
    );
  },
);
NumberInput.displayName = "NumberInput";
