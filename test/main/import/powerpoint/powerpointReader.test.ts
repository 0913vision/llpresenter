import {existsSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {expect, it, vi} from 'vitest';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {
  archive,
  ns,
  rel,
  rels,
  shape,
  slide,
} from '@fixtures/main/import/powerpointArchive';
import {makeTempDir} from '@fixtures/tempDir';
import {POWERPOINT_BUSY} from '@main/import/powerpoint/powerpointFile';
import {PowerPointReader} from '@main/import/powerpoint/powerpointReader';
import type {PowerPointImagesResult} from '@main/import/powerpoint/powerpointRun';
import {PowerPointTurns} from '@main/import/powerpoint/powerpointTurns';
import type {PowerPointJob} from '@main/import/pptx/powerpointJob';
import {runPowerPointJob} from '@main/import/pptx/powerpointWorkerJob';

vi.mock('electron', async () => {
  const {tmpdir} = await import('node:os');
  return {app: {getPath: () => tmpdir()}};
});

/** A one-slide PowerPoint of size `cx` by `cy`, with one title. */
function deck(cx = 12_192_000, cy = 6_858_000): Buffer {
  return archive({
    'ppt/presentation.xml': `<p:presentation ${ns}><p:sldIdLst><p:sldId r:id="r1"/></p:sldIdLst><p:sldSz cx="${cx}" cy="${cy}"/></p:presentation>`,
    'ppt/_rels/presentation.xml.rels': rels(
      rel('r1', 'slides/slide1.xml', 'slide'),
    ),
    'ppt/slides/slide1.xml': slide(shape('만복의 근원 하나님')),
    'ppt/slides/_rels/slide1.xml.rels': rels(''),
  });
}

async function file(name: string, bytes: Buffer | string): Promise<string> {
  const path = join(await makeTempDir(), name);
  await writeFile(path, bytes);
  return path;
}

function setup({
  chosen,
  run = runPowerPointJob,
  convert = 'ok',
}: {
  readonly chosen: string | null;
  readonly run?: (job: PowerPointJob) => Promise<unknown>;
  readonly convert?: PowerPointImagesResult;
}) {
  const log = recordingLogger();
  const turns = new PowerPointTurns();
  const jobs = {run: vi.fn(run), cancel: vi.fn()};
  const converter = {
    run: vi.fn(async (_copy: string, folder: string) => {
      if (convert === 'ok') {
        await writeFile(join(folder, 'presentation.pptx'), deck());
      }
      return convert;
    }),
    cancel: vi.fn(),
  };
  const reader = new PowerPointReader({
    choose: async () => chosen,
    jobs,
    converter,
    turns,
    log,
  });
  return {reader, jobs, converter, turns, log};
}

it('reads the chosen file, names it first, and keeps it as the file read last', async () => {
  const path = await file('191장.pptx', deck());
  const {reader} = setup({chosen: path});
  const named = vi.fn();
  const result = await reader.read(named);
  expect(named).toHaveBeenCalledWith('191장.pptx');
  expect(result).toMatchObject({
    ok: true,
    value: {fileName: '191장.pptx', widescreen: true},
  });
  expect(reader.current?.path).toBe(path);
  expect(reader.current?.digest).toMatch(/^[a-f0-9]{64}$/);
});

it('reads nothing when no file is chosen, and answers busy while another read goes on', async () => {
  const none = setup({chosen: null});
  expect(await none.reader.read(vi.fn())).toEqual({ok: true, value: null});

  const busy = setup({chosen: await file('a.pptx', deck())});
  busy.turns.startReading();
  expect(await busy.reader.read(vi.fn())).toEqual({
    ok: false,
    message: POWERPOINT_BUSY,
  });
});

it('refuses a 4:3 file, and says a damaged one can not be read', async () => {
  const square = setup({
    chosen: await file('old.pptx', deck(9_144_000, 6_858_000)),
  });
  const refused = await square.reader.read(vi.fn());
  expect(refused.ok ? '' : refused.message).toContain('4:3');
  expect(square.reader.current).toBeNull();

  const damaged = setup({chosen: await file('broken.pptx', 'not a zip')});
  const result = await damaged.reader.read(vi.fn());
  expect(result.ok ? '' : result.message).toContain('손상되었거나');
  expect(damaged.log.entries).toContainEqual(
    expect.objectContaining({
      level: 'warn',
      message: 'could not read PowerPoint',
    }),
  );
});

it('reads a .ppt from a converted copy under its own name, and removes the copy once forgotten', async () => {
  const original = await file('예전 찬송.ppt', 'legacy bytes');
  const {reader, converter} = setup({chosen: original});
  const result = await reader.read(vi.fn());
  expect(result).toMatchObject({ok: true, value: {fileName: '예전 찬송.ppt'}});
  expect(converter.run).toHaveBeenCalledOnce();
  const copy = reader.current?.path ?? '';
  expect(copy).not.toBe(original);
  expect(existsSync(copy)).toBe(true);
  expect(existsSync(original)).toBe(true);

  expect(reader.cancel()).toBe(true);
  await vi.waitFor(() => expect(existsSync(dirname(copy))).toBe(false));
  expect(reader.current).toBeNull();
});

it('says PowerPoint is needed when a .ppt can not be converted', async () => {
  const {reader} = setup({
    chosen: await file('예전 찬송.ppt', 'legacy bytes'),
    convert: 'unavailable',
  });
  const result = await reader.read(vi.fn());
  expect(result).toEqual({
    ok: false,
    message: '이 파일을 가져오려면 PowerPoint가 설치되어 있어야 합니다.',
  });
});

it('gives nothing once the read is cancelled, and stops its job', async () => {
  let finish: (value: unknown) => void = () => undefined;
  const {reader, jobs, converter} = setup({
    chosen: await file('a.pptx', deck()),
    run: () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  });
  const reading = reader.read(vi.fn());
  await vi.waitFor(() => expect(jobs.run).toHaveBeenCalled());
  expect(reader.cancel()).toBe(true);
  expect(jobs.cancel).toHaveBeenCalledWith('read');
  expect(converter.cancel).toHaveBeenCalled();
  finish(null);
  expect(await reading).toEqual({ok: true, value: null});
  expect(reader.current).toBeNull();
});
