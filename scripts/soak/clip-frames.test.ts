import {describe, expect, it} from 'vitest';
import {
  checkFrameTiming,
  checkPlayback,
  parseClipArgs,
  parseEncodedFrames,
  parsePageOutcome,
  parsePlayback,
  type ClipOptions,
} from './clip-frames.mts';

const OPTIONS: ClipOptions = {
  width: 1920,
  height: 1080,
  fps: 30,
  seconds: 2,
  bitrate: 4_000_000,
};

function frames(count: number, gapAfter: number | null = null) {
  return Array.from({length: count}, (_, index) => ({
    data: Uint8Array.from([index]),
    timestampMs:
      (index * 1000) / 30 + (gapAfter !== null && index > gapAfter ? 287 : 0),
    key: index % 30 === 0,
  }));
}

describe('parseEncodedFrames', () => {
  it('accepts frames with data, a time, and a key flag in time order', () => {
    const sent = frames(3);
    expect(parseEncodedFrames(sent)).toEqual({ok: true, value: sent});
  });

  it.each([
    ['no frames', [], 'the page sent no frames'],
    ['not a list', {frames: []}, 'the page sent no frames'],
    [
      'a frame without data',
      [{timestampMs: 0, key: true}],
      'frame 0 has no data',
    ],
    [
      'a frame without a time',
      [{data: Uint8Array.from([1]), key: true}],
      'frame 0 has no time',
    ],
    [
      'a frame without a key flag',
      [{data: Uint8Array.from([1]), timestampMs: 0}],
      "frame 0 doesn't say whether it is a key frame",
    ],
    [
      'frames out of order',
      [
        {data: Uint8Array.from([1]), timestampMs: 40, key: true},
        {data: Uint8Array.from([2]), timestampMs: 40, key: false},
      ],
      'frame 1 is not later than the one before',
    ],
  ])('refuses %s', (_label, sent, reason) => {
    expect(parseEncodedFrames(sent)).toEqual({ok: false, reason});
  });
});

describe('checkFrameTiming', () => {
  it('accepts every frame at the clip rate', () => {
    expect(checkFrameTiming(frames(60), OPTIONS)).toEqual({
      ok: true,
      value: null,
    });
  });

  it('refuses a clip with too few frames', () => {
    expect(checkFrameTiming(frames(59), OPTIONS)).toEqual({
      ok: false,
      reason: 'the clip has 59 frames, not 60',
    });
  });

  it('refuses a gap that the output would show as a hitch', () => {
    expect(checkFrameTiming(frames(60, 40), OPTIONS)).toEqual({
      ok: false,
      reason: 'a 320 ms gap before frame 41',
    });
  });
});

describe('parsePlayback and checkPlayback', () => {
  const playing = {duration: 2.033, width: 1920, height: 1080};

  it('reads a complete playback report', () => {
    expect(parsePlayback(playing)).toEqual({ok: true, value: playing});
  });

  it('accepts a clip that plays at its size and length', () => {
    expect(checkPlayback(playing, OPTIONS)).toEqual({ok: true, value: null});
  });

  it.each([
    ['without a size', {duration: 2}],
    ['with a NaN duration', {duration: NaN, width: 1920, height: 1080}],
    [
      'with an endless duration',
      {duration: Infinity, width: 1920, height: 1080},
    ],
    ['with no duration', {duration: 0, width: 1920, height: 1080}],
    ['with a NaN width', {duration: 2, width: NaN, height: 1080}],
  ])('refuses a playback report %s', (_label, report) => {
    expect(parsePlayback(report)).toEqual({
      ok: false,
      reason: 'the playback check needs a finite, positive duration and size',
    });
  });

  it('refuses a NaN duration even when it skips the parser', () => {
    expect(
      checkPlayback({duration: NaN, width: 1920, height: 1080}, OPTIONS),
    ).toEqual({ok: false, reason: 'the clip plays for NaN s'});
  });

  it('refuses a clip that plays for the wrong length', () => {
    expect(
      checkPlayback({duration: Infinity, width: 1920, height: 1080}, OPTIONS),
    ).toEqual({ok: false, reason: 'the clip plays for Infinity s'});
  });

  it('refuses a clip that plays at the wrong size', () => {
    expect(
      checkPlayback({duration: 2, width: 1280, height: 720}, OPTIONS),
    ).toEqual({ok: false, reason: 'the clip plays at 1280x720'});
  });
});

describe('parsePageOutcome', () => {
  it('hands back the value', () => {
    expect(parsePageOutcome({value: [1]})).toEqual({ok: true, value: [1]});
  });

  it('turns the error the page caught into a reason', () => {
    expect(parsePageOutcome({error: 'TypeError: no encoder'})).toEqual({
      ok: false,
      reason: 'the page failed: TypeError: no encoder',
    });
  });

  it('refuses an outcome without a value', () => {
    expect(parsePageOutcome({})).toEqual({
      ok: false,
      reason: 'the page returned no value',
    });
  });
});

describe('parseClipArgs', () => {
  it('reads a clip path and a user data folder', () => {
    expect(
      parseClipArgs(['D:/run/soak-loop.webm', 'D:/run/.clip-maker']),
    ).toEqual({
      ok: true,
      value: {file: 'D:/run/soak-loop.webm', userData: 'D:/run/.clip-maker'},
    });
  });

  it.each([
    ['no arguments', []],
    ['only the clip path', ['D:/run/soak-loop.webm']],
    ['an extra argument', ['D:/run/a.webm', 'D:/run/data', 'more']],
  ])('refuses %s', (_label, args) => {
    expect(parseClipArgs(args)).toEqual({
      ok: false,
      reason: `expected a clip path and a user data folder, got ${args.length} arguments`,
    });
  });

  it('refuses a path that is not a WebM file, such as its own script', () => {
    expect(
      parseClipArgs(['D:/llp/scripts/soak/clip/main.mts', 'D:/run/data']).ok,
    ).toBe(false);
  });
});
