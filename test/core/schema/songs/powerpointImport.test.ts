import {describe, expect, it} from 'vitest';
import {
  POWERPOINT_PICTURE_LIMITS,
  parsePowerPointBackgroundsRequest,
  parsePowerPointBackgroundsResult,
  parsePowerPointReadResult,
  parsePowerPointReleaseRequest,
} from '@core/schema/songs/powerpointImport';
import {
  POWERPOINT_IMPORT_LIMITS,
  TEXT_IMPORT_LIMITS,
} from '@core/schema/songs/textImportLimits';

const BACKGROUND = 'a'.repeat(64);

function slide(number: number, lines: readonly string[] = ['주 은혜']) {
  return {
    number,
    shapes: [{role: 'body', lines}],
    background: BACKGROUND,
    textColor: 0xffffff,
  };
}

function read(slides: readonly unknown[]) {
  return {
    ok: true,
    value: {fileName: '은혜.pptx', widescreen: true, slides},
  };
}

describe('the read PowerPoint file', () => {
  it('accepts slides with their text, background and text color', () => {
    expect(parsePowerPointReadResult(read([slide(1), slide(2)])).ok).toBe(true);
    expect(parsePowerPointReadResult({ok: true, value: null}).ok).toBe(true);
    expect(parsePowerPointReadResult({ok: false, message: '실패'}).ok).toBe(
      true,
    );
  });

  it.each([
    ['a slide number of 0', [slide(0)]],
    [
      'a slide number past the slide limit',
      [slide(POWERPOINT_IMPORT_LIMITS.slides + 1)],
    ],
    ['a background that is not a hash', [{...slide(1), background: 'bg'}]],
    ['a text color past white', [{...slide(1), textColor: 0x1000000}]],
    [
      'more text than an import takes',
      [slide(1, ['가'.repeat(TEXT_IMPORT_LIMITS.characters)]), slide(2)],
    ],
  ])('refuses %s', (_name, slides) => {
    expect(parsePowerPointReadResult(read(slides)).ok).toBe(false);
  });
});

describe('the slide background requests', () => {
  it('accepts distinct slide positions up to the picture limit', () => {
    const indices = Array.from(
      {length: POWERPOINT_PICTURE_LIMITS.count},
      (_, index) => index,
    );

    expect(parsePowerPointBackgroundsRequest({indices}).ok).toBe(true);
  });

  it.each([
    ['no slide', []],
    ['the same slide twice', [1, 1]],
    ['a negative position', [-1]],
    [
      'more slides than the picture limit',
      Array.from(
        {length: POWERPOINT_PICTURE_LIMITS.count + 1},
        (_, index) => index,
      ),
    ],
  ])('refuses %s', (_name, indices) => {
    expect(parsePowerPointBackgroundsRequest({indices}).ok).toBe(false);
  });

  it('takes a picture file per slide, or null when none could be made', () => {
    expect(
      parsePowerPointBackgroundsResult([{index: 0, path: 'C:/bg/1.png'}]).ok,
    ).toBe(true);
    expect(parsePowerPointBackgroundsResult(null).ok).toBe(true);
    expect(parsePowerPointBackgroundsResult([]).ok).toBe(false);
    expect(parsePowerPointBackgroundsResult([{index: 0, path: ''}]).ok).toBe(
      false,
    );
  });
});

describe('the release of a read file', () => {
  it('names the file by a path that is not empty', () => {
    expect(parsePowerPointReleaseRequest({path: 'C:/copy.pptx'}).ok).toBe(true);
    expect(parsePowerPointReleaseRequest({path: ''}).ok).toBe(false);
    expect(parsePowerPointReleaseRequest({}).ok).toBe(false);
  });
});
