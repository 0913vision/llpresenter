import {extname} from 'node:path';
import type {FileFilter} from 'electron';
import type {MediaItem} from '@shared/schema/mediaList';

export type MediaKind = MediaItem['kind'];

/**
 * The extensions each kind imports, without the dot: the formats the media
 * protocol serves, and the common audio formats.
 */
export const MEDIA_EXTENSIONS: Readonly<Record<MediaKind, readonly string[]>> =
  {
    video: ['mp4', 'm4v', 'webm', 'mov'],
    image: ['jpg', 'jpeg', 'png', 'webp'],
    audio: ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'opus'],
  };

const KIND_LABELS: Readonly<Record<MediaKind, string>> = {
  video: '동영상',
  image: '이미지',
  audio: '오디오',
};

const mediaKinds: readonly MediaKind[] = ['video', 'image', 'audio'];

/** The kind of a file by its extension, or null when it doesn't import. */
export function mediaKindOf(file: string): MediaKind | null {
  const extension = extname(file).slice(1).toLowerCase();
  return (
    mediaKinds.find(kind => MEDIA_EXTENSIONS[kind].includes(extension)) ?? null
  );
}

/** The file dialog filters: every supported file first, then each kind. */
export function mediaDialogFilters(
  kinds: readonly MediaKind[] = mediaKinds,
): FileFilter[] {
  const each = kinds.map(kind => ({
    name: KIND_LABELS[kind],
    extensions: [...MEDIA_EXTENSIONS[kind]],
  }));
  return kinds.length > 1
    ? [
        {
          name: '미디어',
          extensions: each.flatMap(({extensions}) => extensions),
        },
        ...each,
      ]
    : each;
}
