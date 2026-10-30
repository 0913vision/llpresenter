import {layerRegistryOf} from './layerRegistry';

/** All production layers, discovered once at build time. */
export const renderLayers = layerRegistryOf(
  import.meta.glob<unknown>(['./layers/*.ts', '!./layers/*.test.ts'], {
    eager: true,
  }),
);
