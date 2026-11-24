import * as v from 'valibot';
import type {Result} from '@core/common/result';
import {appLayoutSchema, sizeClasses, type AppConfig} from './appConfig';
import {
  mediaBrowserChangeSchema,
  mediaBrowserSchema,
} from '../media/mediaBrowser';
import {screenIdSchema, macroCollectionIdSchema} from '../common/ids';
import {panelRowsChangeSchema} from './panelRows';
import {
  parsePayload,
  payloadObject,
  type PayloadError,
} from '../common/payload';
import {slideColumnsSchema} from '../slides/slideColumns';

/**
 * The ranges of the design system `Layout`: the column widths (px) and
 * thumbnail scale (%).
 */
export const COLUMN_LIMITS = {
  left: {min: 200, max: 400},
  right: {min: 320, max: 720},
  prepRight: {min: 280, max: 560},
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
    rows: v.exactOptional(panelRowsChangeSchema),
    leftCollapsed: v.exactOptional(v.boolean()),
    left: integerIn(COLUMN_LIMITS.left),
    right: integerIn(COLUMN_LIMITS.right),
    prepRight: integerIn(COLUMN_LIMITS.prepRight),
    thumbnailScalePercent: integerIn(COLUMN_LIMITS.thumbnailScalePercent),
    detailsSlideScalePercent: integerIn(COLUMN_LIMITS.thumbnailScalePercent),
    editorSlideView: v.exactOptional(v.picklist(['list', 'grid'])),
    editorSlideScalePercent: integerIn(COLUMN_LIMITS.thumbnailScalePercent),
  }),
  v.check(
    ({left, right}) => (left === undefined) === (right === undefined),
    'Expected the left and right widths together',
  ),
  v.check(
    change => Object.keys(change).some(key => key !== 'sizeClass'),
    'Expected a layout or slide editor view change',
  ),
);

const uiStateSchema = payloadObject({
  layout: v.exactOptional(appLayoutSchema),
  mediaStrip: v.exactOptional(v.boolean()),
  mediaBrowser: v.exactOptional(mediaBrowserSchema),
  previewBig: v.exactOptional(screenIdSchema),
  previewBigVisible: v.exactOptional(v.boolean()),
  macroView: v.exactOptional(v.picklist(['grid', 'list'])),
  macroCollection: v.exactOptional(macroCollectionIdSchema),
  showToolTab: v.exactOptional(
    v.picklist(['audio', 'stage', 'timer', 'message', 'prop', 'macro']),
  ),
  slideColumns: v.exactOptional(slideColumnsSchema),
});

const rememberedViewChangeSchema = v.pipe(
  payloadObject({
    mediaStrip: v.exactOptional(v.boolean()),
    /** Only the given fields change. */
    mediaBrowser: v.exactOptional(mediaBrowserChangeSchema),
    previewBig: v.exactOptional(screenIdSchema),
    previewBigVisible: v.exactOptional(v.boolean()),
    macroView: v.exactOptional(v.picklist(['grid', 'list'])),
    macroCollection: v.exactOptional(v.nullable(macroCollectionIdSchema)),
    showToolTab: v.exactOptional(
      v.picklist(['audio', 'stage', 'timer', 'message', 'prop', 'macro']),
    ),
    slideColumns: v.exactOptional(slideColumnsSchema),
  }),
  v.check(
    value => Object.keys(value).length > 0,
    'Expected a remembered view change',
  ),
);
/**
 * A change to the remembered view fields of `app.json`. It has at least one
 * field.
 */
export type RememberedViewChange = Readonly<
  v.InferOutput<typeof rememberedViewChangeSchema>
>;
/** Checks a remembered view change. */
export function parseRememberedViewChange(value: unknown) {
  return parsePayload(rememberedViewChangeSchema, value);
}

/**
 * The UI part of `app.json` that the control window reads once before its
 * first render. A missing or broken file gives `{}`.
 */
export type UiState = Pick<
  AppConfig,
  | 'layout'
  | 'mediaStrip'
  | 'mediaBrowser'
  | 'previewBig'
  | 'previewBigVisible'
  | 'macroView'
  | 'macroCollection'
  | 'showToolTab'
  | 'slideColumns'
>;

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

/** Checks a layout change. */
export function parseLayoutChange(
  value: unknown,
): Result<LayoutChange, PayloadError> {
  return parsePayload(layoutChangeSchema, value);
}

/** Whether the value is a valid layout change. */
export function isLayoutChange(value: unknown): value is LayoutChange {
  return parseLayoutChange(value).ok;
}
