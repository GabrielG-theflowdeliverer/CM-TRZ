import '@testing-library/jest-dom/vitest';

// jsdom has no ResizeObserver; Recharts' ResponsiveContainer needs it.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom implements Blob/File but not Blob.text(), which the project-import
// flow on HomePage uses to read a chosen file. Browsers have had it since
// 2019 — this fills the gap in the test environment rather than making the
// app work around it.
Blob.prototype.text ??= function (this: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(this);
  });
};
