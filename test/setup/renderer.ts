import {cleanup} from '@testing-library/react';
import {afterEach} from 'vitest';

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
// globals are on, and this project keeps them off.
afterEach(cleanup);
