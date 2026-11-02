import {parseMediaId, type MediaId} from '@core/schema/ids';

/** Native drag format shared by media tiles and the slides that take a dropped media file. */
export const MEDIA_DRAG_MIME = 'application/x-llp-media';

/** The part of a `DataTransfer` that a media drag uses. */
export type MediaDragData = Pick<
  DataTransfer,
  'types' | 'getData' | 'setData' | 'effectAllowed'
>;

/** Puts a media file on a drag, so a slide can take it as an 오버레이. */
export function writeMediaDrag(transfer: MediaDragData, id: MediaId): void {
  transfer.setData(MEDIA_DRAG_MIME, id);
  transfer.effectAllowed = 'copy';
}

/** Whether a drag carries a media file; readable before the drop. */
export function hasMediaDrag(transfer: MediaDragData): boolean {
  return transfer.types.includes(MEDIA_DRAG_MIME);
}

/** The media file a drop carries, if it carries a valid one. */
export function readMediaDrag(transfer: MediaDragData): MediaId | undefined {
  const parsed = parseMediaId(transfer.getData(MEDIA_DRAG_MIME));
  return parsed.ok ? parsed.value : undefined;
}
