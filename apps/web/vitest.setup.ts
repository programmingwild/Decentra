import "@testing-library/jest-dom/vitest";

// jsdom lacks these browser APIs — stub the stable parts tests rely on.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

if (typeof window !== "undefined" && !window.IntersectionObserver) {
  class FakeIO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (window as any).IntersectionObserver = FakeIO;
}
