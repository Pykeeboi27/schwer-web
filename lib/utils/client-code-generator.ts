export function generateClientCode(): string {
  const randomDigits = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");

  return `C${randomDigits}`;
}

export async function generateUniqueClientCode(
  isCodeUnique: (code: string) => Promise<boolean>,
  maxAttempts = 10,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = generateClientCode();
    const isUnique = await isCodeUnique(candidate);

    if (isUnique) {
      return candidate;
    }
  }

  throw new Error("Unable to generate a unique client code. Please try again.");
}
