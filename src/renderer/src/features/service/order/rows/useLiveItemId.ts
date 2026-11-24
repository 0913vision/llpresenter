import {useLive} from '@renderer/session/live';
import {useShow} from '@renderer/session/show/showStore';

/**
 * The item on output: the slide's owner, otherwise the media's owner.
 * Older media without an owner use the matching last-started media item.
 */
export function useLiveItemId(): string | null {
  const slideItem = useLive(view => view.state?.layers.slide?.itemId ?? null);
  const mediaId = useLive(view => view.state?.layers.media?.mediaId);
  const mediaItemId = useLive(view => view.state?.layers.media?.itemId ?? null);
  const started = useLive(view => view.lastStartedItemId);
  const row = useShow(view => view.rows.find(item => item.id === started));
  const tile = useShow(view =>
    started === null ? undefined : view.tiles[started]?.[0],
  );
  if (slideItem !== null) return slideItem;
  if (mediaItemId !== null) return mediaItemId;
  const background = tile?.slide.background;
  if (
    row?.kind === 'media' &&
    background?.kind === 'media' &&
    background.media === mediaId
  ) {
    return row.id;
  }
  return null;
}
