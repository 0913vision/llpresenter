import {isJsonObject} from '../json.mts';
import type {EncodedFrame} from './webm.mts';

/** How the soak clip is drawn and encoded. */
export interface ClipOptions {
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly seconds: number;
  readonly bitrate: number;
}

/**
 * The soak test's background: a 1080p clip at 30 fps, long enough that a
 * 20-minute run passes 120 loop points.
 */
export const SOAK_CLIP: ClipOptions = {
  width: 1920,
  height: 1080,
  fps: 30,
  seconds: 10,
  bitrate: 4_000_000,
};

/** Whether a value was usable, and why not. */
export type Checked<T> =
  | {readonly ok: true; readonly value: T}
  | {readonly ok: false; readonly reason: string};

const MS_PER_SECOND = 1000;
const MAX_GAP_FRAMES = 1.5;
const DURATION_TOLERANCE_S = 0.1;

function parseFrame(value: unknown, index: number): Checked<EncodedFrame> {
  if (!isJsonObject(value)) {
    return {ok: false, reason: `frame ${index} is not an object`};
  }
  const {data, timestampMs, key} = value;
  if (!(data instanceof Uint8Array) || data.length === 0) {
    return {ok: false, reason: `frame ${index} has no data`};
  }
  if (typeof timestampMs !== 'number' || !Number.isFinite(timestampMs)) {
    return {ok: false, reason: `frame ${index} has no time`};
  }
  if (typeof key !== 'boolean') {
    return {
      ok: false,
      reason: `frame ${index} doesn't say whether it is a key frame`,
    };
  }
  return {ok: true, value: {data, timestampMs, key}};
}

/**
 * Checks the frames that the encoding page sent back: at least one, each with
 * data, a time, and a key frame flag, in time order.
 */
export function parseEncodedFrames(value: unknown): Checked<EncodedFrame[]> {
  if (!Array.isArray(value) || value.length === 0) {
    return {ok: false, reason: 'the page sent no frames'};
  }
  const frames: EncodedFrame[] = [];
  for (const [index, item] of value.entries()) {
    const frame = parseFrame(item, index);
    if (!frame.ok) return frame;
    const previous = frames.at(-1);
    if (
      previous !== undefined &&
      frame.value.timestampMs <= previous.timestampMs
    ) {
      return {
        ok: false,
        reason: `frame ${index} is not later than the one before`,
      };
    }
    frames.push(frame.value);
  }
  return {ok: true, value: frames};
}

/**
 * Checks that the frames come at the clip's rate, with no gap longer than one
 * and a half frames, which the output would show as a hitch.
 */
export function checkFrameTiming(
  frames: readonly EncodedFrame[],
  options: ClipOptions,
): Checked<null> {
  const frameMs = MS_PER_SECOND / options.fps;
  const expected = options.fps * options.seconds;
  if (frames.length !== expected) {
    return {
      ok: false,
      reason: `the clip has ${frames.length} frames, not ${expected}`,
    };
  }
  for (const [index, frame] of frames.entries()) {
    const previous = frames[index - 1];
    if (previous === undefined) continue;
    const gapMs = frame.timestampMs - previous.timestampMs;
    if (gapMs > frameMs * MAX_GAP_FRAMES) {
      return {
        ok: false,
        reason: `a ${Math.round(gapMs)} ms gap before frame ${index}`,
      };
    }
  }
  return {ok: true, value: null};
}

/** What the page saw when it played the finished clip. */
export interface Playback {
  readonly duration: number;
  readonly width: number;
  readonly height: number;
}

/** Checks the playback report that the page sent back. */
export function parsePlayback(value: unknown): Checked<Playback> {
  if (!isJsonObject(value)) {
    return {ok: false, reason: 'the page sent no playback check'};
  }
  const {duration, width, height} = value;
  if (
    typeof duration !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number'
  ) {
    return {ok: false, reason: 'the playback check is incomplete'};
  }
  return {ok: true, value: {duration, width, height}};
}

/**
 * Checks that Chromium plays the finished clip at its size and for its
 * length, within a tenth of a second.
 */
export function checkPlayback(
  playback: Playback,
  options: ClipOptions,
): Checked<null> {
  if (playback.width !== options.width || playback.height !== options.height) {
    return {
      ok: false,
      reason: `the clip plays at ${playback.width}x${playback.height}`,
    };
  }
  if (Math.abs(playback.duration - options.seconds) > DURATION_TOLERANCE_S) {
    return {ok: false, reason: `the clip plays for ${playback.duration} s`};
  }
  return {ok: true, value: null};
}

/**
 * Reads what a call into the page returned: `{value}`, or `{error}` with the
 * text of what the page threw.
 */
export function parsePageOutcome(outcome: unknown): Checked<unknown> {
  if (!isJsonObject(outcome)) {
    return {ok: false, reason: 'the page returned nothing'};
  }
  const {error} = outcome;
  if (typeof error === 'string') {
    return {ok: false, reason: `the page failed: ${error}`};
  }
  if (!Object.hasOwn(outcome, 'value')) {
    return {ok: false, reason: 'the page returned no value'};
  }
  return {ok: true, value: outcome['value']};
}
