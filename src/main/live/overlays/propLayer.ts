import type {PropLayer} from '@core/schema/live/live';
import type {ActiveProp} from '@core/schema/live/overlayState';

export function propLayer(items: readonly ActiveProp[]): PropLayer | null {
  const first = items[0];
  return first === undefined ? null : {propId: first.propId, items};
}
