import * as v from 'valibot';
import type {ReadonlyKnown} from './fileFormat';
import {parsePayload, payloadObject} from './payload';
import {jsonObject} from './primitives';

export const MEDIA_BROWSER = {
  minColumns: 2,
  maxColumns: 8,
  defaultColumns: 5,
  defaultView: 'grid',
  defaultPrepMedia: false,
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

const changeSchema = v.pipe(
  payloadObject(fields),
  v.check(
    value => value.columns !== undefined || value.view !== undefined,
    'Expected media columns or view',
  ),
);

export type MediaBrowser = ReadonlyKnown<
  v.InferOutput<typeof mediaBrowserSchema>
>;
export type MediaBrowserChange = Readonly<v.InferOutput<typeof changeSchema>>;

/** Checks a bounded partial media browser update, dropping unrelated fields. */
export function parseMediaBrowserChange(value: unknown) {
  return parsePayload(changeSchema, value);
}
