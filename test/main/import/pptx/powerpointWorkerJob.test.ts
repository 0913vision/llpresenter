import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {
  parseJob,
  readBounded,
  runPowerPointJob,
} from '@main/import/pptx/powerpointWorkerJob';
import {
  archive,
  ns,
  rel,
  rels,
  shape,
  slide,
} from '@fixtures/main/import/powerpointArchive';
import {makeTempDir} from '@fixtures/tempDir';

const PICTURE = 'ppt/media/image1.png';

/** A one-slide widescreen PowerPoint with a title and one picture part. */
function deck(): Buffer {
  return archive({
    'ppt/presentation.xml': `<p:presentation ${ns}><p:sldIdLst><p:sldId r:id="r1"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`,
    'ppt/_rels/presentation.xml.rels': rels(
      rel('r1', 'slides/slide1.xml', 'slide'),
    ),
    'ppt/slides/slide1.xml': slide(shape('만복의 근원 하나님')),
    'ppt/slides/_rels/slide1.xml.rels': rels(''),
    [PICTURE]: 'picture bytes',
  });
}

async function saved(bytes: Buffer): Promise<string> {
  const path = join(await makeTempDir(), 'song.pptx');
  await writeFile(path, bytes);
  return path;
}

describe('parseJob', () => {
  it('takes a read, a size, and a pictures job with its parts', () => {
    expect(parseJob({kind: 'read', path: 'a.pptx', extra: 1})).toEqual({
      kind: 'read',
      path: 'a.pptx',
    });
    expect(parseJob({kind: 'size', path: 'a.pptx'})).toEqual({
      kind: 'size',
      path: 'a.pptx',
    });
    expect(
      parseJob({
        kind: 'pictures',
        path: 'a.pptx',
        digest: 'd',
        pictures: [{part: PICTURE, target: 'C:/t/1.png', more: true}],
      }),
    ).toEqual({
      kind: 'pictures',
      path: 'a.pptx',
      digest: 'd',
      pictures: [{part: PICTURE, target: 'C:/t/1.png'}],
    });
  });

  it('refuses anything else', () => {
    for (const value of [
      null,
      'read',
      {kind: 'read'},
      {kind: 'write', path: 'a.pptx'},
      {kind: 'pictures', path: 'a.pptx', pictures: []},
    ]) {
      expect(() => parseJob(value)).toThrow(
        'Invalid PowerPoint worker request',
      );
    }
    expect(() =>
      parseJob({
        kind: 'pictures',
        path: 'a.pptx',
        digest: 'd',
        pictures: [{part: PICTURE}],
      }),
    ).toThrow('Invalid PowerPoint picture');
  });
});

describe('readBounded', () => {
  it('reads a whole file, and refuses what is not a file', async () => {
    const path = await saved(deck());
    expect(await readBounded(path)).toEqual(deck());
    await expect(readBounded(await makeTempDir())).rejects.toThrow();
  });
});

describe('runPowerPointJob', () => {
  it('answers the slide size, and the slides with the digest of the file', async () => {
    const path = await saved(deck());
    expect(await runPowerPointJob({kind: 'size', path})).toMatchObject({
      widescreen: true,
    });
    const read = await runPowerPointJob({kind: 'read', path});
    expect(read).toMatchObject({
      digest: createHash('sha256').update(deck()).digest('hex'),
      widescreen: true,
    });
  });

  it('writes the pictures of the file read before, never over a file that is there', async () => {
    const path = await saved(deck());
    const digest = createHash('sha256').update(deck()).digest('hex');
    const target = join(await makeTempDir(), 'picture.png');
    const job = {
      kind: 'pictures' as const,
      path,
      digest,
      pictures: [{part: PICTURE, target}],
    };
    expect(await runPowerPointJob(job)).toBe(true);
    expect(await readFile(target, 'utf8')).toBe('picture bytes');
    await expect(runPowerPointJob(job)).rejects.toThrow();
  });

  it('refuses pictures of a file that changed since it was read, or of a part it lacks', async () => {
    const path = await saved(deck());
    const target = join(await makeTempDir(), 'picture.png');
    await expect(
      runPowerPointJob({
        kind: 'pictures',
        path,
        digest: 'other',
        pictures: [{part: PICTURE, target}],
      }),
    ).rejects.toThrow('PowerPoint file changed after preview');
    await expect(
      runPowerPointJob({
        kind: 'pictures',
        path,
        digest: createHash('sha256').update(deck()).digest('hex'),
        pictures: [{part: 'ppt/media/none.png', target}],
      }),
    ).rejects.toThrow('PowerPoint picture is unavailable');
  });
});
