import type {ActiveProp, PropLayer} from '@shared/live';

export function propLayer(items: readonly ActiveProp[]): PropLayer | null {
  const first = items[0];
  return first === undefined ? null : {propId: first.propId, items};
}
