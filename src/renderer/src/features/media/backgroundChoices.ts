import type {MediaId} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';
import {THEME_BACKGROUNDS, THEME_DECORATIONS} from '@core/themes/pictures';

export const SONG_DEFAULT_LABEL = '곡 기본값';
export const MISSING_BACKGROUND_NAME = '이름을 알 수 없는 배경';
const UNNAMED_MEDIA = '이름 없는 미디어';

export function mediaName(media: Pick<MediaItem, 'name'>): string {
  return media.name === '' ? UNNAMED_MEDIA : media.name;
}

/** The pictures a song item can take as its background: no audio. */
export function backgroundMedia(
  items: readonly MediaItem[],
): readonly MediaItem[] {
  return items.filter(item => item.kind !== 'audio' && item.internal !== true);
}

/** The effective background name, including missing and empty references. */
export function backgroundName(
  items: readonly MediaItem[],
  id: MediaId | undefined,
): string {
  if (id === undefined) return '없음';
  const item =
    backgroundMedia(items).find(item => item.id === id) ??
    backgroundPicture(id);
  return item === undefined ? '배경 파일 없음' : mediaName(item);
}

export function backgroundPicture(id: MediaId | undefined) {
  return [...THEME_BACKGROUNDS, ...THEME_DECORATIONS].find(
    item => item.id === id,
  );
}

/** Missing catalog entries cannot recover a filename from a saved media ID. */
export function missingBackgroundTip(name?: string): string {
  return `배경 파일을 찾을 수 없습니다: ${name === undefined ? MISSING_BACKGROUND_NAME : name || UNNAMED_MEDIA}. 다른 배경을 선택하세요.`;
}
