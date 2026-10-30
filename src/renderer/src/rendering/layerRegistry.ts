import {isRenderLayer, type RegisteredLayer} from './layer';

/** Collects layer modules and checks their unique kinds and stacking orders. */
export function layerRegistryOf(
  modules: Readonly<Record<string, unknown>>,
): readonly RegisteredLayer[] {
  const kinds = new Set<string>();
  const orders = new Set<number>();
  const layers = Object.entries(modules).flatMap(([path, module]) => {
    const values: unknown[] =
      typeof module === 'object' && module !== null
        ? Object.values(module)
        : [];
    const found = values.filter(isRenderLayer);
    if (found.length === 0) throw new Error(`${path} exports no render layer`);
    return found;
  });
  for (const layer of layers) {
    if (kinds.has(layer.kind)) {
      throw new Error(`two render layers use ${layer.kind}`);
    }
    if (!Number.isSafeInteger(layer.order) || layer.order < 0) {
      throw new Error(`invalid stacking order for ${layer.kind}`);
    }
    if (orders.has(layer.order)) {
      throw new Error(`two render layers use order ${layer.order}`);
    }
    kinds.add(layer.kind);
    orders.add(layer.order);
  }
  return layers.sort((left, right) => left.order - right.order);
}
