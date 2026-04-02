export const DEPARTMENTS = [
  "hr",
  "sales",
  "accounting",
  "engineering",
  "purchasing",
  "executive",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export function isDepartment(value: string): value is Department {
  return DEPARTMENTS.includes(value as Department);
}
