import {layerRegistryOf} from '../layerRegistry';

export const renderLayers = layerRegistryOf(
  import.meta.glob<unknown>('./layers/*.ts', {eager: true}),
);
