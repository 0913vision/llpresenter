import {menuAvailability} from '@renderer/ui/menuModel';

/** Availability of adding a media file to the service order. */
export function mediaAddAvailability(missing: boolean, reason?: string) {
  return menuAvailability(missing ? '파일을 찾을 수 없습니다' : reason);
}
