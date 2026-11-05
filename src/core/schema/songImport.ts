import * as v from 'valibot';
import {revisionSchema} from './contentDocuments';
import {mediaIdSchema, songIdSchema} from './ids';
import {payloadObject, plainObject} from './payload';
import {nonBlankText} from './primitives';
import {groupArrangementSchema, songGroupSchema} from './groupedSong';
import {uniqueNames} from './uniqueNames';
import {SONG_NAME_MAX_LENGTH} from './song';

export const SONG_IMPORT_LIMITS = {
  slides: 5000,
  lines: 20_000,
  characters: 1_500_000,
  arrangements: 1000,
  picks: 20_000,
  name: SONG_NAME_MAX_LENGTH,
  labels: 10_000,
} as const;

/**
 * A song to import: the grouped song the editor shows, without the id, the
 * save time, and the format header, which main adds.
 */
export const songImportDraftSchema = v.pipe(
  payloadObject({
    title: v.pipe(nonBlankText, v.maxLength(SONG_IMPORT_LIMITS.name)),
    groups: v.pipe(
      v.array(
        v.pipe(
          songGroupSchema,
          v.check(
            group =>
              group.name.length <= SONG_IMPORT_LIMITS.name &&
              (group.name === '' || group.name.trim().length > 0),
            'Invalid imported label',
          ),
        ),
      ),
      v.minLength(1),
      v.maxLength(SONG_IMPORT_LIMITS.slides),
    ),
    background: v.exactOptional(mediaIdSchema),
    arrangements: v.exactOptional(
      v.pipe(
        v.array(groupArrangementSchema),
        v.maxLength(SONG_IMPORT_LIMITS.arrangements),
        uniqueNames<v.InferOutput<typeof groupArrangementSchema>>(
          'Another arrangement already has this name',
        ),
      ),
    ),
  }),
  v.check(draft => {
    const slides = draft.groups.flatMap(group => group.slides);
    return (
      slides.length <= SONG_IMPORT_LIMITS.slides &&
      slides.reduce((total, slide) => total + slide.lines.length, 0) <=
        SONG_IMPORT_LIMITS.lines &&
      (draft.arrangements ?? []).reduce(
        (total, arrangement) => total + arrangement.groups.length,
        0,
      ) <= SONG_IMPORT_LIMITS.picks &&
      JSON.stringify(draft).length <= SONG_IMPORT_LIMITS.characters
    );
  }, 'The imported song exceeds its size limits'),
  v.check(
    draft =>
      (draft.arrangements ?? []).every(
        arrangement => arrangement.name.length <= SONG_IMPORT_LIMITS.name,
      ),
    'Invalid imported arrangement name',
  ),
);

export const songImportTargetSchema = v.pipe(
  plainObject,
  v.variant('kind', [
    v.object({kind: v.literal('new')}),
    v.object({
      kind: v.literal('overwrite'),
      songId: songIdSchema,
      baseRevision: revisionSchema,
    }),
  ]),
);
