import {menuAvailability} from '@renderer/ui/menuModel';
import {MISSING_MEDIA_TIP} from '@renderer/platform/problemReasons';

/** Availability of adding a media file to the service order. */
export function mediaAddAvailability(missing: boolean, reason?: string) {
  return menuAvailability(missing ? MISSING_MEDIA_TIP : reason);
}
