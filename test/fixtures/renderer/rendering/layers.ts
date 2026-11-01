import {layerRegistryOf} from '../../../../src/renderer/src/rendering/layerRegistry';

export const renderLayers = layerRegistryOf(
  import.meta.glob<unknown>('./layers/*.ts', {eager: true}),
);
