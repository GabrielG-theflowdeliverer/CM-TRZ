import '@testing-library/jest-dom/vitest';

// jsdom has no ResizeObserver; Recharts' ResponsiveContainer needs it.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
