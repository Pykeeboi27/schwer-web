import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClientAction } from "@/app/protected/sales/clients/actions";

const { mockCreateSalesClient, mockValidateClientCodeUniqueness } = vi.hoisted(() => ({
  mockCreateSalesClient: vi.fn(),
  mockValidateClientCodeUniqueness: vi.fn(),
}));

const { mockRevalidatePath } = vi.hoisted(() => ({
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/lib/sales/clients", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sales/clients")>("@/lib/sales/clients");

  return {
    ...actual,
    createSalesClient: mockCreateSalesClient,
    validateClientCodeUniqueness: mockValidateClientCodeUniqueness,
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

describe("createClientAction", () => {
  beforeEach(() => {
    mockCreateSalesClient.mockReset();
    mockValidateClientCodeUniqueness.mockReset();
    mockRevalidatePath.mockReset();
  });

  it("creates a new client when code is unique", async () => {
    mockValidateClientCodeUniqueness.mockResolvedValue(true);
    mockCreateSalesClient.mockResolvedValue(undefined);

    const formData = new FormData();
    formData.set("code", "C456789");
    formData.set("name", "ACME Industrial");
    formData.set("sector", "industrial");

    await expect(createClientAction(formData)).resolves.toMatchObject({
      success: true,
    });
  });

  it("returns error when client code already exists", async () => {
    mockValidateClientCodeUniqueness.mockResolvedValue(false);

    const formData = new FormData();
    formData.set("code", "C111111");
    formData.set("name", "Duplicate Client");

    await expect(createClientAction(formData)).resolves.toMatchObject({
      success: false,
      error: expect.stringMatching(/already exists/i),
    });
  });

  it("returns validation error for invalid form payload", async () => {
    const formData = new FormData();
    formData.set("code", "C222222");
    formData.set("name", "");

    await expect(createClientAction(formData)).resolves.toMatchObject({
      success: false,
      error: expect.stringMatching(/name is required/i),
    });
  });
});
