import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {parseMediaList} from '../../src/shared/schema/mediaList';
import {makeTempDir} from '../../test/temp-dir';
import {
  parseClipSummary,
  prepareSoakMedia,
  SOAK_MEDIA_ID,
  soakMediaList,
  type ClipSummary,
} from './media.mts';

const CLIP: ClipSummary = {
  file: 'D:/soak/soak-loop.webm',
  bytes: 5_013_551,
  frames: 300,
  durationMs: 10_000,
};

describe('soakMediaList', () => {
  it('is a media list that the app reads, with the clip looping', () => {
    const text = JSON.stringify(soakMediaList(CLIP));
    const parsed = parseMediaList(text, 'media.json');
    expect(parsed.ok).toBe(true);
    expect(soakMediaList(CLIP).items).toEqual([
      {
        id: SOAK_MEDIA_ID,
        name: '소크 시험 배경',
        kind: 'video',
        file: 'soak-loop.webm',
        size: 5_013_551,
        duration: 10,
        width: 1920,
        height: 1080,
        props: {end: 'loop', fit: 'fill'},
      },
    ]);
  });
});

describe('prepareSoakMedia', () => {
  it('makes the clip in the media folder and lists it in 설정/media.json', async () => {
    const userData = await makeTempDir();
    const made: string[] = [];
    const mediaId = await prepareSoakMedia(userData, async file => {
      made.push(file);
      await writeFile(file, 'clip');
      return {...CLIP, file};
    });
    const clipPath = join(userData, 'LoveLight', '미디어', 'soak-loop.webm');
    expect(made).toEqual([clipPath]);
    expect(await readFile(clipPath, 'utf8')).toBe('clip');
    const listText = await readFile(
      join(userData, 'LoveLight', '설정', 'media.json'),
      'utf8',
    );
    expect(parseMediaList(listText, 'media.json').ok).toBe(true);
    expect(mediaId).toBe(SOAK_MEDIA_ID);
  });
});

describe('parseClipSummary', () => {
  it('reads the summary line', () => {
    expect(parseClipSummary(JSON.stringify(CLIP))).toEqual({
      ok: true,
      value: CLIP,
    });
  });

  it.each([
    ['text that is not JSON', 'Electron crashed'],
    ['a summary without a size', JSON.stringify({...CLIP, bytes: 0})],
    ['a list', '[]'],
  ])('refuses %s', (_label, line) => {
    expect(parseClipSummary(line).ok).toBe(false);
  });
});
