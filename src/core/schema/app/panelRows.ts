import * as v from 'valibot';
import {payloadObject} from '../common/payload';
import {jsonObject} from '../common/primitives';

/** The range of a saved panel height in px. */
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
  'show.previewRatio': height,
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

/** The name of one resizable panel row, such as `show.order`. */
export type PanelRowId = keyof typeof entries;
/**
 * The saved panel heights in px by row. A row without a value uses its default.
 */
export type PanelRows = Readonly<Partial<Record<PanelRowId, number>>>;
/** Whether the text names a panel row. */
export function isPanelRowId(value: string): value is PanelRowId {
  return Object.hasOwn(entries, value);
}
/** The saved panel heights in `app.json`. */
export const panelRowsSchema = jsonObject(entries);
/**
 * A change to the panel heights: at least one row, the others stay as they are.
 */
export const panelRowsChangeSchema = v.pipe(
  payloadObject(entries),
  v.check(value => Object.keys(value).length > 0, 'Expected a panel height'),
);
