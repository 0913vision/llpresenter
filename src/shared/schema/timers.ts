import * as v from 'valibot';
import type {Result} from '../result';
import {
  parseFile,
  serializeFile,
  type FileError,
  type FileFormat,
  type LoadedFile,
  type ReadonlyKnown,
} from './fileFormat';
import {timerIdSchema} from './ids';
import type {MigrationStep} from './migration';
import {
  jsonObject,
  listWithUniqueIds,
  positiveInteger,
  positiveSeconds,
  timeOfDay,
} from './primitives';

const timerFields = {id: timerIdSchema, name: v.string()};

const timerSchema = v.variant('kind', [
  v.looseObject({
    ...timerFields,
    kind: v.literal('countdownTo'),
    time: timeOfDay,
  }),
  v.looseObject({
    ...timerFields,
    kind: v.literal('countdown'),
    duration: positiveSeconds,
  }),
  v.looseObject({
    ...timerFields,
    kind: v.literal('elapsedFrom'),
    time: timeOfDay,
  }),
  v.looseObject({...timerFields, kind: v.literal('clock')}),
]);

export const timersSchema = jsonObject({
  format: v.literal('llsettings.timers'),
  schemaVersion: positiveInteger,
  timers: listWithUniqueIds(timerSchema),
});

const timersMigrations: readonly MigrationStep[] = [];

const timersFormat: FileFormat<typeof timersSchema> = {
  format: 'llsettings.timers',
  schema: timersSchema,
  migrations: timersMigrations,
};

/** `timers.json`: the 타이머. Whether one runs is output state, not saved here. */
export type TimersFile = ReadonlyKnown<v.InferOutput<typeof timersSchema>>;

/**
 * One 타이머: time left until `time` (`countdownTo`), a fixed `duration` in
 * seconds (`countdown`), time since `time` (`elapsedFrom`), or a `clock`.
 */
export type Timer = TimersFile['timers'][number];

export function parseTimers(
  text: string,
  file: string,
): Result<LoadedFile<TimersFile>, FileError> {
  return parseFile(timersFormat, text, file);
}

export function serializeTimers(
  timers: TimersFile,
  file: string,
): Result<string, FileError> {
  return serializeFile(timersFormat, timers, file);
}
