import type {PropLayer} from '@core/schema/live/live';
import type {ActiveProp} from '@core/schema/live/overlayState';

/**
 * The prop layer of the shown props, led by the first one, or `null` when none
 * is shown.
 */
export function propLayer(items: readonly ActiveProp[]): PropLayer | null {
  const first = items[0];
  return first === undefined ? null : {propId: first.propId, items};
}
