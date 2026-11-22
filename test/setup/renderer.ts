import {cleanup} from '@testing-library/react';
import {afterEach} from 'vitest';

Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  writable: true,
  value: class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  },
});

// NOTE(0913vision): jsdom has no fonts.
Object.defineProperty(document, 'fonts', {
  configurable: true,
  value: Object.assign(new EventTarget(), {
    ready: Promise.resolve(),
    load: () => Promise.resolve([]),
    check: () => true,
  }),
});

// NOTE(0913vision): jsdom lays nothing out.
Object.defineProperties(Range.prototype, {
  getClientRects: {configurable: true, writable: true, value: () => []},
  getBoundingClientRect: {
    configurable: true,
    writable: true,
    value: () => new DOMRect(),
  },
});

// NOTE(0913vision): jsdom has no image decode; tests can override this default.
Object.defineProperty(HTMLImageElement.prototype, 'decode', {
  configurable: true,
  writable: true,
  value: () => Promise.resolve(),
});

Object.defineProperty(globalThis, 'requestIdleCallback', {
  configurable: true,
  writable: true,
  value: (
    callback: (deadline: {
      didTimeout: boolean;
      timeRemaining(): number;
    }) => void,
  ) =>
    setTimeout(() => callback({didTimeout: false, timeRemaining: () => 1}), 0),
});
Object.defineProperty(globalThis, 'cancelIdleCallback', {
  configurable: true,
  writable: true,
  value: clearTimeout,
});

// NOTE(0913vision): Testing Library unmounts on its own only when the test
// globals are on, and this project keeps them off. Drawings kept for panels
// that left are freed with it.
afterEach(() => {
  cleanup();
});
