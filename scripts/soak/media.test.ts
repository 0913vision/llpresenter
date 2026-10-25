import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {parseMediaList} from '../../src/shared/schema/mediaList';
import {
  isRunning,
  waitForHungTree,
  writeHungTree,
} from '../../test/process-trees';
import {makeTempDir} from '../../test/temp-dir';
import {KILL_TIMEOUT_MS} from '../process-tree.mts';
import {
  parseClipSummary,
  prepareSoakMedia,
  runClipMaker,
  SOAK_MEDIA_ID,
  soakMediaList,
} from './media.mts';
import type {ClipSummary} from './clip-frames.mts';

const EXIT_POLL_MS = 50;

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

describe('runClipMaker', () => {
  const summary = JSON.stringify(CLIP);

  it('reads the summary from the last line', async () => {
    const script = `console.log('encoding'); console.log(${JSON.stringify(summary)});`;
    await expect(
      runClipMaker({
        file: process.execPath,
        args: ['-e', script],
        deadlineMs: 60_000,
      }),
    ).resolves.toEqual(CLIP);
  });

  it('keeps only the end of a flood of output and still finds the summary', async () => {
    const script = `console.log('x'.repeat(5_000_000)); console.log(${JSON.stringify(summary)});`;
    await expect(
      runClipMaker({
        file: process.execPath,
        args: ['-e', script],
        deadlineMs: 60_000,
      }),
    ).resolves.toEqual(CLIP);
  });

  it('stops a maker that stalls at its deadline', async () => {
    await expect(
      runClipMaker({
        file: process.execPath,
        args: ['-e', 'setInterval(() => {}, 1000)'],
        deadlineMs: 500,
      }),
    ).rejects.toThrow('the clip maker did not finish within 0.5 s');
  });

  it('ends the stalled maker and every process it started', async () => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const dir = await makeTempDir();
    const running = runClipMaker({
      file: process.execPath,
      args: [await writeHungTree(dir), 'maker'],
      deadlineMs: 60_000,
    });
    const pids = await waitForHungTree(dir, 'maker');
    const failed = expect(running).rejects.toThrow('did not finish');
    await vi.advanceTimersByTimeAsync(60_000);
    await failed;
    await vi.waitFor(
      () => {
        expect(isRunning(pids.parent)).toBe(false);
        expect(isRunning(pids.child)).toBe(false);
      },
      {timeout: KILL_TIMEOUT_MS, interval: EXIT_POLL_MS},
    );
  });

  it('reports a maker that fails', async () => {
    await expect(
      runClipMaker({
        file: process.execPath,
        args: ['-e', 'process.exit(3)'],
        deadlineMs: 60_000,
      }),
    ).rejects.toThrow('the soak clip could not be made');
  });
});
