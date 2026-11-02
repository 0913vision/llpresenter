import * as v from 'valibot';
import type {Result} from '../common/result';
import {parsePayload, payloadObject, type PayloadError} from './payload';

/** The `app.json` fields that 환경설정 changes: 곡, 미디어, and 백업 위치. */
export const libraryLocationFields = [
  'songsPath',
  'mediaPath',
  'backupPath',
] as const;

export type LibraryLocationField = (typeof libraryLocationFields)[number];

const fieldSchema = v.picklist(libraryLocationFields);
const chooseRequestSchema = payloadObject({field: fieldSchema});

export type ChooseLocationRequest = Readonly<
  v.InferOutput<typeof chooseRequestSchema>
>;

export function parseChooseLocationRequest(
  value: unknown,
): Result<ChooseLocationRequest, PayloadError> {
  return parsePayload(chooseRequestSchema, value);
}

const locationRowSchema = payloadObject({
  /** The folder the row shows: the stored one, or the default folder. */
  path: v.string(),
  /** The stored folder differs from the one in use since launch. */
  pending: v.boolean(),
});

const locationsViewSchema = payloadObject({
  songs: locationRowSchema,
  media: locationRowSchema,
  backup: locationRowSchema,
  /** The time of the newest complete backup, in milliseconds, or null. */
  lastBackup: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))),
  backingUp: v.boolean(),
});

/** What the 라이브러리 page of 환경설정 shows about the folders. */
export type LocationsView = Readonly<v.InferOutput<typeof locationsViewSchema>>;

export function parseLocationsView(
  value: unknown,
): Result<LocationsView, PayloadError> {
  return parsePayload(locationsViewSchema, value);
}

export const chooseLocationFailures = [
  'canceled',
  'not-writable',
  'outside-development',
  'settings-locked',
] as const;

export type ChooseLocationFailure = (typeof chooseLocationFailures)[number];

const chooseResultSchema = v.variant('ok', [
  v.object({ok: v.literal(true), value: v.optional(v.undefined())}),
  v.object({
    ok: v.literal(false),
    error: v.object({
      reason: v.picklist(chooseLocationFailures),
      /** The system's words for a folder that can't be written. */
      detail: v.optional(v.pipe(v.string(), v.maxLength(500))),
    }),
  }),
]);

/** Whether a folder was stored, or why it was refused. */
export type ChooseLocationResult = Result<
  void,
  {readonly reason: ChooseLocationFailure; readonly detail?: string}
>;

export function parseChooseLocationResult(
  value: unknown,
): Result<ChooseLocationResult, PayloadError> {
  const checked = parsePayload(chooseResultSchema, value);
  if (!checked.ok) return checked;
  if (checked.value.ok) return {ok: true, value: {ok: true, value: undefined}};
  const {reason, detail} = checked.value.error;
  return {
    ok: true,
    value: {
      ok: false,
      error: detail === undefined ? {reason} : {reason, detail},
    },
  };
}

/** The answer of a folder request that fails its check. */
export function refuseChooseLocation(): ChooseLocationResult {
  return {ok: false, error: {reason: 'settings-locked'}};
}

/** 지금 백업 sends no argument; main wants null. */
export function parseBackUpNowRequest(
  value: unknown,
): Result<null, PayloadError> {
  return parsePayload(v.null(), value);
}

export const backUpNowFailures = ['running', 'output-on', 'failed'] as const;

export type BackUpNowFailure = (typeof backUpNowFailures)[number];

const backUpNowResultSchema = v.variant('ok', [
  v.object({ok: v.literal(true), value: v.optional(v.undefined())}),
  v.object({
    ok: v.literal(false),
    error: v.object({reason: v.picklist(backUpNowFailures)}),
  }),
]);

/** Whether 지금 백업 made a backup, or why it did not. */
export type BackUpNowResult = Result<void, {readonly reason: BackUpNowFailure}>;

export function parseBackUpNowResult(
  value: unknown,
): Result<BackUpNowResult, PayloadError> {
  const checked = parsePayload(backUpNowResultSchema, value);
  if (!checked.ok) return checked;
  return {
    ok: true,
    value: checked.value.ok
      ? {ok: true, value: undefined}
      : {ok: false, error: {reason: checked.value.error.reason}},
  };
}

/** The answer of a backup request that fails its check. */
export function refuseBackUpNow(): BackUpNowResult {
  return {ok: false, error: {reason: 'failed'}};
}
