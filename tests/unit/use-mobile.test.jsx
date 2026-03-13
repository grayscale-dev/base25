import { renderHook } from "@testing-library/react";
import { useIsMobile } from "@/hooks/use-mobile";

describe("useIsMobile", () => {
  test("returns boolean based on media query", () => {
    window.innerWidth = 500;
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    const { result } = renderHook(() => useIsMobile());
    expect(typeof result.current).toBe("boolean");
    expect(result.current).toBe(true);
  });
});
