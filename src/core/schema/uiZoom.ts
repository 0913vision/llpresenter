import * as v from 'valibot';
import type {Result} from '../common/result';
import {parsePayload, payloadObject, type PayloadError} from './payload';

export const UI_ZOOM = {
  min: 100,
  max: 200,
  step: 10,
  defaultPercent: 100,
} as const;

const PERCENT_PER_FACTOR = 100;
export const UI_ZOOM_FACTOR = {
  min: UI_ZOOM.min / PERCENT_PER_FACTOR,
  max: UI_ZOOM.max / PERCENT_PER_FACTOR,
  default: UI_ZOOM.defaultPercent / PERCENT_PER_FACTOR,
} as const;

const uiZoomFactorSchema = v.pipe(
  v.number(),
  v.finite(),
  v.minValue(UI_ZOOM_FACTOR.min),
  v.maxValue(UI_ZOOM_FACTOR.max),
);

/** Checks the actual browser zoom factor without operating system scaling. */
export function parseUiZoomFactor(value: unknown) {
  return parsePayload(uiZoomFactorSchema, value);
}

export const uiZoomPercentSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(UI_ZOOM.min),
  v.maxValue(UI_ZOOM.max),
  v.check(
    percent => percent % UI_ZOOM.step === 0,
    'Expected a 10-point zoom step',
  ),
);

const uiZoomCommandSchema = payloadObject({
  type: v.picklist(['ui.zoomIn', 'ui.zoomOut', 'ui.zoomReset']),
});

export type UiZoomCommand = Readonly<v.InferOutput<typeof uiZoomCommandSchema>>;

/** Checks a zoom reply strictly; stored app.json values have their own fallback. */
export function parseUiZoomPercent(
  value: unknown,
): Result<number, PayloadError> {
  return parsePayload(uiZoomPercentSchema, value);
}

export function parseUiZoomCommand(
  value: unknown,
): Result<UiZoomCommand, PayloadError> {
  return parsePayload(uiZoomCommandSchema, value);
}
