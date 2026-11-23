import * as v from 'valibot';
import {jsonObject, positiveInteger} from './primitives';

/** What the app does before its window shows. */
export const LAUNCH_TASK_IDS = [
  'files',
  'settings',
  'window',
  'media',
  'content',
  'page',
  'view',
  'outputs',
] as const;

export const launchTaskIdSchema = v.picklist(LAUNCH_TASK_IDS);

export type LaunchTaskId = (typeof LAUNCH_TASK_IDS)[number];

const taskTime = v.exactOptional(positiveInteger);

/** When each task usually ends, in ms after the launch began. */
export const launchTimesSchema = jsonObject({
  files: taskTime,
  settings: taskTime,
  window: taskTime,
  media: taskTime,
  content: taskTime,
  page: taskTime,
  view: taskTime,
  outputs: taskTime,
});

export type LaunchTimes = Readonly<Partial<Record<LaunchTaskId, number>>>;
