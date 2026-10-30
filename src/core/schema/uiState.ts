import * as v from 'valibot';
import type {Result} from '../common/result';
import {appLayoutSchema, sizeClasses, type AppConfig} from './appConfig';
import {mediaBrowserSchema} from './mediaBrowser';
import {parsePayload, payloadObject, type PayloadError} from './payload';

/**
 * The ranges of the design system `Layout`: the left and right column widths
 * (px) and thumbnail scale (%).
 */
export const COLUMN_LIMITS = {
  left: {min: 200, max: 400},
  right: {min: 320, max: 720},
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
    leftCollapsed: v.exactOptional(v.boolean()),
    left: integerIn(COLUMN_LIMITS.left),
    right: integerIn(COLUMN_LIMITS.right),
    thumbnailScalePercent: integerIn(COLUMN_LIMITS.thumbnailScalePercent),
  }),
  v.check(
    ({left, right}) => (left === undefined) === (right === undefined),
    'Expected the left and right widths together',
  ),
  v.check(
    ({left, thumbnailScalePercent, leftCollapsed}) =>
      left !== undefined ||
      thumbnailScalePercent !== undefined ||
      leftCollapsed !== undefined,
    'Expected column widths, thumbnail scale, or sidebar state',
  ),
);

const uiStateSchema = payloadObject({
  layout: v.exactOptional(appLayoutSchema),
  mediaStrip: v.exactOptional(v.boolean()),
  prepMedia: v.exactOptional(v.boolean()),
  mediaBrowser: v.exactOptional(mediaBrowserSchema),
});

const mediaStripChangeSchema = payloadObject({visible: v.boolean()});

/**
 * The UI part of `app.json` that the control window reads once before its
 * first render. A missing or broken file gives `{}`.
 */
export type UiState = Pick<
  AppConfig,
  'layout' | 'mediaStrip' | 'prepMedia' | 'mediaBrowser'
>;

/** One boolean choice; no collection or unconstrained numeric payload. */
export type MediaStripChange = Readonly<
  v.InferOutput<typeof mediaStripChangeSchema>
>;

export function parseMediaStripChange(value: unknown) {
  return parsePayload(mediaStripChangeSchema, value);
}

export type PrepMediaChange = MediaStripChange;

/** The independent 준비 toolbar media choice uses the same boolean boundary. */
export function parsePrepMediaChange(value: unknown) {
  return parseMediaStripChange(value);
}

/** Checks a `ui:get` reply on the receiving side. Never throws. */
export function parseUiState(value: unknown): Result<UiState, PayloadError> {
  return parsePayload(uiStateSchema, value);
}

/**
 * A change to one size class's layout: the left and right widths together,
 * sent when a drag ends, the thumbnail scale percentage, or sidebar state.
 * Main keeps fields the message omits and still requires paired widths.
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
