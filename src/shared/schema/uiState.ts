import * as v from 'valibot';
import type {Result} from '../result';
import {appLayoutSchema, sizeClasses, type AppConfig} from './appConfig';
import {parsePayload, payloadObject, type PayloadError} from './payload';

/**
 * The ranges of the design system `Layout`: the left and right column widths
 * (px), thumbnail scale (%), and legacy number of thumbnail columns.
 */
export const COLUMN_LIMITS = {
  left: {min: 200, max: 400},
  right: {min: 320, max: 720},
  columns: {min: 2, max: 8},
  thumbnailScalePercent: {min: 50, max: 200},
} as const;

interface IntegerRange {
  readonly min: number;
  readonly max: number;
}

function integerIn({min, max}: IntegerRange) {
  return v.exactOptional(
    v.pipe(v.number(), v.integer(), v.minValue(min), v.maxValue(max)),
  );
}

const layoutChangeSchema = v.pipe(
  payloadObject({
    sizeClass: v.picklist(sizeClasses),
    left: integerIn(COLUMN_LIMITS.left),
    right: integerIn(COLUMN_LIMITS.right),
    columns: integerIn(COLUMN_LIMITS.columns),
    thumbnailScalePercent: integerIn(COLUMN_LIMITS.thumbnailScalePercent),
  }),
  v.check(
    ({left, right}) => (left === undefined) === (right === undefined),
    'Expected the left and right widths together',
  ),
  v.check(
    ({left, columns, thumbnailScalePercent}) =>
      left !== undefined ||
      columns !== undefined ||
      thumbnailScalePercent !== undefined,
    'Expected column widths, thumbnail scale, or legacy thumbnail columns',
  ),
);

const uiStateSchema = payloadObject({
  layout: v.exactOptional(appLayoutSchema),
});

/**
 * The UI part of `app.json` that the control window reads once before its
 * first render. A missing or broken file gives `{}`.
 */
export type UiState = Pick<AppConfig, 'layout'>;

/** Checks a `ui:get` reply on the receiving side. Never throws. */
export function parseUiState(value: unknown): Result<UiState, PayloadError> {
  return parsePayload(uiStateSchema, value);
}

/**
 * A change to one size class's layout: the left and right widths together,
 * sent when a drag ends, the thumbnail scale percentage, or legacy thumbnail
 * columns during the shell transition. Main keeps fields the message omits.
 */
export type LayoutChange = Readonly<v.InferOutput<typeof layoutChangeSchema>>;

export function parseLayoutChange(
  value: unknown,
): Result<LayoutChange, PayloadError> {
  return parsePayload(layoutChangeSchema, value);
}

export function isLayoutChange(value: unknown): value is LayoutChange {
  return parseLayoutChange(value).ok;
}
