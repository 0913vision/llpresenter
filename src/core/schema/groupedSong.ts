import * as v from 'valibot';
import type {Result} from '../common/result';
import {
  parseFile,
  serializeFile,
  type FileError,
  type FileFormat,
  type LoadedFile,
  type ReadonlyKnown,
} from './fileFormat';
import {
  mediaIdSchema,
  songGroupIdSchema,
  songIdSchema,
  type SongGroupId,
} from './ids';
import {
  jsonObject,
  nonBlankText,
  positiveInteger,
  timestamp,
} from './primitives';
import {uniqueNames} from './uniqueNames';
import {arrangementNameSchema, type Song} from './song';
import {
  migrateImportedSongGroups,
  migrateSongGroups,
} from './songGroupMigration';
import {slideHotKeySchema} from './slideHotKey';

/** File bounds keep group expansion and arrangement validation finite. */
export const SONG_GROUP_LIMITS = {
  slides: 10_000,
  groups: 10_000,
  arrangements: 1_000,
  occurrences: 100_000,
} as const;

const groupedSlideSchema = jsonObject({
  lines: v.array(v.string()),
  hotKey: v.exactOptional(slideHotKeySchema),
});

export const songGroupSchema = jsonObject({
  id: songGroupIdSchema,
  name: v.string(),
  slides: v.pipe(
    v.array(groupedSlideSchema),
    v.minLength(1),
    v.maxLength(SONG_GROUP_LIMITS.slides),
  ),
});

const groupArrangementSchema = jsonObject({
  name: arrangementNameSchema,
  groups: v.pipe(
    v.array(songGroupIdSchema),
    v.maxLength(SONG_GROUP_LIMITS.occurrences),
  ),
});

export const groupedSongSchema = v.pipe(
  jsonObject({
    format: v.literal('llsong'),
    schemaVersion: v.pipe(positiveInteger, v.minValue(2)),
    id: songIdSchema,
    title: nonBlankText,
    background: v.exactOptional(mediaIdSchema),
    groups: v.pipe(
      v.array(songGroupSchema),
      v.minLength(1),
      v.maxLength(SONG_GROUP_LIMITS.groups),
      v.check(
        groups => new Set(groups.map(group => group.id)).size === groups.length,
        'Another group already has this id',
      ),
      v.check(
        groups =>
          groups.reduce((sum, group) => sum + group.slides.length, 0) <=
          SONG_GROUP_LIMITS.slides,
        'Too many source slides',
      ),
      v.check(groups => {
        const assigned = new Set<string>();
        for (const group of groups) {
          for (const {hotKey} of group.slides) {
            if (hotKey === undefined) continue;
            if (assigned.has(hotKey)) return false;
            assigned.add(hotKey);
          }
        }
        return true;
      }, 'Another slide already uses this hot key'),
    ),
    arrangements: v.exactOptional(
      v.pipe(
        v.array(groupArrangementSchema),
        v.maxLength(SONG_GROUP_LIMITS.arrangements),
        uniqueNames<v.InferOutput<typeof groupArrangementSchema>>(
          'Another arrangement already has this name',
        ),
        v.check(
          items =>
            items.reduce((sum, item) => sum + item.groups.length, 0) <=
            SONG_GROUP_LIMITS.occurrences,
          'Too many group occurrences',
        ),
      ),
    ),
    updatedAt: v.exactOptional(timestamp),
  }),
  v.forward(
    v.check(({groups, arrangements = []}) => {
      const ids = new Set(groups.map(group => group.id));
      return arrangements.every(arrangement =>
        arrangement.groups.every(id => ids.has(id)),
      );
    }, 'An arrangement points at a group that does not exist'),
    ['arrangements'],
  ),
);

const groupedSongFormat: FileFormat<typeof groupedSongSchema> = {
  format: 'llsong',
  schema: groupedSongSchema,
  migrations: [migrateSongGroups],
};

/** A stored version 2 song, including its named groups and arrangements. */
export type GroupedSong = ReadonlyKnown<
  v.InferOutput<typeof groupedSongSchema>
>;
export type SongGroup = GroupedSong['groups'][number];
export type GroupArrangement = NonNullable<GroupedSong['arrangements']>[number];

/** Counts source slides once, independent of arrangement repetitions. */
export function sourceSlideCount(song: GroupedSong): number {
  return song.groups.reduce((sum, group) => sum + group.slides.length, 0);
}

/** Reads version 2, or migrates a version 1 song in memory without writing it. */
export function parseGroupedSong(
  text: string,
  file: string,
): Result<LoadedFile<GroupedSong>, FileError> {
  return parseFile(groupedSongFormat, text, file);
}

/** Reads import wire data whose section indices are validated draft metadata. */
export function parseGroupedSongDraft(
  text: string,
  file: string,
): Result<LoadedFile<GroupedSong>, FileError> {
  return parseFile(
    {...groupedSongFormat, migrations: [migrateImportedSongGroups]},
    text,
    file,
  );
}

/** Only version 2 is writable; unknown fields survive at every object level. */
export function serializeGroupedSong(
  song: GroupedSong,
  file: string,
): Result<string, FileError> {
  return serializeFile(groupedSongFormat, song, file);
}

/** Either a legacy version 1 song or a modern grouped version 2 song. */
export type AnySong = Song | GroupedSong;

/** Checks whether a song document is in grouped (version 2+) structure. */
export function isGroupedSong(song: AnySong): song is GroupedSong {
  return 'groups' in song;
}

/**
 * Returns the group IDs for a named arrangement, or all group IDs in file order
 * when no arrangement is named or the name is not found. An empty named
 * arrangement retains its empty group sequence (`[]`).
 */
export function arrangementGroupIds(
  song: GroupedSong,
  arrangementName?: string,
): readonly SongGroupId[] {
  const chosen =
    arrangementName === undefined
      ? undefined
      : song.arrangements?.find(item => item.name === arrangementName);
  return chosen !== undefined
    ? chosen.groups
    : song.groups.map(group => group.id);
}
