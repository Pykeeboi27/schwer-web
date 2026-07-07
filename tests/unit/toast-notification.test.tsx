import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  TOAST_EVENT_NAME,
  useToast,
  type ToastPayload,
} from "@/lib/utils/toast-notification";

function listenOnce(): Promise<ToastPayload> {
  return new Promise((resolve) => {
    window.addEventListener(
      TOAST_EVENT_NAME,
      (event) => resolve((event as CustomEvent<ToastPayload>).detail),
      { once: true },
    );
  });
}

describe("useToast", () => {
  it("dispatches a success toast with the default duration", async () => {
    const { result } = renderHook(() => useToast());
    const received = listenOnce();

    act(() => {
      result.current.success("Saved!");
    });

    const payload = await received;
    expect(payload.variant).toBe("success");
    expect(payload.message).toBe("Saved!");
    expect(payload.durationMs).toBe(3000);
    expect(payload.id).toMatch(/^\d+-[a-z0-9]+$/);
  });

  it("dispatches an error toast with a longer default duration", async () => {
    const { result } = renderHook(() => useToast());
    const received = listenOnce();

    act(() => {
      result.current.error("Something broke");
    });

    const payload = await received;
    expect(payload.variant).toBe("error");
    expect(payload.durationMs).toBe(5000);
  });

  it("dispatches an info toast and honors a custom duration", async () => {
    const { result } = renderHook(() => useToast());
    const received = listenOnce();

    act(() => {
      result.current.info("Heads up", 1234);
    });

    const payload = await received;
    expect(payload.variant).toBe("info");
    expect(payload.durationMs).toBe(1234);
  });

  it("notify() defaults duration per variant when none is passed", async () => {
    const { result } = renderHook(() => useToast());
    const received = listenOnce();

    act(() => {
      result.current.notify("error", "boom");
    });

    const payload = await received;
    expect(payload.durationMs).toBe(5000);
  });

  it("does nothing when window is unavailable (SSR guard)", () => {
    const { result } = renderHook(() => useToast());
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const originalWindow = globalThis.window;

    // @ts-expect-error -- simulate an SSR environment for emitToast's guard.
    delete globalThis.window;

    expect(() => result.current.notify("info", "should not dispatch")).not.toThrow();

    globalThis.window = originalWindow;
    expect(dispatchSpy).not.toHaveBeenCalled();
    dispatchSpy.mockRestore();
  });
});
