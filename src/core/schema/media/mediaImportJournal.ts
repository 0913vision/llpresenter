import * as v from 'valibot';
import {checkPart} from '../common/fileFormat';
import {mediaIdSchema} from '../common/ids';
import {payloadObject} from '../common/payload';

const fileName = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(255),
  v.check(name => !/[\\/:]/.test(name) && name !== '.' && name !== '..'),
);
const journalSchema = payloadObject({
  version: v.literal(1),
  mediaId: mediaIdSchema,
  file: fileName,
});

/**
 * The journal of a media copy that has not finished: the reserved media id and
 * the plain file name being copied, under `.imports` in the media folder.
 */
export type MediaImportJournal = v.InferOutput<typeof journalSchema>;

/** Checks the bounded, local filenames of an unfinished media copy. */
export function parseMediaImportJournal(value: unknown) {
  return checkPart(journalSchema, value);
}
