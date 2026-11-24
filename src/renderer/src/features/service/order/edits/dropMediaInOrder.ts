import {createServiceItemId, type MediaId} from '@core/schema/common/ids';
import type {Report} from '@renderer/session/service/serviceEdit';
import {canAddMedia, mediaItem} from '@renderer/platform/documents/media';
import {MISSING_MEDIA_TIP} from '@renderer/platform/problemReasons';
import {warningNotice} from '@renderer/ui/popups/notices';
import {insertNewItem} from '@renderer/session/service/insertNewItem';
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
