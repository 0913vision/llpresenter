import {existsSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {basename, dirname, join} from 'node:path';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {makeTempDir} from '@fixtures/tempDir';
import {POWERPOINT_BUSY} from '@main/import/powerpoint/powerpointFile';
import {PowerPointExportScope} from '@main/import/powerpoint/powerpointExportScope';
import {
  PowerPointExports,
  type ExportListener,
} from '@main/import/powerpoint/powerpointExports';
import type {ReadDeck} from '@main/import/powerpoint/powerpointReader';
import type {PowerPointImagesResult} from '@main/import/powerpoint/powerpointRun';
import {PowerPointTurns} from '@main/import/powerpoint/powerpointTurns';
import type {PowerPointJob} from '@main/import/pptx/powerpointJob';
import {TemporaryPictures} from '@main/import/slidePictures/temporaryPictures';

vi.mock('electron', async () => {
  const {tmpdir} = await import('node:os');
  return {app: {getPath: () => tmpdir()}};
});

/** The first bytes of a 1920 by 1080 PNG, which is all a picture check reads. */
const PNG = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]),
  Buffer.from('IHDR', 'ascii'),
  Buffer.from([0, 0, 7, 128, 0, 0, 4, 56]),
]);
const BACKGROUND = 'a'.repeat(64);

type Progress = (done: number, total: number, number: number) => void;
/** What the fake PowerPoint does for one run: report pictures, then answer. */
type Drawing = (
  folder: string,
  progress: Progress & {readonly decorationSlides?: readonly number[]},
) => Promise<PowerPointImagesResult>;

const used: TemporaryPictures[] = [];
afterEach(() => {
  for (const pictures of used.splice(0)) pictures.dispose();
});

function pictureIn(folder: string, done: number): string {
  return join(folder, `llp-ppt-${String(done).padStart(4, '0')}.png`);
}

/** PowerPoint drawing `count` slides, each with its own picture. */
function drawing(
  count: number,
  result: PowerPointImagesResult = 'ok',
): Drawing {
  return async (folder, progress) => {
    for (let done = 1; done <= count; done++) {
      await writeFile(pictureIn(folder, done), PNG);
      progress(done, count, done);
    }
    return result;
  };
}

function setup({
  chosen = null,
  draw = drawing(0),
  size = {widescreen: true},
}: {
  readonly chosen?: string | null;
  readonly draw?: Drawing;
  readonly size?: unknown;
} = {}) {
  const log = recordingLogger();
  const pictures = new TemporaryPictures(log);
  used.push(pictures);
  const jobs = {
    run: vi.fn(async (job: PowerPointJob): Promise<unknown> => {
      if (job.kind === 'size') return size;
      if (job.kind === 'pictures') {
        for (const picture of job.pictures) {
          await writeFile(picture.target, PNG);
        }
      }
      return null;
    }),
  };
  const images = {
    run: vi.fn(
      (
        _path: string,
        folder: string,
        progress: Progress & {readonly decorationSlides?: readonly number[]},
      ) => draw(folder, progress),
    ),
    cancel: vi.fn(),
  };
  const converter = {run: vi.fn(), cancel: vi.fn()};
  const options = {
    choose: vi.fn(async () => chosen),
    jobs,
    images,
    converter,
    turns: new PowerPointTurns(),
    pictures,
    log,
  };
  const reports: unknown[] = [];
  const listener: ExportListener = {
    isClosed: () => false,
    report: progress => reports.push(progress),
  };
  return {
    exports: new PowerPointExports(options),
    options,
    log,
    reports,
    listener,
  };
}

async function presentation(name = 'song.pptx'): Promise<string> {
  const path = join(await makeTempDir(), name);
  await writeFile(path, 'pptx');
  return path;
}

