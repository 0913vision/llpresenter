import * as v from 'valibot';
import type {ReadonlyKnown} from './fileFormat';
import {payloadObject} from './payload';
import {jsonObject} from './primitives';

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

export type MediaBrowser = ReadonlyKnown<
  v.InferOutput<typeof mediaBrowserSchema>
>;
