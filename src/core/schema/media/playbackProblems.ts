import * as v from 'valibot';
import {parsePayload, payloadObject} from '../common/payload';
import {outputRendererStates} from '../live/outputStatus';
import {MAX_TARGET_SCREENS} from '../live/overlayState';

/**
 * Bounds for a playback problem list: one entry for each target screen and the
 * preview, and the longest source id and name in characters.
 */
export const PLAYBACK_PROBLEM_LIMITS = {
  sources: MAX_TARGET_SCREENS + 1,
  name: 200,
  id: 200,
};
/**
 * The kinds of problem a screen can report: playback, a missing or failed
 * device, and a missing font, theme or media.
 */
export const playbackProblemKinds = [
  'playback',
  'device-missing',
  'device-failed',
  'font-missing',
  'theme-missing',
  'media-missing',
] as const;
/** One of `playbackProblemKinds`. */
export type PlaybackProblemKind = (typeof playbackProblemKinds)[number];

const kinds = v.pipe(
  v.array(v.picklist(playbackProblemKinds)),
  v.maxLength(playbackProblemKinds.length),
  v.check(values => new Set(values).size === values.length),
);
const source = v.pipe(
  v.string(),
  v.nonEmpty(),
  v.maxLength(PLAYBACK_PROBLEM_LIMITS.id),
);
const problem = payloadObject({
  source,
  name: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.maxLength(PLAYBACK_PROBLEM_LIMITS.name),
  ),
  kinds,
  renderer: v.picklist(outputRendererStates),
});
const problems = v.pipe(
  v.array(problem),
  v.maxLength(PLAYBACK_PROBLEM_LIMITS.sources),
  v.check(
    values => new Set(values.map(value => value.source)).size === values.length,
  ),
);

/**
 * The current problems of every source that has any: its id, its name, its
 * problem kinds, and the state of its renderer.
 */
export type PlaybackProblems = ReadonlyArray<v.InferOutput<typeof problem>>;

/** A renderer reports only its own current problems; main supplies its identity. */
export function parsePlaybackProblemReport(value: unknown) {
  return parsePayload(kinds, value);
}

/** Checks a problem list that arrived over IPC. */
export function parsePlaybackProblems(value: unknown) {
  return parsePayload(problems, value);
}

/** Checks the source a window asks to retry. */
export function parsePlaybackRetry(value: unknown) {
  return parsePayload(payloadObject({source}), value);
}
