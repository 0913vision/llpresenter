import * as v from 'valibot';
import type {ReadonlyKnown} from '../common/fileFormat';
import {jsonRecord, nonBlankText} from '../common/primitives';
import {THEME_FILE_LIMITS} from '../screens/theme';

const boxColumns = jsonRecord(
  v.pipe(nonBlankText, v.maxLength(THEME_FILE_LIMITS.name)),
  v.boolean(),
);

/**
 * The columns of the slide editor that were switched on or off on this
 * computer: for each theme, its boxes by name.
 */
export const slideColumnsSchema = v.pipe(
  jsonRecord(v.pipe(v.string(), v.uuid()), boxColumns),
  v.maxEntries(500),
);

export type SlideColumns = ReadonlyKnown<
  v.InferOutput<typeof slideColumnsSchema>
>;
