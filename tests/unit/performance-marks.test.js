import { markPerformance, measurePerformance } from "@/lib/performance-marks";

describe("performance mark helpers", () => {
  test("does nothing when name is missing", () => {
    expect(() => markPerformance("")).not.toThrow();
    expect(() => measurePerformance("", "a", "b")).not.toThrow();
  });

  test("calls performance api when available", () => {
    const markSpy = vi.spyOn(window.performance, "mark");
    const measureSpy = vi.spyOn(window.performance, "measure");

    markPerformance("start");
    measurePerformance("metric", "start", "end");

    expect(markSpy).toHaveBeenCalledWith("start");
    expect(measureSpy).toHaveBeenCalledWith("metric", "start", "end");
  });
});
