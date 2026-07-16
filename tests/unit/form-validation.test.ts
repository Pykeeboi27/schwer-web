import { describe, expect, it } from "vitest";

import {
  sanitizePhoneInput,
  validateClientEmail,
  validateClientPhone,
  validateCollectionAmount,
  validatePhone,
  validatePoTotalAmount,
} from "@/lib/utils/form-validation";

describe("shared form validation", () => {
  it("accepts valid optional client email and rejects invalid email", () => {
    expect(validateClientEmail("client@example.com")).toBeNull();
    expect(validateClientEmail("")).toBeNull();
    expect(validateClientEmail("not-an-email")).toBe(
      "Please enter a valid email address.",
    );
  });

  it("accepts valid optional client phone and rejects invalid formats", () => {
    expect(validateClientPhone("0917-555-1234")).toBeNull();
    expect(validateClientPhone("0917 555 1234")).toBeNull();
    expect(validateClientPhone("123abc")).toBe(
      "Phone number can only contain digits, spaces, dashes, parentheses, and a leading +.",
    );
  });

  it("accepts common intl/PH phone formats and rejects malformed numbers", () => {
    expect(validatePhone("")).toBeNull();
    expect(validatePhone("+63 917 555 1234")).toBeNull();
    expect(validatePhone("(02) 8123-4567")).toBeNull();
    expect(validatePhone("123abc")).toBe(
      "Phone number can only contain digits, spaces, dashes, parentheses, and a leading +.",
    );
    expect(validatePhone("12345")).toBe("Phone number must have 7 to 15 digits.");
    expect(validatePhone("1".repeat(16))).toBe("Phone number must have 7 to 15 digits.");
  });

  it("strips disallowed characters while typing a phone number", () => {
    expect(sanitizePhoneInput("091abc7-555*1234")).toBe("0917-5551234");
    expect(sanitizePhoneInput("+63 (917) 555-1234")).toBe("+63 (917) 555-1234");
  });

  it("validates PO amount formatting and precision", () => {
    expect(validatePoTotalAmount("12345.67")).toBeNull();
    expect(validatePoTotalAmount("999999999999999.99")).toBeNull();

    expect(validatePoTotalAmount("")).toBe("PO total amount is required.");
    expect(validatePoTotalAmount("0")).toBe("PO total amount must be greater than 0.");
    expect(validatePoTotalAmount("123.456")).toBe(
      "PO total amount must have up to 15 digits and up to 2 decimal places.",
    );
    expect(validatePoTotalAmount("1234567890123456.00")).toBe(
      "PO total amount must have up to 15 digits and up to 2 decimal places.",
    );
  });

  it("validates collection amount and remaining balance", () => {
    expect(validateCollectionAmount("200.50", 500)).toBeNull();
    expect(validateCollectionAmount("", 500)).toBe("Collection amount is required.");
    expect(validateCollectionAmount("501", 500)).toBe(
      "Collection amount exceeds available balance.",
    );
  });
});
