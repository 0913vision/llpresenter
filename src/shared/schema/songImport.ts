import * as v from 'valibot';
import {revisionSchema} from './contentDocuments';
import {mediaIdSchema, songIdSchema} from './ids';
import {payloadObject, plainObject} from './payload';
import {nonBlankText} from './primitives';
import {arrangementsSchema, slideSchema} from './song';

export const SONG_IMPORT_LIMITS = {
  slides: 5000,
  lines: 20_000,
  characters: 1_000_000,
  arrangements: 1000,
  picks: 20_000,
  name: 512,
  labels: 10_000,
} as const;

export const songImportDraftSchema = v.pipe(
  payloadObject({
    title: v.pipe(nonBlankText, v.maxLength(SONG_IMPORT_LIMITS.name)),
    slides: v.pipe(
      v.array(
        v.pipe(
          slideSchema,
          v.check(
            slide =>
              slide.label === undefined ||
              slide.label === '' ||
              (slide.label.trim().length > 0 &&
                slide.label.length <= SONG_IMPORT_LIMITS.name),
            'Invalid imported label',
          ),
        ),
      ),
      v.minLength(1),
      v.maxLength(SONG_IMPORT_LIMITS.slides),
    ),
    background: v.exactOptional(mediaIdSchema),
    arrangements: v.exactOptional(
      v.pipe(arrangementsSchema, v.maxLength(SONG_IMPORT_LIMITS.arrangements)),
    ),
  }),
  v.check(
    draft =>
      draft.slides.reduce((total, slide) => total + slide.lines.length, 0) <=
        SONG_IMPORT_LIMITS.lines &&
      (draft.arrangements ?? []).reduce(
        (total, arrangement) => total + arrangement.slides.length,
        0,
      ) <= SONG_IMPORT_LIMITS.picks &&
      JSON.stringify(draft).length <= SONG_IMPORT_LIMITS.characters,
    'The imported song exceeds its size limits',
  ),
  v.check(
    draft =>
      (draft.arrangements ?? []).every(
        arrangement =>
          arrangement.name.length <= SONG_IMPORT_LIMITS.name &&
          arrangement.slides.every(index => index <= draft.slides.length),
      ),
    'Invalid imported arrangement reference',
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
