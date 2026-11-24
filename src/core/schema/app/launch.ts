import * as v from 'valibot';
import {parsePayload, payloadObject} from '../common/payload';
import {jsonObject, positiveInteger} from '../common/primitives';

/** What the control window prepares itself before it shows. */
export const VIEW_TASK_IDS = ['data', 'pictures', 'fonts', 'drawing'] as const;

/** What the app does before its window shows. */
export const LAUNCH_TASK_IDS = [
  'files',
  'settings',
  'window',
  'media',
  'content',
  'page',
  'data',
  'pictures',
  'fonts',
  'outputs',
  'drawing',
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
  data: taskTime,
  pictures: taskTime,
  fonts: taskTime,
  outputs: taskTime,
  drawing: taskTime,
});

export type LaunchTimes = Readonly<Partial<Record<LaunchTaskId, number>>>;

const MAX_PARTS = 100_000;

const count = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0),
  v.maxValue(MAX_PARTS),
);

const preparationSchema = v.pipe(
  payloadObject({
    task: v.picklist(VIEW_TASK_IDS),
    done: count,
    total: count,
    ended: v.boolean(),
  }),
  v.check(({done, total}) => done <= total, 'More is done than there is'),
);

/** How far the control window is with a task of its own. */
export type Preparation = Readonly<v.InferOutput<typeof preparationSchema>>;

export function parsePreparation(value: unknown) {
  return parsePayload(preparationSchema, value);
}
