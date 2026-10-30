import type {ActiveProp, PropLayer} from '@core/live/state';

export function propLayer(items: readonly ActiveProp[]): PropLayer | null {
  const first = items[0];
  return first === undefined ? null : {propId: first.propId, items};
}
