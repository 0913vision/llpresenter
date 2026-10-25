import {registryOf} from './sliceRegistry';

/** The slices discovered at build time; adding a module needs no registration edit. */
export const liveSlices = registryOf(
  import.meta.glob<unknown>(['./slices/*.ts', '!./slices/*.test.ts'], {
    eager: true,
  }),
);
