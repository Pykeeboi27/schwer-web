import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMediaQuery } from "@/lib/utils/useMediaQuery";

type MatchMediaListener = (event: MediaQueryListEvent) => void;

let currentMatches = false;
let listeners: MatchMediaListener[] = [];

function setMatchMedia(matches: boolean) {
  currentMatches = matches;
  listeners = [];

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      media: query,
      matches: currentMatches,
      onchange: null,
      addEventListener: (_type: "change", listener: MatchMediaListener) => {
        listeners.push(listener);
      },
      removeEventListener: (_type: "change", listener: MatchMediaListener) => {
        listeners = listeners.filter((value) => value !== listener);
      },
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function emitMediaQueryChange(matches: boolean) {
  currentMatches = matches;
  const event = { matches } as MediaQueryListEvent;

  for (const listener of listeners) {
    listener(event);
  }
}

describe("useMediaQuery", () => {
  beforeEach(() => {
    setMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns current media-query match value", async () => {
    setMatchMedia(true);

    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it("updates when matchMedia change event fires", async () => {
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));

    await waitFor(() => {
      expect(result.current).toBe(false);
    });

    act(() => {
      emitMediaQueryChange(true);
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });
});
