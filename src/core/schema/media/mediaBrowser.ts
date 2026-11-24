import * as v from 'valibot';
import type {ReadonlyKnown} from '../common/fileFormat';
import {payloadObject} from '../common/payload';
import {jsonObject} from '../common/primitives';

/**
 * The 미디어 browser's tile columns (2 to 8, 5 by default) and its default view.
 */
export const MEDIA_BROWSER = {
  minColumns: 2,
  maxColumns: 8,
  defaultColumns: 5,
  defaultView: 'grid',
} as const;

const fields = {
  columns: v.exactOptional(
    v.pipe(
      v.number(),
      v.integer(),
      v.minValue(MEDIA_BROWSER.minColumns),
      v.maxValue(MEDIA_BROWSER.maxColumns),
    ),
  ),
  view: v.exactOptional(v.picklist(['grid', 'list'])),
};

export const mediaBrowserSchema = jsonObject(fields);

/** A change of some of the fields; other fields are dropped. */
export const mediaBrowserChangeSchema = payloadObject(fields);

/**
 * The saved 미디어 browser layout in the UI state: the tile column count and the
 * grid or list view. An absent field means its default.
 */
export type MediaBrowser = ReadonlyKnown<
  v.InferOutput<typeof mediaBrowserSchema>
>;
