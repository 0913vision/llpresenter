import * as v from 'valibot';
import type {Result} from '../result';
import {appLayoutSchema, sizeClasses, type AppConfig} from './appConfig';
import {parsePayload, payloadObject, type PayloadError} from './payload';

/** The column width ranges (px) of the design system `Layout`. */
export const COLUMN_LIMITS = {
  left: {min: 200, max: 400},
  right: {min: 320, max: 720},
} as const;

interface WidthRange {
  readonly min: number;
  readonly max: number;
}

function columnWidth({min, max}: WidthRange) {
  return v.pipe(v.number(), v.integer(), v.minValue(min), v.maxValue(max));
}

const layoutChangeSchema = payloadObject({
  sizeClass: v.picklist(sizeClasses),
  left: columnWidth(COLUMN_LIMITS.left),
  right: columnWidth(COLUMN_LIMITS.right),
});

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

/** The column widths of one size class, sent once when a drag ends. */
export type LayoutChange = Readonly<v.InferOutput<typeof layoutChangeSchema>>;

export function parseLayoutChange(
  value: unknown,
): Result<LayoutChange, PayloadError> {
  return parsePayload(layoutChangeSchema, value);
}

export function isLayoutChange(value: unknown): value is LayoutChange {
  return parseLayoutChange(value).ok;
}
