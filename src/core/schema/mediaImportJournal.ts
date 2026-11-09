import * as v from 'valibot';
import {checkPart} from './fileFormat';
import {mediaIdSchema} from './ids';
import {payloadObject} from './payload';

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

export type MediaImportJournal = v.InferOutput<typeof journalSchema>;

/** Checks the bounded, local filenames of an unfinished media copy. */
export function parseMediaImportJournal(value: unknown) {
  return checkPart(journalSchema, value);
}
