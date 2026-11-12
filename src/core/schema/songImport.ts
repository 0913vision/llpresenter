import * as v from 'valibot';
import {revisionSchema} from './contentDocuments';
import {mediaIdSchema, themeIdSchema, songIdSchema} from './ids';
import {payloadObject, plainObject} from './payload';
import {nonBlankText} from './primitives';
import {SONG_NAME_MAX_LENGTH, songSlidesSchema} from './song';

export const SONG_IMPORT_LIMITS = {
  slides: 5000,
  lines: 20_000,
  characters: 1_500_000,
  name: SONG_NAME_MAX_LENGTH,
  labels: 10_000,
} as const;

export const songImportDraftSchema = v.pipe(
  payloadObject({
    title: v.pipe(nonBlankText, v.maxLength(SONG_IMPORT_LIMITS.name)),
    slides: v.pipe(
      songSlidesSchema,
      v.minLength(1),
      v.maxLength(SONG_IMPORT_LIMITS.slides),
    ),
    background: v.exactOptional(mediaIdSchema),
    theme: v.exactOptional(themeIdSchema),
  }),
  v.check(
    draft =>
      draft.slides.reduce((total, slide) => total + slide.lines.length, 0) <=
        SONG_IMPORT_LIMITS.lines &&
      JSON.stringify(draft).length <= SONG_IMPORT_LIMITS.characters,
    'The imported song exceeds its size limits',
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
