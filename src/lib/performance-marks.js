function hasPerformanceApi() {
  return typeof window !== "undefined" && typeof window.performance !== "undefined";
}

export function markPerformance(name) {
  if (!hasPerformanceApi() || !name) return;
  try {
    window.performance.mark(name);
  } catch {
    // Ignore unsupported marks in older browsers/dev runtimes.
  }
}

export function measurePerformance(name, startMark, endMark) {
  if (!hasPerformanceApi() || !name || !startMark || !endMark) return;
  try {
    window.performance.measure(name, startMark, endMark);
  } catch {
    // Ignore if marks are unavailable.
  }
}
