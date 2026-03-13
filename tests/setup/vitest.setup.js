import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./msw.server";
import { queryClientInstance } from "@/lib/query-client";

if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }

  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  if (!window.IntersectionObserver) {
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    };
  }

  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  }

  if (!navigator.clipboard) {
    navigator.clipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(""),
    };
  }
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  queryClientInstance.clear();
  vi.clearAllMocks();
  vi.useRealTimers();
});

afterAll(() => {
  server.close();
});
