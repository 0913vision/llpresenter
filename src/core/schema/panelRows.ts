import * as v from 'valibot';
import {payloadObject} from './payload';
import {jsonObject} from './primitives';

export const PANEL_ROW_LIMITS = {min: 1, max: 32_768} as const;
const height = v.exactOptional(
  v.pipe(
    v.number(),
    v.integer(),
    v.minValue(PANEL_ROW_LIMITS.min),
    v.maxValue(PANEL_ROW_LIMITS.max),
  ),
);
const entries = {
  'show.order': height,
  'show.quick': height,
  'show.preview': height,
  'show.tools': height,
  'prep.preview': height,
  'prep.slides': height,
  'prep.settings': height,
  'draft.preview': height,
  'draft.slides': height,
  'media.upper': height,
  'media.bin': height,
  'media.lists': height,
  'media.audio': height,
};

export type PanelRowId = keyof typeof entries;
export type PanelRows = Readonly<Partial<Record<PanelRowId, number>>>;
export function isPanelRowId(value: string): value is PanelRowId {
  return Object.hasOwn(entries, value);
}
export const panelRowsSchema = jsonObject(entries);
export const panelRowsChangeSchema = v.pipe(
  payloadObject(entries),
  v.check(value => Object.keys(value).length > 0, 'Expected a panel height'),
);
