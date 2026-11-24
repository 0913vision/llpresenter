import {createServiceItemId, type MediaId} from '@core/schema/ids';
import type {Report} from '@renderer/session/serviceEdit';
import {canAddMedia, mediaItem} from '@renderer/platform/media';
import {MISSING_MEDIA_TIP} from '@renderer/platform/problemReasons';
import {warningNotice} from '@renderer/ui/notices';
import {insertNewItem} from '@renderer/session/insertNewItem';
import {newMediaItem} from '@renderer/features/media/newMediaItem';

/** Puts a media file that was dropped on the 예배 순서 in it. */
export function dropMediaInOrder(
  id: MediaId,
  before: string | null,
  report: Report,
): void {
  const media = mediaItem(id);
  if (media === undefined || !canAddMedia(id)) {
    report(warningNotice('service-order:media-drop', MISSING_MEDIA_TIP));
    return;
  }
  insertNewItem(
    newMediaItem(media),
    before === null ? null : createServiceItemId(before),
    {report},
  );
}
