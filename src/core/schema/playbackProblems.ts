import * as v from 'valibot';
import {parsePayload, payloadObject} from './payload';
import {outputRendererStates} from './outputStatus';
import {MAX_TARGET_SCREENS} from './overlayState';

export const PLAYBACK_PROBLEM_LIMITS = {
  sources: MAX_TARGET_SCREENS + 1,
  name: 200,
  id: 200,
};
export const playbackProblemKinds = [
  'playback',
  'device-missing',
  'device-failed',
  'font-missing',
  'theme-missing',
  'media-missing',
] as const;
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

export type PlaybackProblems = ReadonlyArray<v.InferOutput<typeof problem>>;

/** A renderer reports only its own current problems; main supplies its identity. */
export function parsePlaybackProblemReport(value: unknown) {
  return parsePayload(kinds, value);
}

export function parsePlaybackProblems(value: unknown) {
  return parsePayload(problems, value);
}

export function parsePlaybackRetry(value: unknown) {
  return parsePayload(payloadObject({source}), value);
}
