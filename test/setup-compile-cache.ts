import {enableCompileCache} from 'node:module';
import {COMPILE_CACHE_DIR} from '../scripts/compile-cache.mts';

// NOTE(0913vision): Every worker loads ESLint, its plugins, and TypeScript
// again. Node's compile cache keeps their compiled code between runs, which
// cut those imports from 5.3 s to 3.6 s. Vitest turns the cache off while it
// measures coverage, so this speeds up `npm test`, not `test:coverage`.
enableCompileCache(COMPILE_CACHE_DIR);
