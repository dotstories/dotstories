import "@testing-library/jest-dom";

// Browser APIs Carbon uses that jsdom doesn't have.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// Node-environment suites (server code) have no window.
if (typeof window !== "undefined")
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;

// App Router hooks outside a Next app: a fake router the tests can inspect.
export const mockRouter = { replace: jest.fn(), push: jest.fn(), refresh: jest.fn() };
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

// Server actions talk to D1 and Auth.js: not available in unit tests.
jest.mock("@/actions/social", () => ({ toggleLike: jest.fn(), addComment: jest.fn(), deleteComment: jest.fn() }));
jest.mock("@/actions/dot-state", () => ({ saveDotState: jest.fn(async () => {}) }));
jest.mock("@/lib/saved-state", () => ({ sessionWithSetup: jest.fn(async () => null) }));
jest.mock("@/actions/model-terms", () => ({ acceptModelTerms: jest.fn(async () => {}) }));
jest.mock("@/lib/accepted-terms", () => ({ acceptedTerms: jest.fn(async () => []) }));
