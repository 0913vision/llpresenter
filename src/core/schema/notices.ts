import * as v from 'valibot';
import type {Result} from '../common/result';
import {
  parseFile,
  serializeFile,
  type FileError,
  type FileFormat,
  type LoadedFile,
  type ReadonlyKnown,
} from './fileFormat';
import {mediaIdSchema, noticeSetIdSchema, screenIdSchema} from './ids';
import type {MigrationStep} from './migration';
import {
  jsonObject,
  listWithUniqueIds,
  positiveInteger,
  positiveSeconds,
} from './primitives';

const noticeSetSchema = jsonObject({
  id: noticeSetIdSchema,
  name: v.string(),
  media: v.array(mediaIdSchema),
  interval: positiveSeconds,
  loop: v.boolean(),
  targets: v.array(screenIdSchema),
});

export const noticesSchema = jsonObject({
  format: v.literal('llsettings.notices'),
  schemaVersion: positiveInteger,
  sets: listWithUniqueIds(noticeSetSchema),
});

const noticesMigrations: readonly MigrationStep[] = [];

const noticesFormat: FileFormat<typeof noticesSchema> = {
  format: 'llsettings.notices',
  schema: noticesSchema,
  migrations: noticesMigrations,
};

/** `notices.json`: the 공지 sets. */
export type NoticesFile = ReadonlyKnown<v.InferOutput<typeof noticesSchema>>;

/** A 공지 set: its images in order and the seconds between them. */
export type NoticeSet = NoticesFile['sets'][number];

export function parseNotices(
  text: string,
  file: string,
): Result<LoadedFile<NoticesFile>, FileError> {
  return parseFile(noticesFormat, text, file);
}

export function serializeNotices(
  notices: NoticesFile,
  file: string,
): Result<string, FileError> {
  return serializeFile(noticesFormat, notices, file);
}