describe('slides', () => {
  it('draws every slide of the chosen file from a copy and keeps the pictures for the window', async () => {
    const path = await presentation();
    const {exports, options, reports, listener} = setup({
      chosen: path,
      draw: drawing(3),
    });
    const result = await exports.slides(listener);
    if (!result.ok || result.value === null) throw new Error('not drawn');
    expect(result.value.fileName).toBe('song.pptx');
    expect(result.value.slides.map(slide => slide.number)).toEqual([1, 2, 3]);
    for (const slide of result.value.slides) {
      expect(options.pictures.has(slide.path)).toBe(true);
    }
    expect(reports).toEqual([
      {done: 1, total: 3},
      {done: 2, total: 3},
      {done: 3, total: 3},
    ]);
    const drawnFrom = options.images.run.mock.calls[0]?.[0] ?? '';
    expect(drawnFrom).not.toBe(path);
    expect(existsSync(drawnFrom)).toBe(false);
    expect(existsSync(path)).toBe(true);
  });

  it('skips a progress report out of order and keeps the slides that follow it', async () => {
    const {exports, listener} = setup({
      chosen: await presentation(),
      draw: async (folder, progress) => {
        progress(2, 2, 2);
        await writeFile(pictureIn(folder, 1), PNG);
        progress(1, 2, 1);
        await writeFile(pictureIn(folder, 2), PNG);
        progress(2, 2, 2);
        return 'ok';
      },
    });
    const result = await exports.slides(listener);
    expect(
      result.ok && result.value?.slides.map(slide => slide.number),
    ).toEqual([1, 2]);
  });

  it('gives nothing when the operator chooses no file', async () => {
    const {exports, options, listener} = setup();
    expect(await exports.slides(listener)).toEqual({ok: true, value: null});
    expect(options.images.run).not.toHaveBeenCalled();
  });

  it('says PowerPoint is not installed, with the failure for the window', async () => {
    const {exports, log, listener} = setup({
      chosen: await presentation(),
      draw: drawing(0, 'unavailable'),
    });
    expect(await exports.slides(listener)).toEqual({
      ok: false,
      message: 'PowerPoint가 설치되어 있지 않습니다.',
      failure: 'unavailable',
    });
    expect(log.entries.map(entry => entry.message)).toContain(
      'could not export PowerPoint images',
    );
  });

  it('can not read a file when PowerPoint drew fewer slides than it counted', async () => {
    const {exports, listener} = setup({
      chosen: await presentation(),
      draw: async (folder, progress) => {
        await writeFile(pictureIn(folder, 1), PNG);
        progress(1, 3, 1);
        return 'ok';
      },
    });
    expect(await exports.slides(listener)).toEqual({
      ok: false,
      message: 'PowerPoint 파일을 읽을 수 없습니다.',
    });
  });

  it('refuses a 4:3 file before PowerPoint draws it', async () => {
    const {exports, options, listener} = setup({
      chosen: await presentation(),
      size: {widescreen: false, width: 9_144_000, height: 6_858_000},
    });
    const result = await exports.slides(listener);
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).toContain('4:3');
    expect(options.images.run).not.toHaveBeenCalled();
  });

  it('answers busy while another export holds PowerPoint', async () => {
    const {exports, options, listener} = setup({chosen: await presentation()});
    await using held = await PowerPointExportScope.take(options);
    expect(held).not.toBeNull();
    expect(await exports.slides(listener)).toEqual({
      ok: false,
      message: POWERPOINT_BUSY,
    });
    expect(options.choose).not.toHaveBeenCalled();
  });

  it('gives nothing once the operator cancels, and stops PowerPoint', async () => {
    let cancel: () => void = () => undefined;
    const {exports, options, listener} = setup({
      chosen: await presentation(),
      draw: () =>
        new Promise(resolve => {
          cancel = () => resolve('cancelled');
        }),
    });
    expect(exports.cancel()).toBe(false);
    const result = exports.slides(listener);
    await vi.waitFor(() => expect(options.images.run).toHaveBeenCalled());
    expect(exports.cancel()).toBe(true);
    expect(options.images.cancel).toHaveBeenCalled();
    expect(options.converter.cancel).toHaveBeenCalled();
    cancel();
    expect(await result).toEqual({ok: true, value: null});
  });
});

describe('backgrounds', () => {
  function deck(path: string): ReadDeck {
    return {
      path,
      digest: 'd'.repeat(64),
      source: {
        fileName: basename(path),
        widescreen: true,
        slides: [1, 2, 3].map(number => ({
          number,
          shapes: [],
          background: BACKGROUND,
          textColor: null,
        })),
      },
      pictures: ['ppt/media/image1.png', undefined, undefined],
    };
  }

  it('copies a background that is all one picture, has PowerPoint draw the others without their texts, and removes the folder with the last picture', async () => {
    const read = deck(await presentation());
    const {exports, options, reports, listener} = setup({draw: drawing(2)});
    const result = await exports.backgrounds(() => read, [0, 1, 2], listener);
    if (result === null || !Array.isArray(result)) throw new Error('none');
    expect(result.map(picture => picture.index)).toEqual([0, 1, 2]);
    expect(basename(result[0]?.path ?? '')).toBe('llp-ppt-picture-0.png');
    const progress = options.images.run.mock.calls[0]?.[2];
    expect(progress?.decorationSlides).toEqual([2, 3]);
    expect(reports).toHaveLength(3);
    for (const picture of result) {
      expect(options.pictures.has(picture.path)).toBe(true);
    }
    const folder = dirname(result[0]?.path ?? '');
    await options.turns.lastExport();
    for (const picture of result) {
      expect(await options.pictures.release(picture.path)).toBe(true);
    }
    expect(existsSync(folder)).toBe(false);
  });

  it('gives the failure only when no background could be made', async () => {
    const read = {...deck(await presentation()), pictures: []};
    const {exports, listener} = setup({draw: drawing(0, 'unresponsive')});
    expect(await exports.backgrounds(() => read, [1], listener)).toEqual({
      failure: 'unresponsive',
    });
  });

  it('gives nothing for a slide the file does not have, or once the file read has changed', async () => {
    const read = deck(await presentation());
    const first = setup({draw: drawing(2)});
    expect(
      await first.exports.backgrounds(() => read, [7], first.listener),
    ).toBeNull();
    expect(first.options.images.run).not.toHaveBeenCalled();

    const other = deck(await presentation('other.pptx'));
    let current = read;
    const changed = setup({
      draw: async (folder, progress) => {
        current = other;
        return drawing(1)(folder, progress);
      },
    });
    expect(
      await changed.exports.backgrounds(() => current, [1], changed.listener),
    ).toBeNull();
  });
});
