import * as v from 'valibot';
import {revisionSchema} from '../services/contentDocuments';
import {songIdSchema} from '../common/ids';
import {payloadObject, plainObject} from '../common/payload';
import {nonBlankText} from '../common/primitives';
import {slidesSchema} from '../slides/slide';
import {SONG_NAME_MAX_LENGTH} from './song';

export const SONG_IMPORT_LIMITS = {
  slides: 5000,
  characters: 1_500_000,
  name: SONG_NAME_MAX_LENGTH,
} as const;

export const songImportDraftSchema = v.pipe(
  payloadObject({
    title: v.pipe(nonBlankText, v.maxLength(SONG_IMPORT_LIMITS.name)),
    slides: v.pipe(
      slidesSchema,
      v.minLength(1),
      v.maxLength(SONG_IMPORT_LIMITS.slides),
    ),
  }),
  v.check(
    draft => JSON.stringify(draft).length <= SONG_IMPORT_LIMITS.characters,
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
