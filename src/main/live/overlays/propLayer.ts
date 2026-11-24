import type {ActiveProp, PropLayer} from '@core/schema/live/live';

export function propLayer(items: readonly ActiveProp[]): PropLayer | null {
  const first = items[0];
  return first === undefined ? null : {propId: first.propId, items};
}
