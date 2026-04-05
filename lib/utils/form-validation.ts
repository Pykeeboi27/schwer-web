export type ClientFormInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export type ClientFormErrors = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9\s-]{10,20}$/;
const PO_AMOUNT_REGEX = /^\d{1,15}(?:\.\d{1,2})?$/;

function normalizeInput(value: unknown): string {
  return String(value ?? "").trim();
}

export function validateClientName(name: string): string | null {
  if (!String(name ?? "").trim()) {
    return "Client name is required.";
  }

  return null;
}

export function validateClientEmail(email: string | null | undefined): string | null {
  const normalized = normalizeInput(email);

  if (!normalized) {
    return null;
  }

  if (!EMAIL_REGEX.test(normalized)) {
    return "Please enter a valid email address.";
  }

  return null;
}

export function validateClientPhone(phone: string | null | undefined): string | null {
  const normalized = normalizeInput(phone);

  if (!normalized) {
    return null;
  }

  if (!PHONE_REGEX.test(normalized)) {
    return "Phone number must be 10 to 20 characters and contain only digits, spaces, or dashes.";
  }

  return null;
}

export function validateClientAddress(
  address: string | null | undefined,
  required = false,
): string | null {
  const normalized = normalizeInput(address);

  if (!required) {
    return null;
  }

  if (!normalized) {
    return "Address is required.";
  }

  return null;
}

export function validatePoTotalAmount(amount: unknown): string | null {
  const normalized = normalizeInput(amount);

  if (!normalized) {
    return "PO total amount is required.";
  }

  if (!PO_AMOUNT_REGEX.test(normalized)) {
    return "PO total amount must have up to 15 digits and up to 2 decimal places.";
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "PO total amount must be greater than 0.";
  }

  return null;
}

export function validateCollectionAmount(
  amount: unknown,
  remainingBalance?: number,
): string | null {
  const amountError = validatePoTotalAmount(amount);
  if (amountError) {
    if (amountError === "PO total amount is required.") {
      return "Collection amount is required.";
    }

    return amountError.replace("PO total amount", "Collection amount");
  }

  if (
    Number.isFinite(remainingBalance) &&
    Number(amount) > Number(remainingBalance)
  ) {
    return "Collection amount exceeds available balance.";
  }

  return null;
}

export function validateClientForm(input: ClientFormInput): {
  valid: boolean;
  errors: ClientFormErrors;
} {
  const errors: ClientFormErrors = {};

  const nameError = validateClientName(input.name);
  if (nameError) {
    errors.name = nameError;
  }

  const emailError = validateClientEmail(input.email);
  if (emailError) {
    errors.email = emailError;
  }

  const phoneError = validateClientPhone(input.phone);
  if (phoneError) {
    errors.phone = phoneError;
  }

  const addressError = validateClientAddress(input.address, false);
  if (addressError) {
    errors.address = addressError;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
