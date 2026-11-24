import type {MediaItem} from '@core/schema/media/mediaList';

/** Whether a visual media item repeats after reaching its end. */
export function mediaLoops(item: Pick<MediaItem, 'props'>): boolean {
  return item.props?.end !== 'stop';
}
