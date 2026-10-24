import * as v from 'valibot';
import type {Result} from '../result';
import {
  parseFile,
  serializeFile,
  type FileError,
  type FileFormat,
  type LoadedFile,
  type ReadonlyKnown,
} from './fileFormat';
import {
  audioPlaylistIdSchema,
  mediaIdSchema,
  mediaPlaylistIdSchema,
} from './ids';
import type {MigrationStep} from './migration';
import {
  jsonObject,
  listWithUniqueIds,
  nonBlankText,
  nonNegativeInteger,
  percent,
  positiveInteger,
  positiveNumber,
  seconds,
} from './primitives';

const mediaPropsSchema = jsonObject({
  end: v.exactOptional(v.picklist(['loop', 'stop'])),
  in: v.exactOptional(seconds),
  out: v.exactOptional(seconds),
  speed: v.exactOptional(positiveNumber),
  fit: v.exactOptional(v.picklist(['fit', 'fill', 'stretch'])),
  audio: v.exactOptional(v.boolean()),
  volume: v.exactOptional(percent),
});

const mediaItemSchema = jsonObject({
  id: mediaIdSchema,
  name: v.string(),
  kind: v.picklist(['video', 'image', 'audio']),
  file: nonBlankText,
  size: nonNegativeInteger,
  duration: v.exactOptional(seconds),
  width: v.exactOptional(positiveInteger),
  height: v.exactOptional(positiveInteger),
  props: v.exactOptional(mediaPropsSchema),
});

const playlistSchema = jsonObject({
  id: mediaPlaylistIdSchema,
  name: v.string(),
  items: v.array(mediaIdSchema),
});

const audioPlaylistSchema = jsonObject({
  id: audioPlaylistIdSchema,
  name: v.string(),
  items: v.array(mediaIdSchema),
  loop: v.boolean(),
});

const mediaListSchema = jsonObject({
  format: v.literal('llmedia'),
  schemaVersion: positiveInteger,
  items: listWithUniqueIds(mediaItemSchema),
  playlists: listWithUniqueIds(playlistSchema),
  audioPlaylists: listWithUniqueIds(audioPlaylistSchema),
});

const mediaListMigrations: readonly MigrationStep[] = [];

const mediaListFormat: FileFormat<typeof mediaListSchema> = {
  format: 'llmedia',
  schema: mediaListSchema,
  migrations: mediaListMigrations,
};

/**
 * `media.json` in the 설정 folder: every media item and the playlists. It is
 * the only file that holds file paths.
 */
export type MediaList = ReadonlyKnown<v.InferOutput<typeof mediaListSchema>>;

/**
 * One media file. `file` is relative to the media folder when the file is in
 * it, and absolute otherwise. An absent property means its default.
 */
export type MediaItem = MediaList['items'][number];

export type MediaPlaylist = MediaList['playlists'][number];

export type AudioPlaylist = MediaList['audioPlaylists'][number];

export function parseMediaList(
  text: string,
  file: string,
): Result<LoadedFile<MediaList>, FileError> {
  return parseFile(mediaListFormat, text, file);
}

export function serializeMediaList(
  mediaList: MediaList,
  file: string,
): Result<string, FileError> {
  return serializeFile(mediaListFormat, mediaList, file);
}
