import {resolve} from 'node:path';

/**
 * Where Node keeps the compiled code of loaded modules between runs. It sits
 * under `node_modules`, so `npm ci` clears it with the modules it belongs to.
 */
export const COMPILE_CACHE_DIR = resolve(
  import.meta.dirname,
  '..',
  'node_modules',
  '.cache',
  'node-compile-cache',
);
