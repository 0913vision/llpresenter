import type {MediaId} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';

export const SONG_DEFAULT_LABEL = '곡 기본값';
const UNNAMED_MEDIA = '이름 없는 미디어';

export function mediaName(media: MediaItem): string {
  return media.name === '' ? UNNAMED_MEDIA : media.name;
}

/** The pictures a song item can take as its background: no audio. */
export function backgroundMedia(
  items: readonly MediaItem[],
): readonly MediaItem[] {
  return items.filter(item => item.kind !== 'audio');
}

/** The effective background name, including missing and empty references. */
export function backgroundName(
  items: readonly MediaItem[],
  id: MediaId | undefined,
): string {
  if (id === undefined) return '없음';
  const item = backgroundMedia(items).find(item => item.id === id);
  return item === undefined ? '배경 파일 없음' : mediaName(item);
}
