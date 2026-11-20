import {vi} from 'vitest';

// NOTE(0913vision): Shared jsdom must not retain modules that captured another
// file's mocks or singleton stores. The renderer setup is loaded afterwards.
vi.resetModules();
